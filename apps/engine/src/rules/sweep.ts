import { Candle, Signal, Timeframe } from '@aether/shared';

const THRESHOLDS: Record<Timeframe, { lookback: number; wickRatio: number }> = {
  '15m': { lookback: 20, wickRatio: 0.6 },
  '1h': { lookback: 24, wickRatio: 0.6 },
  '4h': { lookback: 30, wickRatio: 0.65 },
  '1d': { lookback: 40, wickRatio: 0.65 },
};

export function detectSweep(
  symbol: string,
  tf: Timeframe,
  candles: Candle[]
): Signal | null {
  if (candles.length < 50) return null;

  const { lookback, wickRatio } = THRESHOLDS[tf];
  const recent = candles.slice(-lookback);

  const rangeHigh = Math.max(...recent.map(c => c.high));
  const rangeLow = Math.min(...recent.map(c => c.low));

  const lastBar = candles[candles.length - 1];
  const bodySize = Math.abs(lastBar.close - lastBar.open);
  const totalRange = lastBar.high - lastBar.low;

  if (totalRange === 0) return null;

  // Sweep above range (bearish)
  if (lastBar.high >= rangeHigh * 1.0001) {
    const upperWick = lastBar.high - Math.max(lastBar.open, lastBar.close);
    const wickPercentage = upperWick / totalRange;

    if (wickPercentage >= wickRatio && lastBar.close < lastBar.open) {
      const strength = Math.min(1.0, 0.4 + wickPercentage * 0.6);

      return {
        rule: 'sweep',
        symbol,
        ts: lastBar.ts,
        tf,
        strength,
        meta: {
          direction: 'bearish',
          rangeHigh,
          sweepHigh: lastBar.high,
          wickRatio: wickPercentage,
        },
      };
    }
  }

  // Sweep below range (bullish)
  if (lastBar.low <= rangeLow * 0.9999) {
    const lowerWick = Math.min(lastBar.open, lastBar.close) - lastBar.low;
    const wickPercentage = lowerWick / totalRange;

    if (wickPercentage >= wickRatio && lastBar.close > lastBar.open) {
      const strength = Math.min(1.0, 0.4 + wickPercentage * 0.6);

      return {
        rule: 'sweep',
        symbol,
        ts: lastBar.ts,
        tf,
        strength,
        meta: {
          direction: 'bullish',
          rangeLow,
          sweepLow: lastBar.low,
          wickRatio: wickPercentage,
        },
      };
    }
  }

  return null;
}
