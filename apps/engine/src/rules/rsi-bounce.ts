import { Candle, Signal, Timeframe } from '@aether/shared';
import { rsi } from '../indicators.js';

const THRESHOLDS: Record<Timeframe, { oversold: number; overbought: number; bounceConfirm: number }> = {
  '15m': { oversold: 30, overbought: 70, bounceConfirm: 5 },
  '1h': { oversold: 30, overbought: 70, bounceConfirm: 5 },
  '4h': { oversold: 35, overbought: 65, bounceConfirm: 5 },
  '1d': { oversold: 35, overbought: 65, bounceConfirm: 5 },
};

export function detectRsiBounce(
  symbol: string,
  tf: Timeframe,
  candles: Candle[]
): Signal | null {
  if (candles.length < 50) return null;

  const { oversold, overbought, bounceConfirm } = THRESHOLDS[tf];
  const closes = candles.map(c => c.close);

  const rsiValues = rsi(closes, 14);
  if (rsiValues.length < 5) return null;

  const currentRsi = rsiValues[rsiValues.length - 1];
  const prevRsi = rsiValues[rsiValues.length - 2];

  const lastBar = candles[candles.length - 1];

  // Bullish bounce from oversold
  if (prevRsi <= oversold && currentRsi > prevRsi + bounceConfirm) {
    const strength = Math.min(1.0, 0.4 + (oversold - prevRsi) / oversold);

    return {
      rule: 'rsi_bounce',
      symbol,
      ts: lastBar.ts,
      tf,
      strength,
      meta: {
        direction: 'bullish',
        rsi: currentRsi,
        prevRsi,
        threshold: oversold,
      },
    };
  }

  // Bearish bounce from overbought
  if (prevRsi >= overbought && currentRsi < prevRsi - bounceConfirm) {
    const strength = Math.min(1.0, 0.4 + (prevRsi - overbought) / (100 - overbought));

    return {
      rule: 'rsi_bounce',
      symbol,
      ts: lastBar.ts,
      tf,
      strength,
      meta: {
        direction: 'bearish',
        rsi: currentRsi,
        prevRsi,
        threshold: overbought,
      },
    };
  }

  return null;
}
