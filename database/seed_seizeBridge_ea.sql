-- Seed SeizeBridge EA (MT5)
INSERT INTO expert_advisors (
  name,
  tagline,
  description,
  status,
  is_active,
  sort_order,
  tags
)
VALUES (
  'SeizeBridge',
  'Multi-pair hedging. Built for MT5.',
  'SeizeBridge brings the Intelligent Hedging Martingale strategy to MetaTrader 5, trading multiple pairs with precision.',
  'Available',
  true,
  1,
  ARRAY['Martingale', 'Hedging', 'MT5', 'Multi-Pair']
)
ON CONFLICT DO NOTHING;
