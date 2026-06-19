import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const developmentFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  simple(),
);

const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

export const logger = winston.createLogger({
  level: config.logging.level,
  format: config.logging.format === 'json' ? productionFormat : developmentFormat,
  defaultMeta: { service: config.app.serviceName },
  transports: [
    new winston.transports.Console({
      silent: config.app.isTest,
    }),
  ],
  exitOnError: false,
});
