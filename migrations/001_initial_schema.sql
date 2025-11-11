-- Symbols table
CREATE TABLE IF NOT EXISTS symbols (
  symbol TEXT PRIMARY KEY,
  base_asset TEXT NOT NULL,
  quote_asset TEXT NOT NULL,
  active BOOLEAN DEFAULT true
);

-- Candles tables for each timeframe
CREATE TABLE IF NOT EXISTS candles_15m (
  symbol TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC NOT NULL,
  trades INTEGER DEFAULT 0,
  PRIMARY KEY (symbol, ts)
);

CREATE TABLE IF NOT EXISTS candles_1h (
  symbol TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC NOT NULL,
  trades INTEGER DEFAULT 0,
  PRIMARY KEY (symbol, ts)
);

CREATE TABLE IF NOT EXISTS candles_4h (
  symbol TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC NOT NULL,
  trades INTEGER DEFAULT 0,
  PRIMARY KEY (symbol, ts)
);

CREATE TABLE IF NOT EXISTS candles_1d (
  symbol TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC NOT NULL,
  trades INTEGER DEFAULT 0,
  PRIMARY KEY (symbol, ts)
);

-- Signals table
CREATE TABLE IF NOT EXISTS signals (
  id BIGSERIAL PRIMARY KEY,
  rule TEXT NOT NULL,
  symbol TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  tf TEXT NOT NULL,
  strength NUMERIC NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for candles
CREATE INDEX IF NOT EXISTS candles_15m_symbol_ts_idx ON candles_15m (symbol, ts DESC);
CREATE INDEX IF NOT EXISTS candles_1h_symbol_ts_idx ON candles_1h (symbol, ts DESC);
CREATE INDEX IF NOT EXISTS candles_4h_symbol_ts_idx ON candles_4h (symbol, ts DESC);
CREATE INDEX IF NOT EXISTS candles_1d_symbol_ts_idx ON candles_1d (symbol, ts DESC);

-- Indexes for signals
CREATE INDEX IF NOT EXISTS signals_symbol_ts_idx ON signals (symbol, ts DESC);
CREATE INDEX IF NOT EXISTS signals_rule_ts_idx ON signals (rule, ts DESC);
CREATE INDEX IF NOT EXISTS signals_tf_ts_idx ON signals (tf, ts DESC);

-- Insert initial symbols
INSERT INTO symbols (symbol, base_asset, quote_asset, active)
VALUES
  ('BTCUSDT', 'BTC', 'USDT', true),
  ('ETHUSDT', 'ETH', 'USDT', true),
  ('SOLUSDT', 'SOL', 'USDT', true),
  ('BONKUSDT', 'BONK', 'USDT', true),
  ('POPCATUSDT', 'POPCAT', 'USDT', true)
ON CONFLICT (symbol) DO NOTHING;
