import { Signal, Timeframe } from '@aether/shared';

const TF_TO_MINUTES: Record<Timeframe, number> = {
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};

const DEBOUNCE_BARS = 3;

export class SignalDeduplicator {
  private lastSignals: Map<string, { signal: Signal; timestamp: number }> = new Map();

  shouldEmit(newSignal: Signal, lastDbSignal: Signal | null): boolean {
    const key = `${newSignal.symbol}:${newSignal.tf}:${newSignal.rule}`;
    const tfMs = TF_TO_MINUTES[newSignal.tf] * 60 * 1000;
    const debounceMs = DEBOUNCE_BARS * tfMs;

    const cached = this.lastSignals.get(key);
    const compareSignal = cached?.signal || lastDbSignal;

    if (!compareSignal) {
      // No previous signal, emit this one
      this.lastSignals.set(key, {
        signal: newSignal,
        timestamp: newSignal.ts.getTime(),
      });
      return true;
    }

    const timeSinceLastMs = newSignal.ts.getTime() - compareSignal.ts.getTime();

    // Within debounce window - check if state meaningfully changed
    if (timeSinceLastMs < debounceMs) {
      const stateChanged = this.hasStateChanged(newSignal, compareSignal);
      if (stateChanged) {
        this.lastSignals.set(key, {
          signal: newSignal,
          timestamp: newSignal.ts.getTime(),
        });
        return true;
      }
      return false;
    }

    // Outside debounce window, emit
    this.lastSignals.set(key, {
      signal: newSignal,
      timestamp: newSignal.ts.getTime(),
    });
    return true;
  }

  private hasStateChanged(newSig: Signal, oldSig: Signal): boolean {
    // Check if direction changed (for directional signals)
    if (newSig.meta.direction && oldSig.meta.direction) {
      if (newSig.meta.direction !== oldSig.meta.direction) {
        return true;
      }
    }

    // Check if strength changed significantly (>20%)
    const strengthDelta = Math.abs(newSig.strength - oldSig.strength);
    if (strengthDelta > 0.2) {
      return true;
    }

    return false;
  }

  clear(): void {
    this.lastSignals.clear();
  }
}
