# Aether Labs Crypto Scanner

**Multi-timeframe setup detection engine for CEX and leverage traders.**

The Aether Labs Crypto Scanner is a production-grade platform that automatically detects retail-recognizable technical setups across multiple cryptocurrencies and timeframes. It combines real-time data ingestion from Binance Futures with sophisticated pattern recognition algorithms to flag high-probability trading opportunities.

## 🎯 Product Vision

Think of this as a **TradingView screener powered by algorithmic pattern detection**. It automates what skilled retail traders do manually—spotting break-and-retests, liquidity sweeps, momentum breakouts, and indicator bounces—then surfaces those opportunities instantly with confidence scores and actionable context.

### Target Users

- CEX leverage traders
- Swing traders
- Technical analysis practitioners
- Trading teams and groups

### Freemium Model (Planned)

- **Free Tier**: Ad-supported with delayed signals
- **Premium Tier**: Real-time feed, Discord/push alerts, team setups, custom strategies

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Binance Futures API                       │
│           (WebSocket Streams + REST Backfill)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    apps/ingestor                             │
│  • WebSocket combined streams (15m, 1h, 4h, 1d)             │
│  • Automatic gap backfill with exponential backoff           │
│  • Upsert to Postgres (500+ bars per symbol/TF)             │
│  • Health logging every 60s                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  • symbols table                                             │
│  • candles_15m, candles_1h, candles_4h, candles_1d          │
│  • signals table with meta jsonb                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     apps/engine                              │
│  • Bar-close aligned evaluation loops                        │
│  • 5 retail-grade pattern detectors                          │
│  • Deduplication (3-bar debounce)                            │
│  • Signal strength scoring (0.0-1.0)                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─────────► PostgreSQL (signals table)
                     │
                     └─────────► Redis PubSub
                                 (signals:<symbol>:<tf>)
```

---

## 🎨 Trading Setups Detected

The engine evaluates **5 retail-grade patterns** designed to match what experienced traders spot on charts:

### 1. **Support/Resistance Break & Retest**
Detects when price breaks a swing high/low, then retests it from the other side.

**Signal:** `break_retest`
**Strength:** Based on retest quality and distance from level
**Meta:** `{ direction, level, breakBar, retestBar }`

### 2. **Range High/Low Sweep (Turtle Soup)**
Identifies liquidity grabs—when price sweeps a range extreme with a long wick, then reverses.

**Signal:** `sweep`
**Strength:** Based on wick ratio (60-65%+)
**Meta:** `{ direction, rangeHigh/rangeLow, sweepPrice, wickRatio }`

### 3. **EMA Trend Alignment**
Confirms strong trends when EMA 20, 50, and 200 align properly with price above/below.

**Signal:** `ema_trend`
**Strength:** Based on EMA separation
**Meta:** `{ direction, ema20, ema50, ema200, separation }`

### 4. **RSI Bounce**
Detects momentum reversals when RSI bounces from oversold (<30) or overbought (>70) zones.

**Signal:** `rsi_bounce`
**Strength:** Based on RSI extreme and bounce magnitude
**Meta:** `{ direction, rsi, prevRsi, threshold }`

### 5. **Breakout + Volume Spike**
Flags range breakouts confirmed by 1.5-2x volume spikes.

**Signal:** `breakout_volume`
**Strength:** Based on volume ratio and breakout size
**Meta:** `{ direction, volumeRatio, rangeHigh/rangeLow, breakoutPrice, breakoutPct }`

---

## 📋 Requirements

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Docker** and **Docker Compose** (for local Postgres + Redis)

---

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repo-url>
cd oracle-crypto
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings (defaults work for local dev):

```env
# Postgres
PGHOST=localhost
PGPORT=5432
PGUSER=scanner
PGPASSWORD=scanner_password
PGDATABASE=crypto_scanner

# Redis
REDIS_URL=redis://localhost:6379

# Scanner Config
UNIVERSE=BTCUSDT,ETHUSDT,SOLUSDT,BONKUSDT,POPCATUSDT
EXCHANGE=binance_perp

# Binance Futures
BINANCE_FUTURES_WS=wss://fstream.binance.com/stream
BINANCE_FUTURES_HTTP=https://fapi.binance.com

# Observability
LOG_LEVEL=info
```

### 3. Start Infrastructure

```bash
pnpm docker:up
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379

### 4. Run Migrations

```bash
pnpm migrate
```

Creates tables:
- `symbols` (BTCUSDT, ETHUSDT, SOLUSDT, BONKUSDT, POPCATUSDT)
- `candles_15m`, `candles_1h`, `candles_4h`, `candles_1d`
- `signals` with indexes

### 5. Start the Scanner

**Terminal 1 - Ingestor:**
```bash
pnpm dev:ingestor
```

