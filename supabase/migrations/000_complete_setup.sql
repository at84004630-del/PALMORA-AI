-- ==============================================================================
-- Palmora AI - Complete Unified Production Database Schema
-- File: supabase/migrations/000_complete_setup.sql
-- ==============================================================================
-- Run this script in the Supabase SQL Editor for project `nimortcehqbgknbfgkkt`
-- It sets up:
--   1. Core Tables: profiles, palm_analyses, readings, subscriptions, usage_events
--   2. Performance Indexes & Row-Level Security (RLS) policies
--   3. Automated user registration trigger (`handle_new_user`)
--   4. Replay-resistant guest claiming (`claimed_guest_sessions`)
--   5. Durable token revocation (`revoked_tokens`)
--   6. Durable account deletion queue (`account_deletion_queue` for GDPR/CCPA)
--   7. Least-privilege Grants for `authenticated` role
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Core Application Tables
-- ------------------------------------------------------------------------------

-- 1.1 Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT DEFAULT 'Seeker',
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium_report', 'dual_hand', 'membership')),
    readings_quota INT DEFAULT 1,
    retention_policy TEXT DEFAULT 'ephemeral_only' CHECK (retention_policy IN ('ephemeral_only', 'save_readings_anonymized', 'save_readings_with_images')),
    consent_given_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Palm Analyses Table (Structured measurements only - no raw biometric images)
CREATE TABLE IF NOT EXISTS public.palm_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    quality_metrics JSONB NOT NULL,
    features JSONB NOT NULL,
    hand_side TEXT DEFAULT 'unknown',
    analysis_version TEXT DEFAULT '1.0',
    detector_model TEXT DEFAULT 'multiscale_crease_extractor_v1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 Readings Table (Supports both structured attributes and jsonb document storage)
CREATE TABLE IF NOT EXISTS public.readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    analysis_id UUID REFERENCES public.palm_analyses(id) ON DELETE SET NULL,
    reading_title TEXT DEFAULT 'Palmora Reading',
    features_analyzed TEXT[] DEFAULT '{}',
    love_reading JSONB DEFAULT '{}',
    career_reading JSONB DEFAULT '{}',
    personality_reading JSONB DEFAULT '{}',
    overall_synthesis TEXT DEFAULT '',
    generation_method TEXT DEFAULT 'grounded_cultural_library',
    is_free_tier BOOLEAN DEFAULT TRUE,
    is_saved BOOLEAN DEFAULT TRUE,
    data JSONB DEFAULT '{}',
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4 Subscriptions & Entitlements
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_tier TEXT NOT NULL CHECK (plan_tier IN ('free', 'premium_report', 'dual_hand', 'dual_hand_report', 'membership')),
    status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    billing_provider TEXT DEFAULT 'unconfigured',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5 Usage & Telemetry Events
CREATE TABLE IF NOT EXISTS public.usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. Indexes for High-Performance Queries
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_palm_analyses_user_id ON public.palm_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_readings_user_id ON public.readings(user_id);
CREATE INDEX IF NOT EXISTS idx_readings_created_at ON public.readings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_name ON public.usage_events(event_name);

-- ------------------------------------------------------------------------------
-- 3. Row-Level Security (RLS) Activation & Policies
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.palm_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Palm Analyses Policies
DROP POLICY IF EXISTS "Users can view own palm analyses" ON public.palm_analyses;
CREATE POLICY "Users can view own palm analyses"
    ON public.palm_analyses FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own palm analyses" ON public.palm_analyses;
CREATE POLICY "Users can insert own palm analyses"
    ON public.palm_analyses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own palm analyses" ON public.palm_analyses;
CREATE POLICY "Users can delete own palm analyses"
    ON public.palm_analyses FOR DELETE
    USING (auth.uid() = user_id);

-- Readings Policies (supports both auth.uid() and request.jwt.claim.sub)
DROP POLICY IF EXISTS "Users can view own readings" ON public.readings;
CREATE POLICY "Users can view own readings"
    ON public.readings FOR SELECT
    USING (
        auth.uid() = user_id OR
        user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
    );

DROP POLICY IF EXISTS "Users can insert own readings" ON public.readings;
CREATE POLICY "Users can insert own readings"
    ON public.readings FOR INSERT
    WITH CHECK (
        auth.uid() = user_id OR
        user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
    );

DROP POLICY IF EXISTS "Users can update own readings" ON public.readings;
CREATE POLICY "Users can update own readings"
    ON public.readings FOR UPDATE
    USING (
        auth.uid() = user_id OR
        user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
    );

DROP POLICY IF EXISTS "Users can delete own readings" ON public.readings;
CREATE POLICY "Users can delete own readings"
    ON public.readings FOR DELETE
    USING (
        auth.uid() = user_id OR
        user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
    );

-- Subscriptions Policies
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Usage Events Policies
DROP POLICY IF EXISTS "Users can record usage events" ON public.usage_events;
CREATE POLICY "Users can record usage events"
    ON public.usage_events FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ------------------------------------------------------------------------------
-- 4. Automated User Profile Trigger
-- ------------------------------------------------------------------------------
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
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$;

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

-- ------------------------------------------------------------------------------
-- 5. Claimed Guest Sessions Table (Prevents replay / concurrent double-claims)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claimed_guest_sessions (
    guest_session_id TEXT PRIMARY KEY,
    claimed_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.claimed_guest_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own claimed guest sessions" ON public.claimed_guest_sessions;
CREATE POLICY "Users can view own claimed guest sessions"
    ON public.claimed_guest_sessions FOR SELECT
    USING (auth.uid() = claimed_by_user_id);

DROP POLICY IF EXISTS "Users can insert own claimed guest sessions" ON public.claimed_guest_sessions;
CREATE POLICY "Users can insert own claimed guest sessions"
    ON public.claimed_guest_sessions FOR INSERT
    WITH CHECK (auth.uid() = claimed_by_user_id);

CREATE INDEX IF NOT EXISTS idx_claimed_guest_sessions_user_id
    ON public.claimed_guest_sessions(claimed_by_user_id);

-- ------------------------------------------------------------------------------
-- 6. Durable Revoked Tokens Table (Distributed token invalidation)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.revoked_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id UUID,
    expires_at TIMESTAMPTZ NOT NULL,
    revocation_type TEXT NOT NULL CHECK (revocation_type IN ('token', 'session', 'guest_claim')),
    revoked_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.revoked_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own revoked tokens" ON public.revoked_tokens;
CREATE POLICY "Users can view own revoked tokens"
    ON public.revoked_tokens FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert own revoked tokens" ON public.revoked_tokens;
CREATE POLICY "Users can insert own revoked tokens"
    ON public.revoked_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at
    ON public.revoked_tokens(expires_at);

-- ------------------------------------------------------------------------------
-- 7. Durable Account Deletion Queue (GDPR / CCPA Erasure State Machine)
-- ------------------------------------------------------------------------------
-- Note: user_id intentionally does NOT reference profiles(id) ON DELETE CASCADE
-- so that queue tracking persists even after profiles and readings are purged.
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

DROP POLICY IF EXISTS "Users can queue own deletion" ON public.account_deletion_queue;
CREATE POLICY "Users can queue own deletion"
    ON public.account_deletion_queue FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_deletion_queue_status_retry
    ON public.account_deletion_queue(status, retry_count);

-- ------------------------------------------------------------------------------
-- 8. Least-Privilege Grants for Authenticated Role
-- ------------------------------------------------------------------------------
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
