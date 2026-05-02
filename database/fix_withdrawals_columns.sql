-- ============================================================
-- Migration: Add missing columns to withdrawals table
-- Run this in the Supabase SQL Editor if withdrawals table
-- was created without ticket, type, comment, close_time columns
-- ============================================================

ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS ticket     BIGINT,
  ADD COLUMN IF NOT EXISTS type       TEXT NOT NULL DEFAULT 'withdrawal',
  ADD COLUMN IF NOT EXISTS comment    TEXT,
  ADD COLUMN IF NOT EXISTS close_time TIMESTAMPTZ;

-- Add CHECK constraint on type (only if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'withdrawals_type_check' AND conrelid = 'withdrawals'::regclass
  ) THEN
    ALTER TABLE withdrawals
      ADD CONSTRAINT withdrawals_type_check CHECK (type IN ('withdrawal', 'transfer'));
  END IF;
END $$;

-- Unique index on (mt4_account_id, ticket) — partial, only for non-null ticket
-- This allows existing rows with NULL ticket and ensures uniqueness for MT4 rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_account_ticket
  ON withdrawals(mt4_account_id, ticket)
  WHERE ticket IS NOT NULL;
