import { loadConfig, logger, Timeframe } from '@aether/shared';
import { Database } from './db.js';
import { RedisPublisher } from './publisher.js';
import { SignalDeduplicator } from './deduplicator.js';
import { evaluateAllRules } from './rules/index.js';

const config = loadConfig();
const TIMEFRAMES: Timeframe[] = ['15m', '1h', '4h', '1d'];

const TF_TO_MS: Record<Timeframe, number> = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

class Engine {
  private db: Database;
  private publisher: RedisPublisher;
  private deduplicator: SignalDeduplicator;
  private counters = {
    processedBars: 0,
    signalsEmitted: 0,
  };
  private lastEvaluationTime: Map<string, number> = new Map();

  constructor() {
    this.db = new Database();
    this.publisher = new RedisPublisher();
    this.deduplicator = new SignalDeduplicator();
  }

  async start(): Promise<void> {
    logger.info({
      module: 'engine',
      event: 'starting',
      ts: new Date().toISOString(),
    });

    await this.publisher.connect();

    // Start evaluation loops for each timeframe
    for (const tf of TIMEFRAMES) {
      this.startEvaluationLoop(tf);
    }

    logger.info({
      module: 'engine',
      event: 'running',
      ts: new Date().toISOString(),
    });

    // Log stats every 5 minutes
    setInterval(() => {
      logger.info({
        module: 'engine',
        event: 'stats',
        ts: new Date().toISOString(),
        details: this.counters,
      });
    }, 5 * 60 * 1000);
  }

  private startEvaluationLoop(tf: Timeframe): void {
    const intervalMs = TF_TO_MS[tf];

    // Calculate next bar close aligned to exchange time
    const nextEvaluation = this.getNextBarClose(tf);
    const delayMs = nextEvaluation - Date.now();

    logger.info({
      module: 'engine',
      tf,
      event: 'schedule_evaluation',
      ts: new Date().toISOString(),
      details: {
        nextEvaluation: new Date(nextEvaluation).toISOString(),
        delayMs,
      },
    });

    // Schedule first evaluation
    setTimeout(() => {
      this.evaluate(tf);

      // Then run on interval
      setInterval(() => {
        this.evaluate(tf);
      }, intervalMs);
    }, delayMs);
  }

  private getNextBarClose(tf: Timeframe): number {
    const now = Date.now();
    const intervalMs = TF_TO_MS[tf];

    // Align to exchange time (assume UTC)
    const nextClose = Math.ceil(now / intervalMs) * intervalMs;

    return nextClose;
  }

  private async evaluate(tf: Timeframe): Promise<void> {
    const startTime = Date.now();

    logger.info({
      module: 'engine',
      tf,
      event: 'evaluation_start',
      ts: new Date().toISOString(),
    });

    try {
      for (const symbol of config.universe) {
        await this.evaluateSymbol(symbol, tf);
      }

      const duration = Date.now() - startTime;

      logger.info({
        module: 'engine',
        tf,
        event: 'evaluation_complete',
        ts: new Date().toISOString(),
        details: { durationMs: duration },
      });
    } catch (error: any) {
      logger.error({
        module: 'engine',
        tf,
        event: 'evaluation_error',
        ts: new Date().toISOString(),
        details: { error: error.message, stack: error.stack },
      });
    }
  }

  private async evaluateSymbol(symbol: string, tf: Timeframe): Promise<void> {
    try {
      // Load last 400 bars
      const candles = await this.db.getCandles(symbol, tf, 400);

      if (candles.length < 50) {
        logger.warn({
          module: 'engine',
          symbol,
          tf,
          event: 'insufficient_data',
          ts: new Date().toISOString(),
          details: { candleCount: candles.length },
        });
        return;
      }

      this.counters.processedBars++;

      // Evaluate all rules
      const signals = evaluateAllRules(symbol, tf, candles);

      // Process and emit signals
      for (const signal of signals) {
        await this.processSignal(signal);
      }

      logger.debug({
        module: 'engine',
        symbol,
        tf,
        event: 'symbol_evaluated',
        ts: new Date().toISOString(),
        details: { signalCount: signals.length },
      });
    } catch (error: any) {
      logger.error({
        module: 'engine',
        symbol,
        tf,
        event: 'symbol_error',
        ts: new Date().toISOString(),
        details: { error: error.message },
      });
    }
  }

  private async processSignal(signal: Signal): Promise<void> {
    try {
      // Check for duplicate
      const lastDbSignal = await this.db.getLastSignal(signal.symbol, signal.tf, signal.rule);

      if (!this.deduplicator.shouldEmit(signal, lastDbSignal)) {
        logger.debug({
          module: 'engine',
          symbol: signal.symbol,
          tf: signal.tf,
          event: 'signal_deduplicated',
          ts: new Date().toISOString(),
          details: { rule: signal.rule },
        });
        return;
      }

      // Insert to database
      await this.db.insertSignal(signal);

      // Publish to Redis
      await this.publisher.publish(signal);

      this.counters.signalsEmitted++;

      logger.info({
        module: 'engine',
        symbol: signal.symbol,
        tf: signal.tf,
        event: 'signal_emitted',
        ts: new Date().toISOString(),
        details: {
          rule: signal.rule,
          strength: signal.strength,
          meta: signal.meta,
        },
      });
    } catch (error: any) {
      logger.error({
        module: 'engine',
        symbol: signal.symbol,
        tf: signal.tf,
        event: 'signal_error',
        ts: new Date().toISOString(),
        details: { error: error.message, rule: signal.rule },
      });
    }
  }

  async stop(): Promise<void> {
    logger.info({
      module: 'engine',
      event: 'stopping',
      ts: new Date().toISOString(),
    });

    await this.publisher.close();
    await this.db.close();
  }
}

async function main() {
  const engine = new Engine();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info({
      module: 'engine',
      event: 'shutdown',
      ts: new Date().toISOString(),
    });
    await engine.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info({
      module: 'engine',
      event: 'shutdown',
      ts: new Date().toISOString(),
    });
    await engine.stop();
    process.exit(0);
  });

  await engine.start();
}

main().catch((error) => {
  logger.error({
    module: 'engine',
    event: 'fatal_error',
    ts: new Date().toISOString(),
    details: { error: error.message, stack: error.stack },
  });
  process.exit(1);
});
