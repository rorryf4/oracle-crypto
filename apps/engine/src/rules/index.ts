import { Candle, Signal, Timeframe } from '@aether/shared';
import { detectBreakRetest } from './break-retest.js';
import { detectSweep } from './sweep.js';
import { detectEmaTrend } from './ema-trend.js';
import { detectRsiBounce } from './rsi-bounce.js';
import { detectBreakoutVolume } from './breakout-volume.js';

export type RuleDetector = (symbol: string, tf: Timeframe, candles: Candle[]) => Signal | null;

export const RULES: Record<string, RuleDetector> = {
  break_retest: detectBreakRetest,
  sweep: detectSweep,
  ema_trend: detectEmaTrend,
  rsi_bounce: detectRsiBounce,
  breakout_volume: detectBreakoutVolume,
};

export function evaluateAllRules(
  symbol: string,
  tf: Timeframe,
  candles: Candle[]
): Signal[] {
  const signals: Signal[] = [];

  for (const [ruleName, detector] of Object.entries(RULES)) {
    try {
      const signal = detector(symbol, tf, candles);
      if (signal) {
        signals.push(signal);
      }
    } catch (error: any) {
      console.error(`Error evaluating rule ${ruleName}:`, error.message);
    }
  }

  return signals;
}
