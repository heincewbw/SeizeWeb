-- Add total_investment_usd to expert_advisors table
ALTER TABLE expert_advisors
  ADD COLUMN IF NOT EXISTS total_investment_usd NUMERIC(14, 2) DEFAULT NULL;
