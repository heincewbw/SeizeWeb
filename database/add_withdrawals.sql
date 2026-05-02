-- ============================================================
-- Migration: Add withdrawals table (auto-detected from MT4 history)
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ─── Withdrawals ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mt4_account_id  UUID NOT NULL REFERENCES mt4_accounts(id) ON DELETE CASCADE,
  ticket          BIGINT NOT NULL,
  amount          DECIMAL(18,2) NOT NULL,   -- absolute value (positive)
  currency        TEXT NOT NULL DEFAULT 'USD',
  type            TEXT NOT NULL DEFAULT 'withdrawal'
                    CHECK (type IN ('withdrawal', 'transfer')),
  comment         TEXT,
  close_time      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'detected'
                    CHECK (status IN ('detected', 'verified', 'rejected')),
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mt4_account_id, ticket)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id    ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status      ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at  ON withdrawals(created_at DESC);

-- updated_at trigger
CREATE OR REPLACE TRIGGER trg_withdrawals_updated_at
  BEFORE UPDATE ON withdrawals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

