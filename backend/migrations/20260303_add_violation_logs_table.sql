-- Migration: Create violation_logs table for storing proctoring violation evidence
-- Date: 2026-03-03

-- Add violation_count column to exam_sessions
ALTER TABLE exam_sessions
ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'violation_logs'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_partitioned_table p
        JOIN pg_class c ON c.oid = p.partrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'violation_logs'
    ) THEN
        ALTER TABLE violation_logs RENAME TO violation_logs_legacy;
    END IF;
END $$;

-- Create partitioned violation_logs parent table
CREATE TABLE IF NOT EXISTS violation_logs (
    id UUID DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    violation_type VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    screenshot_path VARCHAR(500),
    video_clip_path VARCHAR(500),
    extra_data JSONB,
    PRIMARY KEY (institute_id, id),
    FOREIGN KEY (institute_id, session_id)
        REFERENCES exam_sessions(institute_id, id)
        ON DELETE CASCADE
) PARTITION BY LIST (institute_id);

-- Default partition catches institutes without explicit partition
CREATE TABLE IF NOT EXISTS violation_logs_default
PARTITION OF violation_logs DEFAULT;

-- Migrate legacy rows if an old non-partitioned table existed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'violation_logs_legacy'
    ) THEN
        INSERT INTO violation_logs (id, institute_id, session_id, violation_type, timestamp, screenshot_path, video_clip_path, extra_data)
        SELECT id, institute_id, session_id, violation_type, timestamp, screenshot_path, video_clip_path, extra_data
        FROM violation_logs_legacy
        ON CONFLICT (institute_id, id) DO NOTHING;
    END IF;
END $$;

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_violation_logs_session ON violation_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_violation_logs_institute ON violation_logs(institute_id);
CREATE INDEX IF NOT EXISTS idx_violation_logs_type ON violation_logs(violation_type);
CREATE INDEX IF NOT EXISTS idx_violation_logs_timestamp ON violation_logs(timestamp);

-- Composite index for session + type queries
CREATE INDEX IF NOT EXISTS idx_violation_logs_session_type ON violation_logs(session_id, violation_type);
