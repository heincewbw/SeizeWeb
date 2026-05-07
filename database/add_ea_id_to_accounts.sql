-- Add ea_id column to mt4_accounts to link each account to an Expert Advisor
ALTER TABLE mt4_accounts
  ADD COLUMN IF NOT EXISTS ea_id UUID REFERENCES expert_advisors(id) ON DELETE SET NULL;

-- Assign all existing accounts to Seize EA
UPDATE mt4_accounts
SET ea_id = (SELECT id FROM expert_advisors WHERE name = 'Seize' LIMIT 1)
WHERE ea_id IS NULL;
