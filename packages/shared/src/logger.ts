export interface LogContext {
  module: string;
  symbol?: string;
  tf?: string;
  event: string;
  ts: string;
  details?: any;
}

class Logger {
  private level: string;

  constructor() {
    this.level = process.env.LOG_LEVEL || 'info';
  }

  private log(level: string, context: Partial<LogContext>) {
    const entry = {
      level,
      ...context,
      ts: context.ts || new Date().toISOString(),
    };
    console.log(JSON.stringify(entry));
  }

  info(context: Partial<LogContext>) {
    this.log('info', context);
  }

  error(context: Partial<LogContext>) {
    this.log('error', context);
  }

  warn(context: Partial<LogContext>) {
    this.log('warn', context);
  }

  debug(context: Partial<LogContext>) {
    if (this.level === 'debug') {
      this.log('debug', context);
    }
  }
}

export const logger = new Logger();
