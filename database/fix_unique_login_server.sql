-- ============================================================
-- Migration: enforce UNIQUE(login, server) across all users
-- Prevents the same MT4 account from being registered under
-- multiple investors.
-- ============================================================

-- Step 1: For every (login, server) pair that has duplicates,
-- keep the row with the highest balance (most data), delete the rest.
DELETE FROM mt4_accounts
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY login, server
             ORDER BY balance DESC, equity DESC, created_at ASC
           ) AS rn
    FROM mt4_accounts
  ) ranked
  WHERE rn > 1
);

-- Step 2: Drop the old unique constraint
ALTER TABLE mt4_accounts
  DROP CONSTRAINT IF EXISTS mt4_accounts_user_id_login_server_key;

-- Step 3: Add new global unique constraint (login+server must be unique across all users)
ALTER TABLE mt4_accounts
  ADD CONSTRAINT mt4_accounts_login_server_key UNIQUE (login, server);
