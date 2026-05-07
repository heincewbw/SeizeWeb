-- ============================================================
-- Expert Advisors catalog
-- ============================================================

CREATE TABLE IF NOT EXISTS expert_advisors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  tagline         TEXT,
  description     TEXT,
  myfxbook_url    TEXT,
  widget_url      TEXT,
  widget_link     TEXT,
  tracking_start  DATE,
  tags            TEXT[] DEFAULT ARRAY[]::TEXT[],
  status          TEXT NOT NULL DEFAULT 'Available',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eas_active ON expert_advisors(is_active);

-- Seed Seize EA
INSERT INTO expert_advisors (name, tagline, description, myfxbook_url, widget_url, widget_link, tracking_start, tags, status, sort_order)
VALUES (
  'Seize',
  'Smart momentum capture EA',
  'Seize is a multi-strategy expert advisor designed to capture momentum across major forex pairs with disciplined risk management.',
  'https://www.myfxbook.com/portfolio/seize/11734037',
  'https://widget.myfxbook.com/widget/widget.png?accountOid=11734037&type=5',
  'https://www.myfxbook.com/members/Slashes/seize/11734037',
  '2025-10-15',
  ARRAY['Forex', 'Momentum', 'Multi-Pair'],
  'Available',
  0
)
ON CONFLICT DO NOTHING;
