# Oracle Systems

**Autonomous analytical engines for crypto, sports, stocks, indices, and prediction markets.**

Oracle Systems is a suite of specialized modules that scan, interpret, and forecast activity across different markets. Each product is an autonomous analytical engine that ingests real-world market data, analyzes it using mathematical and AI-based signal logic, and outputs readable, ranked signals via API or dashboard.

---

## 🎯 Current Focus: Crypto Scanner

The **Crypto Scanner** is the first Oracle Systems product in active development. It continuously fetches live data from Binance, calculates signal metrics, and emits actionable signals via a REST API.

### Features (Phase 1 - Signals MVP)

✅ **SMA Cross Detection**
- Computes 9-period and 21-period Simple Moving Averages
- Detects bullish crossovers (fast crosses above slow)
- Detects bearish crossovers (fast crosses below slow)
- Deduplicates signals to prevent spam

✅ **15-Minute Mover Detection**
- Tracks percent price change over 15 minutes
- Alerts when price moves ≥1% in either direction
- 10-minute cooldown to prevent duplicate alerts

✅ **Real-time Data Pipeline**
- Fetches live kline data from Binance API
- In-memory storage for latest ticks and signals
- RESTful API for signal consumption

---

## 🏗️ Architecture

```
products/crypto/
├── api/
│   └── index.js          # Fastify REST API server
├── worker/
│   ├── index.js          # Main worker: fetches data, detects signals
│   └── signals.js        # Signal detection logic (SMA, movers, etc.)
├── lib/
│   └── utils.js          # Helper utilities
├── package.json
├── .env.example
└── .gitignore
```

### Components

1. **API Server** (`api/index.js`)
   - Exposes endpoints: `/health`, `/ticks`, `/signals`
   - Stores recent ticks and signals in memory
   - Receives data from worker via HTTP POST

2. **Worker** (`worker/index.js`)
   - Fetches Binance kline data on interval
   - Maintains price history per symbol
   - Analyzes signals and posts to API
   - Handles errors gracefully without crashing

3. **Signal Logic** (`worker/signals.js`)
   - SMA calculation and cross detection
   - Percent change calculation for movers
   - SignalManager for deduplication and cooldowns

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Installation

```bash
cd products/crypto
npm install
```

### Configuration

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

**Environment Variables:**

```env
# API Configuration
PORT=4100

# Crypto Scanner Configuration
SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT
INTERVAL=1m

# Worker Configuration
FETCH_INTERVAL_MS=60000
```

- `PORT`: API server port (default: 4100)
- `SYMBOLS`: Comma-separated list of Binance trading pairs
- `INTERVAL`: Kline interval (1m, 5m, 15m, 1h, etc.)
- `FETCH_INTERVAL_MS`: How often worker fetches data (in milliseconds)

### Running the Services

**Terminal 1 - Start API Server:**

```bash
npm run dev:api
```

Expected output:
```
[2025-11-10T...] 🚀 Crypto Scanner API running on http://localhost:4100
[2025-11-10T...] Endpoints: /health, /ticks, /signals
```

**Terminal 2 - Start Worker:**

```bash
npm run dev:worker
```

Expected output:
```
[2025-11-10T...] 🚀 Crypto Scanner Worker starting...
[2025-11-10T...] Symbols: BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT
[2025-11-10T...] Interval: 1m
[2025-11-10T...] 🔄 Worker cycle started
[2025-11-10T...] 📊 Processed BTCUSDT: 100 bars, 1 signals
[2025-11-10T...] ✅ SMA Cross up: BTCUSDT
```

---

## 🔍 Verification & Testing

### 1. Check API Health

```bash
curl http://localhost:4100/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "service": "crypto-scanner",
  "timestamp": "2025-11-10T..."
}
```

### 2. View Recent Ticks

```bash
# All ticks (last 100)
curl http://localhost:4100/ticks

# Ticks for specific symbol
curl http://localhost:4100/ticks?symbol=BTCUSDT&limit=10
```

**Example Response:**
```json
{
  "count": 10,
  "data": [
    {
      "symbol": "BTCUSDT",
      "timestamp": 1699564800000,
      "open": 35000.50,
      "high": 35100.00,
      "low": 34900.00,
      "close": 35050.25,
      "volume": 125.45,
      "receivedAt": 1699564860000
    },
    ...
  ]
}
```

### 3. View Detected Signals

```bash
# All signals (last 50)
curl http://localhost:4100/signals

# Filter by symbol
curl http://localhost:4100/signals?symbol=BTCUSDT

# Filter by kind
curl http://localhost:4100/signals?kind=sma_cross
```

**Example Signals:**

**SMA Cross Signal:**
```json
{
  "symbol": "BTCUSDT",
  "kind": "sma_cross",
  "score": 1,
  "payload": {
    "fast": 9,
    "slow": 21,
    "dir": "up"
  },
  "timestamp": 1699564860000,
  "createdAt": "2025-11-10T..."
}
```

**15-Minute Mover Signal:**
```json
{
  "symbol": "ETHUSDT",
  "kind": "mover_15m",
  "score": 1.45,
  "payload": {
    "pct": 1.45
  },
  "timestamp": 1699564920000,
  "createdAt": "2025-11-10T..."
}
```

