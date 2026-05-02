-- ============================================================
-- Migration: Add initial_balance to mt4_accounts
-- Run this in the Supabase SQL Editor
-- ============================================================

ALTER TABLE mt4_accounts
  ADD COLUMN IF NOT EXISTS initial_balance DECIMAL(18,2) DEFAULT 0;
