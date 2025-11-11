export type Timeframe = '15m' | '1h' | '4h' | '1d';

export interface Candle {
  symbol: string;
  ts: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
}

export interface Signal {
  id?: bigint;
  rule: string;
  symbol: string;
  ts: Date;
  tf: Timeframe;
  strength: number;
  meta: Record<string, any>;
}

export interface BinanceKline {
  t: number; // open time
  T: number; // close time
  s: string; // symbol
  i: string; // interval
  f: number; // first trade id
  L: number; // last trade id
  o: string; // open
  c: string; // close
  h: string; // high
  l: string; // low
  v: string; // volume
  n: number; // trades
  x: boolean; // is closed
  q: string; // quote volume
  V: string; // taker buy base volume
  Q: string; // taker buy quote volume
  B: string; // ignore
}

export interface Config {
  pgHost: string;
  pgPort: number;
  pgUser: string;
  pgPassword: string;
  pgDatabase: string;
  redisUrl: string;
  universe: string[];
  exchange: string;
  binanceFuturesWs: string;
  binanceFuturesHttp: string;
  logLevel: string;
}
