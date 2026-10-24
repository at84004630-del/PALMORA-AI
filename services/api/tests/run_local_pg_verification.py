"""
Automated Phase 1 PostgreSQL Local Verification Runner
Strictly adheres to Palmora AI Phase 1 safeguards:
  1. Isolated local PostgreSQL cluster on 127.0.0.1:5433 using scram-sha-256 authentication.
  2. Applies bootstrap, 001_initial_schema.sql, and 002_foundation_and_lifecycle.sql in order.
  3. Verifies authenticator role (NOBYPASSRLS, NOSUPERUSER).
  4. Runs all 6 real integration tests + full test suite.
  5. Guaranteed cleanup stopping server and removing disposable pgdata.
"""

import os
import sys
import time
import socket
import tempfile
import subprocess
import shutil
from pathlib import Path

# Force unbuffered output so all logs appear immediately
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
PG_BIN_DIR = BASE_DIR / ".local_pgsql" / "pgsql" / "bin"
PGDATA_DIR = BASE_DIR / ".tmp_test_pgdata"

INITDB = str(PG_BIN_DIR / "initdb.exe")
PG_CTL = str(PG_BIN_DIR / "pg_ctl.exe")
PSQL = str(PG_BIN_DIR / "psql.exe")

HOST = "127.0.0.1"
PORT = 5433
ADMIN_USER = "postgres"
ADMIN_PASSWORD = "test_postgres_pw"
TEST_DB = "palmora_test"
AUTHENTICATOR_USER = "authenticator"
AUTHENTICATOR_PASSWORD = "test_authenticator_pw"

TEST_DB_URL = f"postgresql://{AUTHENTICATOR_USER}:{AUTHENTICATOR_PASSWORD}@{HOST}:{PORT}/{TEST_DB}?connect_timeout=5"
ADMIN_DB_URL = f"postgresql://{ADMIN_USER}:{ADMIN_PASSWORD}@{HOST}:{PORT}/{TEST_DB}?connect_timeout=5"


