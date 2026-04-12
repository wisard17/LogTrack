-- 001_init_logbook_schema.sql

-- Optional extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================
-- Table: grup
-- =========================
CREATE TABLE IF NOT EXISTS grup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- Table: mahasiswa
-- =========================
CREATE TABLE IF NOT EXISTS mahasiswa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  grup_id UUID NULL REFERENCES grup(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mahasiswa_grup_id ON mahasiswa(grup_id);
CREATE INDEX IF NOT EXISTS idx_mahasiswa_email ON mahasiswa(email);

-- =========================
-- Table: logbook
-- =========================
CREATE TABLE IF NOT EXISTS logbook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number INT NOT NULL CHECK (week_number >= 1 AND week_number <= 52),
  description TEXT NOT NULL,
  evidence_url TEXT NOT NULL,
  evidence_name VARCHAR(255),
  evidence_type VARCHAR(100),
  mahasiswa_id UUID NOT NULL REFERENCES mahasiswa(id) ON DELETE CASCADE,
  grup_id UUID NOT NULL REFERENCES grup(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logbook_mahasiswa_id ON logbook(mahasiswa_id);
CREATE INDEX IF NOT EXISTS idx_logbook_grup_id ON logbook(grup_id);
CREATE INDEX IF NOT EXISTS idx_logbook_week_number ON logbook(week_number);
CREATE INDEX IF NOT EXISTS idx_logbook_created_at ON logbook(created_at DESC);

-- Prevent duplicate weekly entry by same student
CREATE UNIQUE INDEX IF NOT EXISTS uq_logbook_mahasiswa_week
  ON logbook(mahasiswa_id, week_number);