### 4. Monitor Worker Logs

Watch the worker terminal for signal detections:

```
[2025-11-10T...] ✅ SMA Cross up: BTCUSDT
[2025-11-10T...] 📡 Signal: BTCUSDT sma_cross score=1
[2025-11-10T...] ✅ 15m Mover 1.23%: ETHUSDT
[2025-11-10T...] 📡 Signal: ETHUSDT mover_15m score=1.23
```

---

## 📊 Signal Types

### 1. SMA Cross (`sma_cross`)

**Description:** Detects when a fast SMA (9-period) crosses a slow SMA (21-period).

**Triggers:**
- **Bullish:** Fast SMA crosses above slow SMA → `dir: "up"`
- **Bearish:** Fast SMA crosses below slow SMA → `dir: "down"`

**Deduplication:** Only emits when direction changes (up→down or down→up)

**Example Payload:**
```json
{
  "fast": 9,
  "slow": 21,
  "dir": "up"
}
```

### 2. 15-Minute Mover (`mover_15m`)

**Description:** Detects significant price movements over 15 minutes.

**Triggers:**
- Price change ≥ 1% (positive or negative)

**Cooldown:** 10 minutes per symbol to prevent spam

**Example Payload:**
```json
{
  "pct": 1.45
}
```

---

## 🛠️ Development

### Project Structure

- **`api/index.js`**: Fastify server with in-memory storage
- **`worker/index.js`**: Main loop that fetches and analyzes data
- **`worker/signals.js`**: Pure signal detection functions
- **`lib/utils.js`**: Shared utilities (logging, env parsing)

### Adding New Signals

To add a new signal type:

1. **Add detection logic** in `worker/signals.js`:
```javascript
export function detectNewSignal(data) {
  // Your logic here
  return { /* signal data */ };
}
```

2. **Update `analyzeSignals()`** to call your detector:
```javascript
const newSig = detectNewSignal(closes);
if (newSig) {
  signals.push({
    symbol,
    kind: 'new_signal_type',
    score: newSig.score,
    payload: newSig.payload
  });
}
```

3. **Add cooldown handling** if needed using `SignalManager`

### Testing Tips

- Use fewer symbols initially (e.g., just `BTCUSDT,ETHUSDT`)
- Decrease `FETCH_INTERVAL_MS` to speed up testing (e.g., 30000 = 30 seconds)
- Check worker logs for errors or signal detections
- Query `/signals` endpoint to verify signals are stored

---

## 🔮 Roadmap

### Phase 1: Signals MVP ✅ (Current)
- [x] SMA cross detection
- [x] 15-minute mover detection
- [x] Deduplication and cooldown logic
- [x] REST API for signals

### Phase 2: Persistence
- [ ] Integrate Supabase for signal storage
- [ ] Historical signal analysis
- [ ] User accounts and API keys

### Phase 3: Dashboard
- [ ] Next.js frontend
- [ ] Real-time signal feed
- [ ] Symbol watchlists
- [ ] Performance tracking

### Phase 4: Advanced Signals
- [ ] Volume-weighted signals
- [ ] Multi-timeframe analysis
- [ ] Custom indicator support
- [ ] Machine learning predictions

### Phase 5: Multi-Market
- [ ] Sports Oracle module
- [ ] Stocks Oracle module
- [ ] Indices Oracle module
- [ ] Unified Oracle Systems dashboard

---

## 📝 API Reference

### Endpoints

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "crypto-scanner",
  "timestamp": "2025-11-10T..."
}
```

#### `GET /ticks`
Retrieve recent tick data.

**Query Parameters:**
- `symbol` (optional): Filter by symbol
- `limit` (optional): Number of results (default: 100)

**Response:**
```json
{
  "count": 10,
  "data": [...]
}
```

#### `POST /ticks`
Submit new tick data (used by worker).

**Body:**
```json
{
  "symbol": "BTCUSDT",
  "timestamp": 1699564800000,
  "open": 35000.50,
  "high": 35100.00,
  "low": 34900.00,
  "close": 35050.25,
  "volume": 125.45
}
```

#### `GET /signals`
Retrieve detected signals.

**Query Parameters:**
- `symbol` (optional): Filter by symbol
- `kind` (optional): Filter by signal type
- `limit` (optional): Number of results (default: 50)

**Response:**
```json
{
  "count": 5,
  "data": [...]
}
```

#### `POST /signals`
Submit new signal (used by worker).

**Body:**
```json
{
  "symbol": "BTCUSDT",
  "kind": "sma_cross",
  "score": 1,
  "payload": { "fast": 9, "slow": 21, "dir": "up" }
}
```

---

## 🤝 Contributing

This is an internal Aether Labs project. For questions or suggestions, contact the team.

---

## 📄 License

Proprietary - Aether Labs

---

## 🙏 Acknowledgments

Built with:
- [Fastify](https://www.fastify.io/) - Fast web framework
- [Axios](https://axios-http.com/) - HTTP client
- [Binance API](https://binance-docs.github.io/apidocs/) - Market data source

---

**Oracle Systems** - *Autonomous Intelligence for Every Market*
