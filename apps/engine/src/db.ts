import pg from 'pg';
import { Candle, Signal, Timeframe, loadConfig } from '@aether/shared';

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

  async getCandles(symbol: string, tf: Timeframe, limit: number = 400): Promise<Candle[]> {
    const table = `candles_${tf}`;
    const query = `
      SELECT symbol, ts, open, high, low, close, volume, trades
      FROM ${table}
      WHERE symbol = $1
      ORDER BY ts DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [symbol, limit]);

    return result.rows
      .reverse()
      .map(row => ({
        symbol: row.symbol,
        ts: new Date(row.ts),
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseFloat(row.volume),
        trades: row.trades,
      }));
  }

  async insertSignal(signal: Signal): Promise<void> {
    const query = `
      INSERT INTO signals (rule, symbol, ts, tf, strength, meta)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
    `;

    await this.pool.query(query, [
      signal.rule,
      signal.symbol,
      signal.ts,
      signal.tf,
      signal.strength,
      JSON.stringify(signal.meta),
    ]);
  }

  async getLastSignal(symbol: string, tf: Timeframe, rule: string): Promise<Signal | null> {
    const query = `
      SELECT rule, symbol, ts, tf, strength, meta
      FROM signals
      WHERE symbol = $1 AND tf = $2 AND rule = $3
      ORDER BY ts DESC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [symbol, tf, rule]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      rule: row.rule,
      symbol: row.symbol,
      ts: new Date(row.ts),
      tf: row.tf,
      strength: parseFloat(row.strength),
      meta: row.meta,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
