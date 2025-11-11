import { createClient } from 'redis';
import { Signal, loadConfig, logger } from '@aether/shared';

const config = loadConfig();

export class RedisPublisher {
  private client: ReturnType<typeof createClient>;
  private connected = false;

  constructor() {
    this.client = createClient({ url: config.redisUrl });

    this.client.on('error', (err) => {
      logger.error({
        module: 'engine',
        event: 'redis_error',
        ts: new Date().toISOString(),
        details: { error: err.message },
      });
    });
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
      logger.info({
        module: 'engine',
        event: 'redis_connected',
        ts: new Date().toISOString(),
      });
    }
  }

  async publish(signal: Signal): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    const channel = `signals:${signal.symbol}:${signal.tf}`;
    const payload = JSON.stringify({
      symbol: signal.symbol,
      tf: signal.tf,
      rule: signal.rule,
      strength: signal.strength,
      ts: signal.ts.toISOString(),
      meta: signal.meta,
    });

    await this.client.publish(channel, payload);

    logger.debug({
      module: 'engine',
      event: 'signal_published',
      symbol: signal.symbol,
      tf: signal.tf,
      ts: new Date().toISOString(),
      details: { rule: signal.rule, channel },
    });
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }
}
