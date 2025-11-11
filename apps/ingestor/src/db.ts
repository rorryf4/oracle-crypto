import pg from 'pg';
import { Candle, Timeframe, loadConfig } from '@aether/shared';

const config = loadConfig();

export class Database {
  private pool: pg.Pool;

  constructor() {
    this.pool = new pg.Pool({
      host: config.pgHost,
      port: config.pgPort,
      user: config.pgUser,
      password: config.pgPassword,
      database: config.pgDatabase,
      max: 20,
    });
  }

  async upsertCandle(tf: Timeframe, candle: Candle): Promise<void> {
    const table = `candles_${tf}`;
    const query = `
      INSERT INTO ${table} (symbol, ts, open, high, low, close, volume, trades)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (symbol, ts) DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume,
        trades = EXCLUDED.trades
    `;

    await this.pool.query(query, [
      candle.symbol,
      candle.ts,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
      candle.trades,
    ]);
  }

  async getLastCandleTime(symbol: string, tf: Timeframe): Promise<Date | null> {
    const table = `candles_${tf}`;
    const query = `SELECT MAX(ts) as last_ts FROM ${table} WHERE symbol = $1`;
    const result = await this.pool.query(query, [symbol]);

    if (result.rows.length > 0 && result.rows[0].last_ts) {
      return new Date(result.rows[0].last_ts);
    }
    return null;
  }

  async getCandleCount(symbol: string, tf: Timeframe): Promise<number> {
    const table = `candles_${tf}`;
    const query = `SELECT COUNT(*) as count FROM ${table} WHERE symbol = $1`;
    const result = await this.pool.query(query, [symbol]);
    return parseInt(result.rows[0].count);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
