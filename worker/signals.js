/**
 * Signal Detection Logic for Oracle Systems Crypto Scanner
 */
import { log } from "../lib/utils.js";

export function sma(values, period) {
  if (!values || values.length < period) return null;
  const slice = values.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

export function detectCross(closes, fast = 9, slow = 21) {
  if (!closes || closes.length < slow + 1) return null;
  const cFast = sma(closes, fast);
  const cSlow = sma(closes, slow);
  const pFast = sma(closes.slice(0, -1), fast);
  const pSlow = sma(closes.slice(0, -1), slow);
  if (cFast == null || cSlow == null || pFast == null || pSlow == null) return null;

  if (pFast <= pSlow && cFast > cSlow) return { direction: "up", fast: cFast, slow: cSlow };
  if (pFast >= pSlow && cFast < cSlow) return { direction: "down", fast: cFast, slow: cSlow };
  return null;
}

export function pctChange(closes, periods) {
  if (!closes || closes.length < periods + 1) return null;
  const curr = closes[closes.length - 1];
  const past = closes[closes.length - 1 - periods];
  if (past === 0) return null;
  return ((curr - past) / past) * 100;
}

export class SignalManager {
  constructor() {
    this.lastCrossDirection = new Map(); // symbol -> "up"|"down"
    this.lastSignalTime = new Map();     // "symbol:kind" -> ms
    this.cooldownMs = 10 * 60 * 1000;    // 10 min
  }
  shouldEmitCross(symbol, dir) {
    const last = this.lastCrossDirection.get(symbol);
    if (last !== dir) {
      this.lastCrossDirection.set(symbol, dir);
      return true;
    }
    return false;
  }
  isInCooldown(symbol, kind) {
    const key = `${symbol}:${kind}`;
    const last = this.lastSignalTime.get(key);
    if (!last) return false;
    return (Date.now() - last) < this.cooldownMs;
  }
  markEmitted(symbol, kind) {
    const key = `${symbol}:${kind}`;
    this.lastSignalTime.set(key, Date.now());
  }
  resetCooldown(symbol, kind) {
    const key = `${symbol}:${kind}`;
    this.lastSignalTime.delete(key);
  }
}

export function analyzeSignals(symbol, closes, manager) {
  const out = [];
  if (!closes || closes.length === 0) return out;

  const cross = detectCross(closes, 9, 21);
  if (cross && manager.shouldEmitCross(symbol, cross.direction)) {
    out.push({
      symbol, kind: "sma_cross", score: 1,
      payload: { fast: 9, slow: 21, dir: cross.direction }
    });
    log(`? SMA Cross ${cross.direction}: ${symbol}`);
  }

  const pct15 = pctChange(closes, 15);
  if (pct15 != null && Math.abs(pct15) >= 1.0) {
    if (!manager.isInCooldown(symbol, "mover_15m")) {
      out.push({ symbol, kind: "mover_15m", score: pct15, payload: { pct: pct15 } });
      manager.markEmitted(symbol, "mover_15m");
      log(`? 15m Mover ${pct15.toFixed(2)}%: ${symbol}`);
    }
  }
  return out;
}