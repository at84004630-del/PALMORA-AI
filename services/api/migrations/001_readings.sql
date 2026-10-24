-- Palmora AI Migration: 001_readings.sql
-- Creates the readings table with Row Level Security (RLS) enforcement.

CREATE TABLE IF NOT EXISTS public.readings (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;

-- Owner isolation policy using transaction-scoped identity claim
CREATE POLICY readings_owner ON public.readings
    FOR ALL
    USING (user_id = current_setting('request.jwt.claim.sub', true)::UUID)
    WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true)::UUID);
