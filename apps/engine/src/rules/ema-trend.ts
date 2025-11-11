import { Candle, Signal, Timeframe } from '@aether/shared';
import { ema } from '../indicators.js';

export function detectEmaTrend(
  symbol: string,
  tf: Timeframe,
  candles: Candle[]
): Signal | null {
  if (candles.length < 210) return null;

  const closes = candles.map(c => c.close);

  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);

  if (ema20.length === 0 || ema50.length === 0 || ema200.length === 0) return null;

  const current20 = ema20[ema20.length - 1];
  const current50 = ema50[ema50.length - 1];
  const current200 = ema200[ema200.length - 1];

  const currentClose = closes[closes.length - 1];
  const lastBar = candles[candles.length - 1];

  // Bullish alignment: 20 > 50 > 200 and price above 20
  if (
    current20 > current50 &&
    current50 > current200 &&
    currentClose > current20
  ) {
    const separation = ((current20 - current200) / current200) * 100;
    const strength = Math.min(1.0, 0.5 + separation / 10);

    return {
      rule: 'ema_trend',
      symbol,
      ts: lastBar.ts,
      tf,
      strength,
      meta: {
        direction: 'bullish',
        ema20: current20,
        ema50: current50,
        ema200: current200,
        separation,
      },
    };
  }

  // Bearish alignment: 20 < 50 < 200 and price below 20
  if (
    current20 < current50 &&
    current50 < current200 &&
    currentClose < current20
  ) {
    const separation = ((current200 - current20) / current200) * 100;
    const strength = Math.min(1.0, 0.5 + separation / 10);

    return {
      rule: 'ema_trend',
      symbol,
      ts: lastBar.ts,
      tf,
      strength,
      meta: {
        direction: 'bearish',
        ema20: current20,
        ema50: current50,
        ema200: current200,
        separation,
      },
    };
  }

  return null;
}