def wait_for_port(host: str, port: int, timeout: float = 15.0) -> bool:
    """Waits until a TCP port is accepting connections."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with socket.create_connection((host, port), timeout=1.0):
                return True
        except (socket.error, OSError):
            time.sleep(0.5)
    return False


def stop_and_cleanup():
    """Guaranteed cleanup of disposable cluster and temp data."""
    print("\n--- Cleaning up temporary PostgreSQL cluster ---", flush=True)
    if PGDATA_DIR.exists():
        try:
            print(f"Stopping PostgreSQL server on {PORT}...", flush=True)
            subprocess.run(
                [PG_CTL, "-D", str(PGDATA_DIR), "stop", "-m", "immediate", "-s"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            time.sleep(1.0)
        except Exception as e:
            print(f"Warning during pg_ctl stop: {e}", flush=True)
        try:
            print(f"Removing disposable data directory {PGDATA_DIR}...", flush=True)
            shutil.rmtree(PGDATA_DIR, ignore_errors=True)
        except Exception as e:
            print(f"Warning removing {PGDATA_DIR}: {e}", flush=True)
    print("Cleanup complete.", flush=True)


def run_verification():
    import psycopg

    print("==================================================================", flush=True)
    print("PALMORA AI — PHASE 1 POSTGRESQL REAL ENGINE VERIFICATION", flush=True)
    print("==================================================================", flush=True)

    # 1. Check binaries
    if not (PG_BIN_DIR / "initdb.exe").exists():
        print(f"ERROR: initdb.exe not found in {PG_BIN_DIR}", flush=True)
        sys.exit(1)

    # Clean existing data dir if present
    if PGDATA_DIR.exists():
        subprocess.run([PG_CTL, "-D", str(PGDATA_DIR), "stop", "-m", "immediate", "-s"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.0)
        shutil.rmtree(PGDATA_DIR, ignore_errors=True)

    try:
        # 2. Initialize cluster with scram-sha-256
        print(f"\n1. Initializing disposable cluster in {PGDATA_DIR}...", flush=True)
        pw_file_path = os.path.join(tempfile.gettempdir(), f"pgpw_{os.getpid()}.txt")
        with open(pw_file_path, "w", encoding="utf-8") as f:
            f.write(f"{ADMIN_PASSWORD}\n")

        try:
            cmd_init = [
                INITDB,
                "-D", str(PGDATA_DIR),
                "-U", ADMIN_USER,
                f"--pwfile={pw_file_path}",
                "--auth-local=scram-sha-256",
                "--auth-host=scram-sha-256",
                "-E", "UTF8",
                "--locale=C",
            ]
            res_init = subprocess.run(cmd_init, capture_output=True, text=True)
            if res_init.returncode != 0:
                print(f"ERROR running initdb:\nSTDOUT: {res_init.stdout}\nSTDERR: {res_init.stderr}", flush=True)
                sys.exit(res_init.returncode)
            print("Cluster initialized successfully with scram-sha-256.", flush=True)
        finally:
            if os.path.exists(pw_file_path):
                os.remove(pw_file_path)

        # 3. Start PostgreSQL on 127.0.0.1:5433 using DEVNULL to avoid Windows pipe hang
        print(f"\n2. Starting PostgreSQL on {HOST}:{PORT}...", flush=True)
        log_file = PGDATA_DIR / "pg.log"
        cmd_start = [
            PG_CTL,
            "-D", str(PGDATA_DIR),
            "-o", f"-p {PORT} -h {HOST}",
            "-l", str(log_file),
            "-w",
            "start"
        ]
        res_start = subprocess.run(cmd_start, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if res_start.returncode != 0:
            print(f"ERROR starting PostgreSQL (exit code {res_start.returncode})", flush=True)
            if log_file.exists():
                print(log_file.read_text(), flush=True)
            sys.exit(res_start.returncode)

        if not wait_for_port(HOST, PORT, timeout=15.0):
            print(f"ERROR: PostgreSQL did not accept connections on {HOST}:{PORT} within 15 seconds.", flush=True)
            if log_file.exists():
                print(f"Server Log:\n{log_file.read_text()}", flush=True)
            sys.exit(1)
        print(f"PostgreSQL 16.8 is active and bound exclusively to {HOST}:{PORT}.", flush=True)

        # 4. Create database palmora_test
        print(f"\n3. Creating database '{TEST_DB}'...", flush=True)
        conn_default = psycopg.connect(
            f"postgresql://{ADMIN_USER}:{ADMIN_PASSWORD}@{HOST}:{PORT}/postgres?connect_timeout=5",
            autocommit=True
        )
        with conn_default.cursor() as cur:
            cur.execute(f"CREATE DATABASE {TEST_DB};")
        conn_default.close()
        print(f"Database '{TEST_DB}' created.", flush=True)

        # 5. Apply bootstrap and forward migrations in order
        admin_conn = psycopg.connect(ADMIN_DB_URL, autocommit=False)
        migrations = [
            ("Bootstrap (Supabase Compatibility)", BASE_DIR / "supabase" / "tests" / "bootstrap_plain_postgres.sql"),
            ("Migration 001 (Initial Schema)", BASE_DIR / "supabase" / "migrations" / "001_initial_schema.sql"),
            ("Migration 002 (Foundation & Lifecycle)", BASE_DIR / "supabase" / "migrations" / "002_foundation_and_lifecycle.sql"),
        ]

        print("\n4. Applying migrations in order...", flush=True)
        with admin_conn.cursor() as cur:
            for label, file_path in migrations:
                print(f"  -> Applying {label} from {file_path.name}...", flush=True)
                sql_content = file_path.read_text(encoding="utf-8")
                try:
                    cur.execute(sql_content)
                    admin_conn.commit()
                    print(f"     [OK] {file_path.name} applied successfully.", flush=True)
                except Exception as e:
                    admin_conn.rollback()
                    print(f"     [FAILED] Error applying {file_path.name}: {e}", flush=True)
                    raise

        # 6. Verify connection role privileges
        print("\n5. Verifying 'authenticator' role permissions...", flush=True)
        with admin_conn.cursor() as cur:
            cur.execute(
                "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = %s;",
                (AUTHENTICATOR_USER,)
            )
            row = cur.fetchone()
            assert row is not None, f"Role {AUTHENTICATOR_USER} not found!"
            rolname, rolsuper, rolbypassrls = row[0], row[1], row[2]
            print(f"  -> Role: {rolname}", flush=True)
            print(f"  -> rolsuper: {rolsuper} (Must be False)", flush=True)
            print(f"  -> rolbypassrls: {rolbypassrls} (Must be False)", flush=True)
            assert rolsuper is False, "SECURITY FAILURE: authenticator must NOT be superuser!"
            assert rolbypassrls is False, "SECURITY FAILURE: authenticator must NOT have BYPASSRLS!"
            print("  -> Privilege verification PASSED: Role has NOBYPASSRLS and NOSUPERUSER.", flush=True)
        admin_conn.close()

        # 7. Test connection with authenticator credentials
        print("\n6. Verifying 'authenticator' connection and role-switching...", flush=True)
        auth_conn = psycopg.connect(TEST_DB_URL, autocommit=False)
        with auth_conn.cursor() as cur:
            cur.execute("SELECT current_user;")
            user = cur.fetchone()[0]
            assert user == AUTHENTICATOR_USER
            cur.execute("SET LOCAL ROLE authenticated;")
            cur.execute("SELECT current_user;")
            switched = cur.fetchone()[0]
            assert switched == "authenticated"
            print(f"  -> authenticator authenticated successfully and switched to '{switched}'.", flush=True)
        auth_conn.close()

        # 8. Run PostgreSQL integration tests
        print("\n7. Executing Phase 1 PostgreSQL live integration tests...", flush=True)
        env = os.environ.copy()
        env["TEST_DATABASE_URL"] = TEST_DB_URL
        env["TEST_ADMIN_DATABASE_URL"] = ADMIN_DB_URL

        pytest_cmd_int = [
            sys.executable, "-m", "pytest",
            str(BASE_DIR / "services" / "api" / "tests" / "test_postgres_integration.py"),
            "-v"
        ]
        res_int = subprocess.run(pytest_cmd_int, env=env, capture_output=True, text=True)
        print(res_int.stdout, flush=True)
        if res_int.stderr:
            print(res_int.stderr, flush=True)

        if res_int.returncode != 0:
            print(f"FAILED: Integration tests failed with code {res_int.returncode}", flush=True)
            sys.exit(res_int.returncode)

        # 9. Run full test suite
        print("\n8. Executing complete backend test suite...", flush=True)
        pytest_cmd_full = [
            sys.executable, "-m", "pytest",
            str(BASE_DIR / "services" / "api" / "tests"),
            "-v"
        ]
        res_full = subprocess.run(pytest_cmd_full, env=env, capture_output=True, text=True)
        print(res_full.stdout, flush=True)
        if res_full.stderr:
            print(res_full.stderr, flush=True)

        if res_full.returncode != 0:
            print(f"FAILED: Full test suite failed with code {res_full.returncode}", flush=True)
            sys.exit(res_full.returncode)

        print("\n==================================================================", flush=True)
        print("PHASE 1 DATABASE-LEVEL SECURITY VERIFICATION: ALL TESTS PASSED!", flush=True)
        print("==================================================================", flush=True)

    finally:
        stop_and_cleanup()


if __name__ == "__main__":
    run_verification()
