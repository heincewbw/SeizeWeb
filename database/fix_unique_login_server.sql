-- ============================================================
-- Migration: enforce UNIQUE(login, server) across all users
-- Prevents the same MT4 account from being registered under
-- multiple investors.
--
-- Run in Supabase SQL Editor BEFORE running this migration,
-- manually verify / clean up any remaining duplicates:
--
--   SELECT login, server, COUNT(*) FROM mt4_accounts
--   GROUP BY login, server HAVING COUNT(*) > 1;
-- ============================================================

-- Step 1: Delete the duplicate account under Magdalena (login=52244959, Exness-Real19)
-- Keep the one under Sean Ann (seanraf@gmail.com), remove the one under Magdalena.
DELETE FROM mt4_accounts
WHERE login = '52244959'
  AND server = 'Exness-Real19'
  AND user_id = (
    SELECT id FROM users WHERE email = 'magdalenasuluh@gmail.com'
  );

-- Step 2: Drop the old unique constraint
ALTER TABLE mt4_accounts
  DROP CONSTRAINT IF EXISTS mt4_accounts_user_id_login_server_key;

-- Step 3: Add new global unique constraint (login+server must be unique across all users)
ALTER TABLE mt4_accounts
  ADD CONSTRAINT mt4_accounts_login_server_key UNIQUE (login, server);
