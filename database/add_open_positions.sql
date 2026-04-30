-- ─── Open Positions ──────────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor to add the open_positions table
CREATE TABLE IF NOT EXISTS open_positions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mt4_account_id  UUID NOT NULL REFERENCES mt4_accounts(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket          BIGINT NOT NULL,
  symbol          TEXT NOT NULL,
  type            TEXT NOT NULL,
  lots            DECIMAL(10,2),
  open_price      DECIMAL(18,5),
  current_price   DECIMAL(18,5),
  stop_loss       DECIMAL(18,5) DEFAULT 0,
  take_profit     DECIMAL(18,5) DEFAULT 0,
  profit          DECIMAL(18,2) DEFAULT 0,
  swap            DECIMAL(18,2) DEFAULT 0,
  open_time       TIMESTAMPTZ,
  comment         TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mt4_account_id, ticket)
);

CREATE INDEX IF NOT EXISTS idx_open_positions_account_id ON open_positions(mt4_account_id);
CREATE INDEX IF NOT EXISTS idx_open_positions_user_id ON open_positions(user_id);

ALTER TABLE open_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own positions" ON open_positions
  FOR SELECT USING (auth.uid() = user_id);
