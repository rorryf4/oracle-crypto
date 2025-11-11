import { Candle } from '@aether/shared';

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];

  if (values.length === 0) return result;

  // Start with SMA for first value
  let emaValue = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(emaValue);

  // Calculate EMA for remaining values
  for (let i = period; i < values.length; i++) {
    emaValue = values[i] * k + emaValue * (1 - k);
    result.push(emaValue);
  }

  return result;
}

export function sma(values: number[], period: number): number[] {
  const result: number[] = [];

  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    result.push(avg);
  }

  return result;
}

export function rsi(closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  const changes: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  for (let i = period; i <= changes.length; i++) {
    const slice = changes.slice(i - period, i);
    const gains = slice.filter(c => c > 0);
    const losses = slice.filter(c => c < 0).map(c => Math.abs(c));

    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }

  return result;
}

export function atr(candles: Candle[], period: number = 14): number[] {
  const result: number[] = [];
  const trueRanges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );

    trueRanges.push(tr);
  }

  // Calculate ATR as SMA of true ranges
  for (let i = period - 1; i < trueRanges.length; i++) {
    const slice = trueRanges.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    result.push(avg);
  }

  return result;
}

export function findSwingHighs(highs: number[], lookback: number = 5): number[] {
  const swings: number[] = [];

  for (let i = lookback; i < highs.length - lookback; i++) {
    let isSwing = true;
    for (let j = 1; j <= lookback; j++) {
      if (highs[i] <= highs[i - j] || highs[i] <= highs[i + j]) {
        isSwing = false;
        break;
      }
    }
    swings.push(isSwing ? highs[i] : 0);
  }

  return swings;
}

export function findSwingLows(lows: number[], lookback: number = 5): number[] {
  const swings: number[] = [];

  for (let i = lookback; i < lows.length - lookback; i++) {
    let isSwing = true;
    for (let j = 1; j <= lookback; j++) {
      if (lows[i] >= lows[i - j] || lows[i] >= lows[i + j]) {
        isSwing = false;
        break;
      }
    }
    swings.push(isSwing ? lows[i] : 0);
  }

  return swings;
}
