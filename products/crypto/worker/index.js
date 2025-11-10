/**
 * Oracle Systems Crypto Scanner Worker
 * Fetches Binance klines, analyzes signals, and posts to API
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { envInt, envList, log, logError } from '../lib/utils.js';
import { SignalManager, analyzeSignals } from './signals.js';

// Load environment variables
dotenv.config();

const PORT = envInt('PORT', 4100);
const API_BASE = `http://localhost:${PORT}`;
const SYMBOLS = envList('SYMBOLS', ['BTCUSDT', 'ETHUSDT']);
const INTERVAL = process.env.INTERVAL || '1m';
const FETCH_INTERVAL_MS = envInt('FETCH_INTERVAL_MS', 60000);

// Binance API endpoint
const BINANCE_API = 'https://api.binance.com/api/v3/klines';

// Store closing prices per symbol
const priceHistory = new Map(); // symbol -> [close prices]
const MAX_HISTORY = 100; // Keep last 100 closes per symbol

// Signal manager for deduplication
const signalManager = new SignalManager();

/**
 * Fetch klines from Binance
 * @param {string} symbol - Trading pair symbol
 * @param {string} interval - Kline interval (e.g., '1m')
 * @param {number} limit - Number of klines to fetch
 * @returns {Promise<Array>} - Array of kline data
 */
async function fetchKlines(symbol, interval, limit = 100) {
  try {
    const response = await axios.get(BINANCE_API, {
      params: {
        symbol,
        interval,
        limit
      },
      timeout: 10000
    });

    return response.data;
  } catch (error) {
    logError(`Failed to fetch klines for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Parse kline data and extract close prices
 * Binance kline format:
 * [
 *   openTime, open, high, low, close, volume,
 *   closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore
 * ]
 */
function parseKlines(klines) {
  if (!klines || !Array.isArray(klines)) {
    return [];
  }

  return klines.map(k => ({
    timestamp: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  }));
}

/**
 * Post tick data to API
 */
async function postTick(symbol, tick) {
  try {
    await axios.post(`${API_BASE}/ticks`, {
      symbol,
      ...tick
    }, {
      timeout: 5000
    });
  } catch (error) {
    logError(`Failed to post tick for ${symbol}:`, error.message);
  }
}

/**
 * Post signal to API
 */
async function postSignal(signal) {
  try {
    await axios.post(`${API_BASE}/signals`, signal, {
      timeout: 5000
    });
  } catch (error) {
    logError(`Failed to post signal for ${signal.symbol}:`, error.message);
  }
}

/**
 * Process a single symbol
 */
async function processSymbol(symbol) {
  // Fetch latest klines
  const klines = await fetchKlines(symbol, INTERVAL, MAX_HISTORY);

  if (!klines) {
    return;
  }

  const parsed = parseKlines(klines);

  if (parsed.length === 0) {
    return;
  }

  // Update price history
  const closes = parsed.map(p => p.close);
  priceHistory.set(symbol, closes);

  // Post latest tick
  const latestTick = parsed[parsed.length - 1];
  await postTick(symbol, latestTick);

  // Analyze signals
  const signals = analyzeSignals(symbol, closes, signalManager);

  // Post each signal
  for (const signal of signals) {
    await postSignal(signal);
  }

  log(`📊 Processed ${symbol}: ${parsed.length} bars, ${signals.length} signals`);
}

/**
 * Main worker loop
 */
async function runWorker() {
  log('🔄 Worker cycle started');

  for (const symbol of SYMBOLS) {
    await processSymbol(symbol);
  }

  log(`✅ Worker cycle completed for ${SYMBOLS.length} symbols`);
}

/**
 * Start worker with interval
 */
async function start() {
  log(`🚀 Crypto Scanner Worker starting...`);
  log(`Symbols: ${SYMBOLS.join(', ')}`);
  log(`Interval: ${INTERVAL}`);
  log(`Fetch interval: ${FETCH_INTERVAL_MS}ms`);
  log(`API: ${API_BASE}`);

  // Run immediately
  await runWorker();

  // Then run on interval
  setInterval(async () => {
    await runWorker();
  }, FETCH_INTERVAL_MS);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('⏹️  Worker shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('⏹️  Worker shutting down...');
  process.exit(0);
});

start();
