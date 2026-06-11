import winston, { Logger, LoggerOptions } from 'winston';

export interface LoggerConfig {
  serviceName: string;
  level?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  logDir?: string;
}

const { combine, timestamp, errors, json, colorize, printf, splat } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, service, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${service}] ${level}: ${message}${metaStr}`;
});

const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  json(),
);

const developmentFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  splat(),
  devFormat,
);

export function createLogger(config: LoggerConfig): Logger {
  const {
    serviceName,
    level = process.env['LOG_LEVEL'] || 'info',
    enableConsole = true,
    enableFile = false,
    logDir = 'logs',
  } = config;

  const isProduction = process.env['NODE_ENV'] === 'production';

  const transports: winston.transport[] = [];

  if (enableConsole) {
    transports.push(
      new winston.transports.Console({
        format: isProduction ? productionFormat : developmentFormat,
      }),
    );
  }

  if (enableFile) {
    transports.push(
      new winston.transports.File({
        filename: `${logDir}/error.log`,
        level: 'error',
        format: productionFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }),
    );
    transports.push(
      new winston.transports.File({
        filename: `${logDir}/combined.log`,
        format: productionFormat,
        maxsize: 10 * 1024 * 1024,
        maxFiles: 10,
      }),
    );
  }

  const loggerOptions: LoggerOptions = {
    level,
    defaultMeta: { service: serviceName },
    transports,
    exitOnError: false,
  };

  const logger = winston.createLogger(loggerOptions);

  (logger as any).http = (
    msg: string,
    meta?: Record<string, unknown>,
  ) => logger.info(msg, { ...meta, category: 'http' });

  return logger;
}

// Default logger instance
export const logger = createLogger({
  serviceName: 'devdocs',
  level: process.env['LOG_LEVEL'] || 'info',
});

export type AppLogger = Logger;
