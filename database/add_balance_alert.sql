-- ============================================================
-- AceCapital – Balance Alert Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- balance_alert_sent_at : timestamp of last alert email sent (for 12h cooldown)
-- balance_was_below     : edge-trigger flag — TRUE while balance is below initial
ALTER TABLE mt4_accounts ADD COLUMN IF NOT EXISTS balance_alert_sent_at TIMESTAMPTZ;
ALTER TABLE mt4_accounts ADD COLUMN IF NOT EXISTS balance_was_below     BOOLEAN NOT NULL DEFAULT FALSE;
