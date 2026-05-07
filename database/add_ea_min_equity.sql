-- Add min_equity field to expert_advisors
ALTER TABLE expert_advisors
  ADD COLUMN IF NOT EXISTS min_equity NUMERIC(14, 2) DEFAULT NULL;
