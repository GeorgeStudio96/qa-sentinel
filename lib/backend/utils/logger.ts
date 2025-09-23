/**
 * Structured logger for QA Sentinel Backend
 * Supports different log levels and JSON output for production
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  pid?: number;
  component?: string;
}

class Logger {
  private component: string;
  private minLevel: LogLevel;

  constructor(component: string = 'qa-sentinel', minLevel: LogLevel = 'info') {
    this.component = component;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
      pid: process.pid,
      component: this.component
    };
  }

  private output(entry: LogEntry): void {
    if (process.env.NODE_ENV === 'production') {
      // JSON output for production
      console.log(JSON.stringify(entry));
    } else {
      // Human-readable for development
      const timestamp = entry.timestamp.substring(11, 19);
      const levelUpper = entry.level.toUpperCase().padEnd(5);
      const component = entry.component ? `[${entry.component}]` : '';
      const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';

      console.log(`${timestamp} ${levelUpper} ${component} ${entry.message}${meta}`);
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      this.output(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, error?: Error | Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      let meta: Record<string, unknown> | undefined;

      if (error instanceof Error) {
        meta = {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
      } else if (error) {
        meta = error;
      }

      this.output(this.formatMessage('error', message, meta));
    }
  }

  child(component: string): Logger {
    return new Logger(`${this.component}:${component}`, this.minLevel);
  }
}

// Default logger instance
export const logger = new Logger('qa-sentinel',
  process.env.NODE_ENV === 'development' ? 'debug' : 'info'
);

// Create component-specific loggers
export const createLogger = (component: string): Logger =>
  logger.child(component);