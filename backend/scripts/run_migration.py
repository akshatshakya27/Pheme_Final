"""Run migration to add violation_logs table and violation_count column."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import engine

with engine.connect() as conn:
    # 1️⃣ Add violation_count column
    conn.execute(text("""
        ALTER TABLE exam_sessions
        ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0
    """))

    # 2️⃣ If an old non-partitioned violation_logs exists, preserve it as legacy
    conn.execute(text("""
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
    """))

    # 3️⃣ Create partitioned violation_logs parent table
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS violation_logs (
            id UUID DEFAULT gen_random_uuid(),
            institute_id UUID NOT NULL,
            session_id UUID NOT NULL,
            violation_type VARCHAR(100) NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            screenshot_path VARCHAR(500),
            video_clip_path VARCHAR(500),
            extra_data JSONB,

            PRIMARY KEY (institute_id, id),
            FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,

            FOREIGN KEY (institute_id, session_id)
                REFERENCES exam_sessions(institute_id, id)
                ON DELETE CASCADE
        )
        PARTITION BY LIST (institute_id)
    """))

    # 4️⃣ Default partition catches institutes without explicit partition table
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS violation_logs_default
        PARTITION OF violation_logs DEFAULT
    """))

    # 5️⃣ Move data from legacy table if present
    conn.execute(text("""
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
    """))

    # 6️⃣ Index for faster session lookup
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_violation_logs_session
        ON violation_logs(session_id)
    """))

    conn.commit()
    print("Migration completed successfully!")