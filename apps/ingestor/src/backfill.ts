import axios from 'axios';
import { Candle, Timeframe, BinanceKline, loadConfig, logger } from '@aether/shared';
import { Database } from './db.js';

const config = loadConfig();

const TF_TO_MINUTES: Record<Timeframe, number> = {
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};

export class Backfiller {
  private db: Database;
  private baseUrl: string;

  constructor(db: Database) {
    this.db = db;
    this.baseUrl = config.binanceFuturesHttp;
  }

  async backfillSymbol(symbol: string, tf: Timeframe): Promise<number> {
    const lastTs = await this.db.getLastCandleTime(symbol, tf);
    const now = Date.now();
    const tfMs = TF_TO_MINUTES[tf] * 60 * 1000;

    let startTime: number;
    if (lastTs) {
      // Start from next bar after last known
      startTime = lastTs.getTime() + tfMs;
    } else {
      // No data yet - fetch last 500 bars
      startTime = now - (500 * tfMs);
    }

    if (startTime >= now) {
      // Already up to date
      return 0;
    }

    logger.info({
      module: 'backfill',
      symbol,
      tf,
      event: 'start',
      ts: new Date().toISOString(),
      details: { startTime: new Date(startTime).toISOString() },
    });

    let candleCount = 0;
    let currentStart = startTime;

    while (currentStart < now) {
      try {
        const klines = await this.fetchKlines(symbol, tf, currentStart, 1000);

        for (const kline of klines) {
          const candle = this.parseKline(kline);
          await this.db.upsertCandle(tf, candle);
          candleCount++;
        }

        if (klines.length === 0) break;

        // Move to next batch
        const lastKline = klines[klines.length - 1];
        currentStart = lastKline[6] + 1; // closeTime + 1ms

        // Respect rate limits
        await this.sleep(100);
      } catch (error: any) {
        logger.error({
          module: 'backfill',
          symbol,
          tf,
          event: 'error',
          ts: new Date().toISOString(),
          details: { error: error.message },
        });
        break;
      }
    }

    logger.info({
      module: 'backfill',
      symbol,
      tf,
      event: 'complete',
      ts: new Date().toISOString(),
      details: { candleCount },
    });

    return candleCount;
  }

  private async fetchKlines(
    symbol: string,
    tf: Timeframe,
    startTime: number,
    limit: number
  ): Promise<any[]> {
    const url = `${this.baseUrl}/fapi/v1/klines`;
    const response = await axios.get(url, {
      params: {
        symbol,
        interval: tf,
        startTime,
        limit,
      },
      timeout: 10000,
    });

    return response.data;
  }

  private parseKline(kline: any): Candle {
    return {
      symbol: '',  // Will be set by caller
      ts: new Date(kline[0]),
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
      trades: kline[8],
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
