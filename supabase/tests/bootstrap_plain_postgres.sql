-- Palmora AI Test Environment Bootstrap for Plain PostgreSQL
-- File: supabase/tests/bootstrap_plain_postgres.sql
-- Description:
--   Provisions the Supabase compatibility layer on plain PostgreSQL instances:
--   1. Creates anon, authenticated, authenticator, and palmora_worker roles.
--   2. Creates auth schema, auth.users table, and auth.uid() function.
--   3. Configures role memberships and grants.
-- Run this script BEFORE applying 001_initial_schema.sql and 002_foundation_and_lifecycle.sql
-- on non-Supabase PostgreSQL environments.

-- 1. Create Roles (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator WITH LOGIN PASSWORD 'test_authenticator_pw' NOINHERIT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'palmora_worker') THEN
        CREATE ROLE palmora_worker WITH LOGIN PASSWORD 'test_worker_pw' NOINHERIT;
    END IF;
END;
$$;

-- Ensure authenticator role has NOBYPASSRLS and NO SUPERUSER
ALTER ROLE authenticator NOSUPERUSER NOBYPASSRLS;
GRANT anon, authenticated TO authenticator;

-- 2. Create Auth Schema & Mock auth.users Table
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create auth.uid() Function (Mimics Supabase JWT Extraction)
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    ((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))
  )::uuid;
$$;

-- 4. Schema Permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, authenticator, palmora_worker;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, authenticator, palmora_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.users TO authenticated, authenticator, palmora_worker;
