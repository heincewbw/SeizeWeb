-- Add VPS & provider info fields to mt4_accounts
ALTER TABLE mt4_accounts
  ADD COLUMN IF NOT EXISTS nama_provider TEXT,
  ADD COLUMN IF NOT EXISTS ip_vps        TEXT,
  ADD COLUMN IF NOT EXISTS email_vps     TEXT,
  ADD COLUMN IF NOT EXISTS email_exness  TEXT;
