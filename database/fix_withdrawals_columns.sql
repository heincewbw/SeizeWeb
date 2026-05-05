-- ============================================================
-- Migration: Add missing columns to withdrawals table
-- Run this in the Supabase SQL Editor if withdrawals table
-- was created without ticket, type, comment, close_time columns
-- ============================================================

ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS ticket     BIGINT,
  ADD COLUMN IF NOT EXISTS comment    TEXT,
  ADD COLUMN IF NOT EXISTS close_time TIMESTAMPTZ;

-- Add type column safely (TEXT with default, no NOT NULL constraint during add)
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'withdrawal';
UPDATE withdrawals SET type = 'withdrawal' WHERE type IS NULL;

-- Fix status check constraint: drop old one (whatever values it had) and recreate
-- with the correct values used by the application: detected, verified, rejected
ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_status_check;
ALTER TABLE withdrawals
  ADD CONSTRAINT withdrawals_status_check CHECK (status IN ('detected', 'verified', 'rejected'));

-- Ensure status default is 'detected'
ALTER TABLE withdrawals ALTER COLUMN status SET DEFAULT 'detected';

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
