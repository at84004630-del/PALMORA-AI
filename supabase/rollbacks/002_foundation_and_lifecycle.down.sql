-- Palmora AI Rollback Script
-- Migration: 002_foundation_and_lifecycle.down.sql
-- Path: supabase/rollbacks/002_foundation_and_lifecycle.down.sql
-- Description: Reverts changes made by 002_foundation_and_lifecycle.sql
-- Note: Kept in supabase/rollbacks/ to prevent Supabase CLI from executing rollback as forward migration.

-- 1. Drop trigger and function
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Drop tables created in migration 002
DROP TABLE IF EXISTS public.account_deletion_queue CASCADE;
DROP TABLE IF EXISTS public.revoked_tokens CASCADE;
DROP TABLE IF EXISTS public.claimed_guest_sessions CASCADE;
