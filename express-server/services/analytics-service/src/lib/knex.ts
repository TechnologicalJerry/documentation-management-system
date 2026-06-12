import knex, { Knex } from 'knex';
import { config } from '../config';
import { logger } from './logger';

export const db: Knex = knex({
  client: 'mysql2',
  connection: {
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    charset: 'utf8mb4',
    timezone: '+00:00',
  },
  pool: {
    min: 1,
    max: config.mysql.connectionLimit,
  },
});

export async function connectDatabase(): Promise<void> {
  await db.raw('SELECT 1');
  logger.info('MySQL connected');
}

export async function disconnectDatabase(): Promise<void> {
  await db.destroy();
  logger.info('MySQL disconnected');
}
