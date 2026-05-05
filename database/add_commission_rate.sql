-- Add commission_rate column to users table
-- Default 10% for all existing users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10;
