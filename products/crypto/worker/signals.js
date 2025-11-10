/**
 * Signal Detection Logic for Oracle Systems Crypto Scanner
 * Implements SMA cross detection and 15-minute mover detection
 */

import { log } from '../lib/utils.js';

/**
 * Calculate Simple Moving Average
 * @param {number[]} values - Array of numeric values
 * @param {number} period - SMA period
 * @returns {number|null} - SMA value or null if insufficient data
 */
export function sma(values, period) {
  if (!values || values.length < period) {
    return null;
  }

  const slice = values.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

/**
 * Detect SMA crossover
 * @param {number[]} closes - Array of closing prices
 * @param {number} fastPeriod - Fast SMA period (e.g., 9)
 * @param {number} slowPeriod - Slow SMA period (e.g., 21)
 * @returns {Object|null} - { direction: 'up'|'down', fast, slow } or null
 */
export function detectCross(closes, fastPeriod = 9, slowPeriod = 21) {
  if (!closes || closes.length < slowPeriod + 1) {
    return null;
  }

  // Calculate current SMAs
  const currentFast = sma(closes, fastPeriod);
  const currentSlow = sma(closes, slowPeriod);

  // Calculate previous SMAs (one bar ago)
  const prevCloses = closes.slice(0, -1);
  const prevFast = sma(prevCloses, fastPeriod);
  const prevSlow = sma(prevCloses, slowPeriod);

  if (currentFast === null || currentSlow === null || prevFast === null || prevSlow === null) {
    return null;
  }

  // Detect crossover
  // Cross UP: prev fast <= prev slow AND current fast > current slow
  if (prevFast <= prevSlow && currentFast > currentSlow) {
    return {
      direction: 'up',
      fast: currentFast,
      slow: currentSlow
    };
  }

  // Cross DOWN: prev fast >= prev slow AND current fast < current slow
  if (prevFast >= prevSlow && currentFast < currentSlow) {
    return {
      direction: 'down',
      fast: currentFast,
      slow: currentSlow
    };
  }

  return null;
}

/**
 * Calculate percent change over N periods
 * @param {number[]} closes - Array of closing prices
 * @param {number} periods - Number of periods to look back
 * @returns {number|null} - Percent change or null if insufficient data
 */
export function pctChange(closes, periods) {
  if (!closes || closes.length < periods + 1) {
    return null;
  }

  const current = closes[closes.length - 1];
  const past = closes[closes.length - 1 - periods];

  if (past === 0) return null;

  return ((current - past) / past) * 100;
}

/**
 * SignalManager class to handle deduplication and cooldowns
 */
export class SignalManager {
  constructor() {
    // Track last signal direction per symbol for SMA crosses
    this.lastCrossDirection = new Map(); // symbol -> 'up' | 'down'

    // Track last signal timestamp per symbol/kind for cooldown
    this.lastSignalTime = new Map(); // "symbol:kind" -> timestamp

    // Cooldown period in milliseconds (10 minutes)
    this.cooldownMs = 10 * 60 * 1000;
  }

  /**
   * Check if we should emit an SMA cross signal
   * @param {string} symbol
   * @param {string} direction - 'up' or 'down'
   * @returns {boolean}
   */
  shouldEmitCross(symbol, direction) {
    const lastDir = this.lastCrossDirection.get(symbol);

    // Emit if direction changed or this is the first signal
    if (lastDir !== direction) {
      this.lastCrossDirection.set(symbol, direction);
      return true;
    }

    return false;
  }

  /**
   * Check if we're still in cooldown period for a signal type
   * @param {string} symbol
   * @param {string} kind
   * @returns {boolean}
   */
  isInCooldown(symbol, kind) {
    const key = `${symbol}:${kind}`;
    const lastTime = this.lastSignalTime.get(key);

    if (!lastTime) return false;

    const elapsed = Date.now() - lastTime;
    return elapsed < this.cooldownMs;
  }

  /**
   * Mark that we've emitted a signal
   * @param {string} symbol
   * @param {string} kind
   */
  markEmitted(symbol, kind) {
    const key = `${symbol}:${kind}`;
    this.lastSignalTime.set(key, Date.now());
  }

  /**
   * Reset cooldown for a specific signal (useful for testing)
   * @param {string} symbol
   * @param {string} kind
   */
  resetCooldown(symbol, kind) {
    const key = `${symbol}:${kind}`;
    this.lastSignalTime.delete(key);
  }
}

/**
 * Analyze closes array for all signals
 * @param {string} symbol
 * @param {number[]} closes - Array of closing prices
 * @param {SignalManager} manager - Signal manager instance
 * @returns {Array} - Array of signal objects to emit
 */
export function analyzeSignals(symbol, closes, manager) {
  const signals = [];

  if (!closes || closes.length === 0) {
    return signals;
  }

  // 1. SMA Cross Detection (9/21)
  const cross = detectCross(closes, 9, 21);
  if (cross && manager.shouldEmitCross(symbol, cross.direction)) {
    signals.push({
      symbol,
      kind: 'sma_cross',
      score: 1,
      payload: {
        fast: 9,
        slow: 21,
        dir: cross.direction
      }
    });
    log(`✅ SMA Cross ${cross.direction}: ${symbol}`);
  }

  // 2. 15-Minute Mover Detection
  // For 1m interval, 15 minutes = 15 bars
  const pct15m = pctChange(closes, 15);
  if (pct15m !== null && Math.abs(pct15m) >= 1.0) {
    // Check cooldown to prevent spam
    if (!manager.isInCooldown(symbol, 'mover_15m')) {
      signals.push({
        symbol,
        kind: 'mover_15m',
        score: pct15m,
        payload: {
          pct: pct15m
        }
      });
      manager.markEmitted(symbol, 'mover_15m');
      log(`✅ 15m Mover ${pct15m.toFixed(2)}%: ${symbol}`);
    }
  }

  return signals;
}
