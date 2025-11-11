import { Candle, Signal, Timeframe } from '@aether/shared';

const THRESHOLDS: Record<Timeframe, { volumeMultiple: number; rangeBreakPct: number; lookback: number }> = {
  '15m': { volumeMultiple: 2.0, rangeBreakPct: 0.02, lookback: 20 },
  '1h': { volumeMultiple: 1.8, rangeBreakPct: 0.025, lookback: 24 },
  '4h': { volumeMultiple: 1.5, rangeBreakPct: 0.03, lookback: 30 },
  '1d': { volumeMultiple: 1.5, rangeBreakPct: 0.035, lookback: 40 },
};

export function detectBreakoutVolume(
  symbol: string,
  tf: Timeframe,
  candles: Candle[]
): Signal | null {
  if (candles.length < 50) return null;

  const { volumeMultiple, rangeBreakPct, lookback } = THRESHOLDS[tf];

  const recent = candles.slice(-lookback - 1, -1);
  const lastBar = candles[candles.length - 1];

  const avgVolume = recent.reduce((sum, c) => sum + c.volume, 0) / recent.length;
  const volumeRatio = lastBar.volume / avgVolume;

  if (volumeRatio < volumeMultiple) return null;

  const rangeHigh = Math.max(...recent.map(c => c.high));
  const rangeLow = Math.min(...recent.map(c => c.low));
  const rangeSize = rangeHigh - rangeLow;

  // Bullish breakout above range
  if (lastBar.close > rangeHigh && lastBar.close > lastBar.open) {
    const breakoutSize = (lastBar.close - rangeHigh) / rangeHigh;

    if (breakoutSize >= rangeBreakPct) {
      const strength = Math.min(
        1.0,
        0.4 + (volumeRatio / volumeMultiple) * 0.3 + (breakoutSize / rangeBreakPct) * 0.3
      );

      return {
        rule: 'breakout_volume',
        symbol,
        ts: lastBar.ts,
        tf,
        strength,
        meta: {
          direction: 'bullish',
          volumeRatio,
          rangeHigh,
          breakoutPrice: lastBar.close,
          breakoutPct: breakoutSize * 100,
        },
      };
    }
  }

  // Bearish breakdown below range
  if (lastBar.close < rangeLow && lastBar.close < lastBar.open) {
    const breakdownSize = (rangeLow - lastBar.close) / rangeLow;

    if (breakdownSize >= rangeBreakPct) {
      const strength = Math.min(
        1.0,
        0.4 + (volumeRatio / volumeMultiple) * 0.3 + (breakdownSize / rangeBreakPct) * 0.3
      );

      return {
        rule: 'breakout_volume',
        symbol,
        ts: lastBar.ts,
        tf,
        strength,
        meta: {
          direction: 'bearish',
          volumeRatio,
          rangeLow,
          breakdownPrice: lastBar.close,
          breakdownPct: breakdownSize * 100,
        },
      };
    }
  }

  return null;
}
