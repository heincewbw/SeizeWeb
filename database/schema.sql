-- ============================================================
-- SeizeWeb Database Schema (Supabase / PostgreSQL)
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  role            TEXT NOT NULL DEFAULT 'investor' CHECK (role IN ('investor', 'admin')),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── MT4 Accounts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mt4_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login           TEXT NOT NULL,
  server          TEXT NOT NULL,
  broker          TEXT,
  account_name    TEXT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  leverage        INTEGER DEFAULT 100,
  balance         DECIMAL(18,2) DEFAULT 0,
  equity          DECIMAL(18,2) DEFAULT 0,
  margin          DECIMAL(18,2) DEFAULT 0,
  free_margin     DECIMAL(18,2) DEFAULT 0,
  profit          DECIMAL(18,2) DEFAULT 0,
  is_connected    BOOLEAN DEFAULT FALSE,
  last_synced     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, login, server)
);

-- ─── Trade History ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mt4_account_id  UUID NOT NULL REFERENCES mt4_accounts(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket          BIGINT NOT NULL,
  symbol          TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('BUY', 'SELL', 'BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP', 'BALANCE', 'CREDIT')),
  lots            DECIMAL(10,2),
  open_price      DECIMAL(18,5),
  close_price     DECIMAL(18,5),
  stop_loss       DECIMAL(18,5) DEFAULT 0,
  take_profit     DECIMAL(18,5) DEFAULT 0,
  profit          DECIMAL(18,2) DEFAULT 0,
  commission      DECIMAL(18,2) DEFAULT 0,
  swap            DECIMAL(18,2) DEFAULT 0,
  open_time       TIMESTAMPTZ,
  close_time      TIMESTAMPTZ,
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mt4_account_id, ticket)
);

-- ─── Equity Snapshots (for charts) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equity_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mt4_account_id  UUID NOT NULL REFERENCES mt4_accounts(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance         DECIMAL(18,2),
  equity          DECIMAL(18,2),
  profit          DECIMAL(18,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mt4_accounts_user_id ON mt4_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_user_id ON trade_history(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_account_id ON trade_history(mt4_account_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_close_time ON trade_history(close_time DESC);
CREATE INDEX IF NOT EXISTS idx_equity_snapshots_account_id ON equity_snapshots(mt4_account_id);
CREATE INDEX IF NOT EXISTS idx_equity_snapshots_created_at ON equity_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── Updated_at Trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_mt4_accounts_updated_at
  BEFORE UPDATE ON mt4_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security (RLS) ─────────────────────────────────────────────────
-- Enable RLS (backend uses service key which bypasses RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt4_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE equity_snapshots ENABLE ROW LEVEL SECURITY;

-- Note: The backend uses the SERVICE ROLE key which bypasses RLS.
-- These policies are for any direct client access (e.g., Supabase JS client from frontend).
-- Since our frontend goes through the backend API, RLS is mainly a safety net.

CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own accounts" ON mt4_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own trade history" ON trade_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own snapshots" ON equity_snapshots
  FOR SELECT USING (auth.uid() = user_id);
