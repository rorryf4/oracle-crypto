import WebSocket from 'ws';
import { Timeframe, BinanceKline, loadConfig, logger, Candle } from '@aether/shared';
import { Database } from './db.js';
import { Backfiller } from './backfill.js';

const config = loadConfig();

const TIMEFRAMES: Timeframe[] = ['15m', '1h', '4h', '1d'];

export class StreamManager {
  private db: Database;
  private backfiller: Backfiller;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 60000;
  private isReconnecting = false;
  private lastCandleTimestamp: Map<string, number> = new Map();
  private processedBars = 0;
  private healthInterval: NodeJS.Timeout | null = null;

  constructor(db: Database) {
    this.db = db;
    this.backfiller = new Backfiller(db);
  }

  async start(): Promise<void> {
    // Initial backfill for all symbols and timeframes
    logger.info({
      module: 'ingestor',
      event: 'initial_backfill_start',
      ts: new Date().toISOString(),
    });

    for (const symbol of config.universe) {
      for (const tf of TIMEFRAMES) {
        await this.backfiller.backfillSymbol(symbol, tf);
      }
    }

    logger.info({
      module: 'ingestor',
      event: 'initial_backfill_complete',
      ts: new Date().toISOString(),
    });

    // Start WebSocket stream
    this.connect();

    // Health logging every minute
    this.healthInterval = setInterval(() => {
      this.logHealth();
    }, 60000);
  }

  private connect(): void {
    const streams = this.buildStreamNames();
    const url = `${config.binanceFuturesWs}?streams=${streams.join('/')}`;

    logger.info({
      module: 'ingestor',
      event: 'ws_connecting',
      ts: new Date().toISOString(),
      details: { url },
    });

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      logger.info({
        module: 'ingestor',
        event: 'ws_connected',
        ts: new Date().toISOString(),
      });
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
    });

    this.ws.on('message', async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.data && msg.data.e === 'kline') {
          await this.handleKline(msg.data.k);
        }
      } catch (error: any) {
        logger.error({
          module: 'ingestor',
          event: 'message_parse_error',
          ts: new Date().toISOString(),
          details: { error: error.message },
        });
      }
    });

    this.ws.on('error', (error) => {
      logger.error({
        module: 'ingestor',
        event: 'ws_error',
        ts: new Date().toISOString(),
        details: { error: error.message },
      });
    });

    this.ws.on('close', () => {
      logger.warn({
        module: 'ingestor',
        event: 'ws_closed',
        ts: new Date().toISOString(),
      });

      if (!this.isReconnecting) {
        this.reconnect();
      }
    });
  }

  private async reconnect(): Promise<void> {
    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    logger.info({
      module: 'ingestor',
      event: 'reconnecting',
      ts: new Date().toISOString(),
      details: { attempt: this.reconnectAttempts, delayMs: delay },
    });

    await this.sleep(delay);

    // Backfill any gaps before reconnecting
    for (const symbol of config.universe) {
      for (const tf of TIMEFRAMES) {
        await this.backfiller.backfillSymbol(symbol, tf);
      }
    }

    this.connect();
  }

  private buildStreamNames(): string[] {
    const streams: string[] = [];
    for (const symbol of config.universe) {
      const lowerSymbol = symbol.toLowerCase();
      for (const tf of TIMEFRAMES) {
        streams.push(`${lowerSymbol}@kline_${tf}`);
      }
    }
    return streams;
  }

  private async handleKline(kline: BinanceKline): Promise<void> {
    // Only process closed candles
    if (!kline.x) return;

    const tf = kline.i as Timeframe;
    const candle: Candle = {
      symbol: kline.s,
      ts: new Date(kline.t),
      open: parseFloat(kline.o),
      high: parseFloat(kline.h),
      low: parseFloat(kline.l),
      close: parseFloat(kline.c),
      volume: parseFloat(kline.v),
      trades: kline.n,
    };

    await this.db.upsertCandle(tf, candle);

    const key = `${kline.s}:${tf}`;
    this.lastCandleTimestamp.set(key, kline.t);
    this.processedBars++;

    logger.debug({
      module: 'ingestor',
      symbol: kline.s,
      tf,
      event: 'candle_closed',
      ts: new Date().toISOString(),
      details: { candleTs: new Date(kline.t).toISOString() },
    });
  }

  private logHealth(): void {
    const status: any = {
      module: 'ingestor',
      event: 'health',
      ts: new Date().toISOString(),
      details: {
        processedBars: this.processedBars,
        activeStreams: this.lastCandleTimestamp.size,
        lastCandles: {},
      },
    };

    for (const [key, timestamp] of this.lastCandleTimestamp.entries()) {
      status.details.lastCandles[key] = new Date(timestamp).toISOString();
    }

    logger.info(status);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }

    if (this.ws) {
      this.ws.close();
    }

    await this.db.close();
  }
}
