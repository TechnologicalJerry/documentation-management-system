import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const stackStr = typeof stack === 'string' ? `\n${stack}` : '';

    return `${String(ts)} [${level}] ${String(message)}${metaStr}${stackStr}`;
  }),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: { service: config.app.serviceName },
  format: config.app.isProduction ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console({
      silent: config.app.isTest,
    }),
  ],
  exitOnError: false,
});

export type Logger = typeof logger;
