import knex, { Knex } from 'knex';
import { config } from '../config';
import { logger } from './logger';

const knexConfig: Knex.Config = {
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
    min: 2,
    max: config.mysql.connectionLimit,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
  },
  acquireConnectionTimeout: 30000,
};

export const db: Knex = knex(knexConfig);

export async function connectDatabase(): Promise<void> {
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 5000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`MySQL connection attempt ${attempt}/${MAX_RETRIES}`);
      await db.raw('SELECT 1');
      logger.info('MySQL connected successfully');

      return;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`MySQL connection failed (attempt ${attempt}/${MAX_RETRIES})`, {
        error: err.message,
      });

      if (attempt < MAX_RETRIES) {
        logger.info(`Retrying MySQL connection in ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        logger.error('Maximum MySQL connection retries reached. Exiting.');
        process.exit(1);
      }
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await db.destroy();
    logger.info('MySQL disconnected gracefully');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error during MySQL disconnect', { error: err.message });
  }
}
