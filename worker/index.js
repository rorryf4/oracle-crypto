/**
 * Oracle Systems Crypto Scanner Worker
 */
import axios from "axios";
import dotenv from "dotenv";
import { envInt, envList, log, logError } from "../lib/utils.js";
import { SignalManager, analyzeSignals } from "./signals.js";

dotenv.config();

const PORT = envInt("PORT", 4100);
const API_BASE = `http://localhost:${PORT}`;
const SYMBOLS = envList("SYMBOLS", ["BTCUSDT", "ETHUSDT"]);
const INTERVAL = process.env.INTERVAL || "1m";
const FETCH_INTERVAL_MS = envInt("FETCH_INTERVAL_MS", 60000);

// Configurable market data base (default to Binance.US to avoid 451)
const BINANCE_API_BASE = process.env.BINANCE_API_BASE || "https://api.binance.us";
const BINANCE_API = `${BINANCE_API_BASE}/api/v3/klines`;

const MAX_HISTORY = 100;
const signalManager = new SignalManager();

async function fetchKlines(symbol, interval, limit = 100) {
  try {
    const res = await axios.get(BINANCE_API, {
      params: { symbol, interval, limit },
      timeout: 10000,
      headers: { "User-Agent": "oracle-crypto/0.1" },
      validateStatus: s => s >= 200 && s < 500
    });
    if (res.status !== 200) throw new Error(`${res.status} ${res.statusText}`);
    return res.data;
  } catch (err) {
    logError(`Failed to fetch klines for ${symbol}:`, err.message);
    return null;
  }
}

function parseKlines(klines) {
  if (!klines || !Array.isArray(klines)) return [];
  return klines.map(k => ({
    timestamp: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  }));
}

async function postTick(symbol, tick) {
  try {
    await axios.post(`${API_BASE}/ticks`, { symbol, ...tick }, { timeout: 5000 });
  } catch (err) {
    logError(`Failed to post tick for ${symbol}:`, err.message);
  }
}

async function postSignal(signal) {
  try {
    await axios.post(`${API_BASE}/signals`, signal, { timeout: 5000 });
  } catch (err) {
    logError(`Failed to post signal for ${signal.symbol}:`, err.message);
  }
}

async function processSymbol(symbol) {
  const klines = await fetchKlines(symbol, INTERVAL, MAX_HISTORY);
  if (!klines) return;

  const parsed = parseKlines(klines);
  if (parsed.length === 0) return;

  const closes = parsed.map(p => p.close);

  const latestTick = parsed[parsed.length - 1];
  await postTick(symbol, latestTick);

  const sigs = analyzeSignals(symbol, closes, signalManager);
  for (const s of sigs) await postSignal(s);

  log(`?? Processed ${symbol}: ${parsed.length} bars, ${sigs.length} signals`);
}

async function runWorker() {
  log("?? Worker cycle started");
  for (const s of SYMBOLS) await processSymbol(s);
  log(`? Worker cycle completed for ${SYMBOLS.length} symbols`);
}

async function start() {
  log(`?? Crypto Scanner Worker starting...`);
  log(`Symbols: ${SYMBOLS.join(", ")}`);
  log(`Interval: ${INTERVAL}`);
  log(`Fetch interval: ${FETCH_INTERVAL_MS}ms`);
  log(`API: ${API_BASE}`);
  log(`Market data: ${BINANCE_API_BASE}`);
  await runWorker();
  setInterval(runWorker, FETCH_INTERVAL_MS);
}

process.on("SIGINT", () => { log("??  Worker shutting down..."); process.exit(0); });
process.on("SIGTERM", () => { log("??  Worker shutting down..."); process.exit(0); });

start();