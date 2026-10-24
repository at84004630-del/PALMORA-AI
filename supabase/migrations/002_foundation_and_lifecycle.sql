-- Palmora AI Database Foundation & Lifecycle Extension
-- Migration: 002_foundation_and_lifecycle.sql
-- Applies to: Public Schema (Supabase PostgreSQL)
-- Description:
--   1. Automated profile creation trigger on auth.users (SECURITY DEFINER with safe search_path)
--   2. claimed_guest_sessions table for atomic, replay-resistant guest claims
--   3. revoked_tokens table for durable token revocation across workers and restarts
--   4. account_deletion_queue table for durable deletion state machine surviving profile purges
--   5. Least-privilege grants for authenticated role

-- 1. Automated Profile Creation Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        new.id,
        coalesce(new.email, ''),
        coalesce(new.raw_user_meta_data->>'display_name', 'Seeker')
    );
    RETURN new;
END;
$$;

-- Conditionally attach trigger to auth.users if auth schema is present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
END;
$$;

-- 2. Claimed Guest Sessions Table (Prevents replay and concurrent double-claiming)
CREATE TABLE IF NOT EXISTS public.claimed_guest_sessions (
    guest_session_id TEXT PRIMARY KEY,
    claimed_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.claimed_guest_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claimed guest sessions"
    ON public.claimed_guest_sessions FOR SELECT
    USING (auth.uid() = claimed_by_user_id);

CREATE POLICY "Users can insert own claimed guest sessions"
    ON public.claimed_guest_sessions FOR INSERT
    WITH CHECK (auth.uid() = claimed_by_user_id);

CREATE INDEX IF NOT EXISTS idx_claimed_guest_sessions_user_id
    ON public.claimed_guest_sessions(claimed_by_user_id);

-- 3. Durable Revoked Tokens Table (Synchronizes revocations across workers and restarts)
CREATE TABLE IF NOT EXISTS public.revoked_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id UUID,
    expires_at TIMESTAMPTZ NOT NULL,
    revocation_type TEXT NOT NULL CHECK (revocation_type IN ('token', 'session', 'guest_claim')),
    revoked_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.revoked_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own revoked tokens"
    ON public.revoked_tokens FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own revoked tokens"
    ON public.revoked_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at
    ON public.revoked_tokens(expires_at);

-- 4. Durable Account Deletion Queue Table (State machine surviving profile purges)
-- CRITICAL ARCHITECTURAL DECISION:
-- user_id does NOT reference public.profiles(id) ON DELETE CASCADE.
-- This guarantees that when public.profiles is purged, this queue record survives.
CREATE TABLE IF NOT EXISTS public.account_deletion_queue (
    user_id UUID PRIMARY KEY,
    email_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'db_purged', 'completed', 'failed')),
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 5,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.account_deletion_queue ENABLE ROW LEVEL SECURITY;

-- Regular API users connecting as authenticated may ONLY insert their own deletion request
CREATE POLICY "Users can queue own deletion"
    ON public.account_deletion_queue FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Explicitly deny regular users from viewing or modifying other deletion records
-- The background deletion worker queries this table using a dedicated worker connection
CREATE INDEX IF NOT EXISTS idx_deletion_queue_status_retry
    ON public.account_deletion_queue(status, retry_count);

-- 5. Least-Privilege Grants for Authenticated Role
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.palm_analyses TO authenticated;
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.readings TO authenticated;
        GRANT SELECT ON public.subscriptions TO authenticated;
        GRANT INSERT ON public.usage_events TO authenticated;
        GRANT SELECT, INSERT ON public.claimed_guest_sessions TO authenticated;
        GRANT SELECT, INSERT ON public.revoked_tokens TO authenticated;
        GRANT INSERT ON public.account_deletion_queue TO authenticated;
    END IF;
END;
$$;
