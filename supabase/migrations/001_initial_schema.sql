-- Palmora AI Supabase PostgreSQL Schema
-- Includes Row-Level Security (RLS) policies, indexes, and privacy retention controls

-- 1. Profiles Table
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

-- 2. Palm Analyses Table (Structured measurements only - no raw biometric blobs)
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

-- 3. Readings Table
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

-- 4. Subscriptions & Entitlements
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

-- 5. Usage & Privacy-Conscious Telemetry
CREATE TABLE IF NOT EXISTS public.usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performant lookup
CREATE INDEX IF NOT EXISTS idx_palm_analyses_user_id ON public.palm_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_readings_user_id ON public.readings(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_name ON public.usage_events(event_name);

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.palm_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can select and update their own profile only
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Palm Analyses: Users can view and delete their own analyses
CREATE POLICY "Users can view own palm analyses"
    ON public.palm_analyses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own palm analyses"
    ON public.palm_analyses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own palm analyses"
    ON public.palm_analyses FOR DELETE
    USING (auth.uid() = user_id);

-- Readings: Users can manage their own readings
CREATE POLICY "Users can view own readings"
    ON public.readings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own readings"
    ON public.readings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own readings"
    ON public.readings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own readings"
    ON public.readings FOR DELETE
    USING (auth.uid() = user_id);

-- Subscriptions: Users can view own subscription entitlements
CREATE POLICY "Users can view own subscriptions"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Usage Events: Authorized inserts
CREATE POLICY "Users can record usage events"
    ON public.usage_events FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
