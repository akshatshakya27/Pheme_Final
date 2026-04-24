-- Migration: Create violation_logs table for storing individual violations with evidence
-- Run this migration after 20260228_partitioned_multitenant_schema.sql

-- Create the violation_logs table
CREATE TABLE IF NOT EXISTS violation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    violation_type VARCHAR(100) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    screenshot_path VARCHAR(500),
    video_clip_path VARCHAR(500),
    metadata JSONB
);

-- Add violation_count column to exam_sessions if not exists
ALTER TABLE exam_sessions
ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0;

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_violation_logs_session ON violation_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_violation_logs_institute ON violation_logs(institute_id);
CREATE INDEX IF NOT EXISTS idx_violation_logs_type ON violation_logs(violation_type);
CREATE INDEX IF NOT EXISTS idx_violation_logs_timestamp ON violation_logs(timestamp);