Logs:
```json
{"level":"info","module":"ingestor","event":"initial_backfill_start",...}
{"level":"info","module":"ingestor","event":"initial_backfill_complete",...}
{"level":"info","module":"ingestor","event":"ws_connected",...}
```

**Terminal 2 - Engine:**
```bash
pnpm dev:engine
```

Logs:
```json
{"level":"info","module":"engine","event":"starting",...}
{"level":"info","module":"engine","tf":"15m","event":"schedule_evaluation",...}
{"level":"info","module":"engine","event":"signal_emitted","symbol":"BTCUSDT","rule":"ema_trend",...}
```

---

## ✅ Verification & Health Checks

### Check Candle Ingestion

```bash
# Terminal 3
psql -h localhost -U scanner -d crypto_scanner
```

```sql
-- Count candles per symbol
SELECT symbol, COUNT(*) FROM candles_15m GROUP BY symbol;
SELECT symbol, COUNT(*) FROM candles_1h GROUP BY symbol;
SELECT symbol, COUNT(*) FROM candles_4h GROUP BY symbol;
SELECT symbol, COUNT(*) FROM candles_1d GROUP BY symbol;

-- View most recent candles
SELECT symbol, ts, close FROM candles_15m
WHERE symbol = 'BTCUSDT'
ORDER BY ts DESC LIMIT 10;
```

**Expected:** 100-500+ candles per symbol per timeframe after initial backfill.

### Check Signals

```sql
-- View recent signals
SELECT rule, symbol, tf, strength, ts, meta
FROM signals
ORDER BY ts DESC LIMIT 20;

-- Count signals by rule
SELECT rule, COUNT(*) FROM signals GROUP BY rule;
```

**Example Signal Row:**
```
rule  | symbol   | tf  | strength | ts                  | meta
------|----------|-----|----------|---------------------|------------------
ema_trend | BTCUSDT | 1h | 0.72 | 2025-01-15 14:00:00 | {"direction":"bullish","ema20":43250.5,...}
```

### Monitor Redis PubSub

```bash
# Terminal 4
redis-cli
> SUBSCRIBE signals:BTCUSDT:15m
> SUBSCRIBE signals:*:1h
```

**Example Message:**
```json
{
  "symbol": "ETHUSDT",
  "tf": "1h",
  "rule": "break_retest",
  "strength": 0.68,
  "ts": "2025-01-15T14:00:00.000Z",
  "meta": {
    "direction": "bullish",
    "level": 2450.80,
    "breakBar": 3,
    "retestBar": 8
  }
}
```

### Health Logs

Ingestor logs health every 60s:
```json
{
  "level":"info",
  "module":"ingestor",
  "event":"health",
  "details":{
    "processedBars":127,
    "activeStreams":20,
    "lastCandles":{
      "BTCUSDT:15m":"2025-01-15T14:15:00.000Z",
      "ETHUSDT:1h":"2025-01-15T14:00:00.000Z"
    }
  }
}
```

Engine logs stats every 5 minutes:
```json
{
  "level":"info",
  "module":"engine",
  "event":"stats",
  "details":{
    "processedBars":48,
    "signalsEmitted":12
  }
}
```

---

## 🧪 Testing & Acceptance Criteria

### ✅ After Startup + A Few Bars

1. **Database has recent candles** for all 5 symbols × 4 TFs with no gaps
   - Run: `SELECT symbol, COUNT(*) FROM candles_15m GROUP BY symbol;`
   - Expect: 100+ rows per symbol

2. **On real bar close, rules emit signals**
   - Monitor logs for `"event":"signal_emitted"`
   - Check Redis: `SUBSCRIBE signals:*:*`

3. **No duplicate signals** for same (symbol, tf, rule, ts)
   - Run: `SELECT symbol, tf, rule, ts, COUNT(*) FROM signals GROUP BY symbol, tf, rule, ts HAVING COUNT(*) > 1;`
   - Expect: 0 rows

### Manual Validation

Pick a signal and verify on TradingView:
1. Query: `SELECT * FROM signals WHERE rule = 'ema_trend' AND symbol = 'BTCUSDT' LIMIT 1;`
2. Note the timestamp and meta
3. Open TradingView → BTCUSDT → Match timeframe
4. Confirm EMA alignment at that timestamp

---

## 📦 Project Structure

