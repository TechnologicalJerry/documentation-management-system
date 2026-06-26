import winston from 'winston';
import { config } from '../config';

export const logger = winston.createLogger({
  level: config.app.isProduction ? 'info' : 'debug',
  defaultMeta: { service: config.app.name },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});
