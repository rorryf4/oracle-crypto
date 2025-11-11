import { Candle, Signal, Timeframe } from '@aether/shared';
import { findSwingHighs, findSwingLows, atr } from '../indicators.js';

// Timeframe-specific thresholds
const THRESHOLDS: Record<Timeframe, { buffer: number; retestBars: number; debounce: number }> = {
  '15m': { buffer: 0.0015, retestBars: 8, debounce: 3 },
  '1h': { buffer: 0.002, retestBars: 6, debounce: 3 },
  '4h': { buffer: 0.0025, retestBars: 5, debounce: 3 },
  '1d': { buffer: 0.003, retestBars: 4, debounce: 3 },
};

export function detectBreakRetest(
  symbol: string,
  tf: Timeframe,
  candles: Candle[]
): Signal | null {
  if (candles.length < 50) return null;

  const { buffer, retestBars } = THRESHOLDS[tf];

  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);

  // Find recent swing levels
  const swingHighs = findSwingHighs(highs, 5);
  const swingLows = findSwingLows(lows, 5);

  // Get last 20 bars for analysis
  const recentCandles = candles.slice(-20);
  const currentClose = closes[closes.length - 1];

  // Find recent significant levels
  let resistanceLevel: number | null = null;
  let supportLevel: number | null = null;

  for (let i = swingHighs.length - 1; i >= Math.max(0, swingHighs.length - 30); i--) {
    if (swingHighs[i] > 0 && !resistanceLevel) {
      resistanceLevel = swingHighs[i];
      break;
    }
  }

  for (let i = swingLows.length - 1; i >= Math.max(0, swingLows.length - 30); i--) {
    if (swingLows[i] > 0 && !supportLevel) {
      supportLevel = swingLows[i];
      break;
    }
  }

  // Check for break above resistance and retest
  if (resistanceLevel) {
    const bufferZone = resistanceLevel * buffer;
    let breakIndex = -1;

    for (let i = recentCandles.length - retestBars; i < recentCandles.length - 1; i++) {
      if (i >= 0 && recentCandles[i].close > resistanceLevel + bufferZone) {
        breakIndex = i;
        break;
      }
    }

    if (breakIndex !== -1) {
      // Check if recent price retested the level from above
      const lastBar = recentCandles[recentCandles.length - 1];
      if (
        lastBar.low <= resistanceLevel + bufferZone &&
        lastBar.low >= resistanceLevel - bufferZone &&
        lastBar.close > resistanceLevel
      ) {
        const strength = Math.min(
          1.0,
          0.5 + 0.5 * ((lastBar.close - resistanceLevel) / resistanceLevel)
        );

        return {
          rule: 'break_retest',
          symbol,
          ts: lastBar.ts,
          tf,
          strength: Math.max(0.3, strength),
          meta: {
            direction: 'bullish',
            level: resistanceLevel,
            breakBar: breakIndex,
            retestBar: recentCandles.length - 1,
          },
        };
      }
    }
  }

  // Check for break below support and retest
  if (supportLevel) {
    const bufferZone = supportLevel * buffer;
    let breakIndex = -1;

    for (let i = recentCandles.length - retestBars; i < recentCandles.length - 1; i++) {
      if (i >= 0 && recentCandles[i].close < supportLevel - bufferZone) {
        breakIndex = i;
        break;
      }
    }

    if (breakIndex !== -1) {
      const lastBar = recentCandles[recentCandles.length - 1];
      if (
        lastBar.high >= supportLevel - bufferZone &&
        lastBar.high <= supportLevel + bufferZone &&
        lastBar.close < supportLevel
      ) {
        const strength = Math.min(
          1.0,
          0.5 + 0.5 * ((supportLevel - lastBar.close) / supportLevel)
        );

        return {
          rule: 'break_retest',
          symbol,
          ts: lastBar.ts,
          tf,
          strength: Math.max(0.3, strength),
          meta: {
            direction: 'bearish',
            level: supportLevel,
            breakBar: breakIndex,
            retestBar: recentCandles.length - 1,
          },
        };
      }
    }
  }

  return null;
}