```
oracle-crypto/
├── apps/
│   ├── ingestor/           # Data ingestion service
│   │   ├── src/
│   │   │   ├── index.ts    # Main entry
│   │   │   ├── stream.ts   # WebSocket manager
│   │   │   ├── backfill.ts # Gap filling logic
│   │   │   └── db.ts       # Database client
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── engine/             # Rule evaluation engine
│       ├── src/
│       │   ├── index.ts          # Main evaluation loop
│       │   ├── db.ts             # Database client
│       │   ├── publisher.ts      # Redis publisher
│       │   ├── deduplicator.ts   # Signal deduplication
│       │   ├── indicators.ts     # EMA, RSI, ATR, etc.
│       │   └── rules/
│       │       ├── break-retest.ts
│       │       ├── sweep.ts
│       │       ├── ema-trend.ts
│       │       ├── rsi-bounce.ts
│       │       ├── breakout-volume.ts
│       │       └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/             # Shared types and utilities
│       ├── src/
│       │   ├── types.ts    # Candle, Signal, Config types
│       │   ├── logger.ts   # Structured JSON logger
│       │   ├── config.ts   # Environment config
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── migrations/
│   └── 001_initial_schema.sql
├── scripts/
│   └── migrate.js
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 🔧 Development Commands

```bash
# Install dependencies
pnpm install

# Start all services in dev mode (parallel)
pnpm dev

# Start individual services
pnpm dev:ingestor
pnpm dev:engine

# Build for production
pnpm build

# Run migrations
pnpm migrate

# Docker commands
pnpm docker:up
pnpm docker:down

# Clean all build artifacts
pnpm clean
```

---

## 📊 Observability

All logs are **structured JSON** with consistent schema:

```json
{
  "level": "info|error|warn|debug",
  "module": "ingestor|engine",
  "symbol": "BTCUSDT",
  "tf": "15m",
  "event": "signal_emitted",
  "ts": "2025-01-15T14:00:00.000Z",
  "details": { ... }
}
```

### Key Events

**Ingestor:**
- `initial_backfill_start` / `initial_backfill_complete`
- `ws_connected` / `ws_closed` / `ws_error`
- `reconnecting` (with attempt count and delay)
- `candle_closed` (debug level)
- `health` (every 60s)

**Engine:**
- `starting` / `running` / `shutdown`
- `schedule_evaluation` (per timeframe)
- `evaluation_start` / `evaluation_complete`
- `signal_emitted` (with rule, strength, meta)
- `signal_deduplicated`
- `stats` (every 5 minutes)

---

## 🚨 Error Handling

### Ingestor
- **WebSocket disconnect**: Reconnects with exponential backoff (max 60s)
- **Gap detection**: Automatic backfill on reconnect
- **Binance rate limits**: 100ms delay between backfill requests
- **Network errors**: Logged, retried on next cycle

### Engine
- **Insufficient data**: Skips evaluation, logs warning
- **Rule evaluation errors**: Caught per-rule, logged, continues
- **Database errors**: Logged, retried on next cycle
- **Redis errors**: Logged, continues (signals still written to DB)

---

## 🎯 Timeframe-Specific Thresholds

Each rule adapts parameters per timeframe to match realistic trading contexts:

| Timeframe | Volume Multiple | Range Break % | Retest Bars | Debounce |
|-----------|----------------|---------------|-------------|----------|
| **15m**   | 2.0x           | 2.0%          | 8 bars      | 3 bars   |
| **1h**    | 1.8x           | 2.5%          | 6 bars      | 3 bars   |
| **4h**    | 1.5x           | 3.0%          | 5 bars      | 3 bars   |
| **1d**    | 1.5x           | 3.5%          | 4 bars      | 3 bars   |

---

## 🛣️ Roadmap

### Phase 1: Foundation ✅ (Current)
- [x] Data layer with WebSocket + backfill
- [x] 5 retail-grade pattern detectors
- [x] Signal deduplication and scoring
- [x] PostgreSQL + Redis pipeline

### Phase 2: API & Dashboard
- [ ] REST API for signal querying
- [ ] WebSocket API for real-time signal feed
- [ ] React dashboard with TradingView charts
- [ ] User authentication and API keys

### Phase 3: Freemium Features
- [ ] Free tier with delayed signals
- [ ] Premium tier with real-time alerts
- [ ] Discord webhook integration
- [ ] Push notifications (mobile)

### Phase 4: Advanced Detection
- [ ] Custom strategy builder (UI)
- [ ] Machine learning signal scoring
- [ ] Multi-asset correlation analysis
- [ ] Backtesting engine

### Phase 5: Marketplace
- [ ] Community strategy sharing
- [ ] "Aether Labs Signals" pro team setups
- [ ] Performance tracking and leaderboards

---

## 🤝 Contributing

This is a proprietary Aether Labs project. Internal contributors should:

1. Create feature branches: `feat/<feature-name>`
2. Follow TypeScript best practices
3. Add structured logging for all events
4. Test locally with `pnpm dev`
5. Open PRs to `main` with screenshots

---

## 📄 License

Proprietary - Aether Labs

---

## 📞 Support

For issues, questions, or feature requests, contact the Aether Labs team.

---

**Aether Labs Crypto Scanner** — *Algorithmic Edge Detection for Leverage Traders*
