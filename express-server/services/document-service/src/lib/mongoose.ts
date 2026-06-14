import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from './logger';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

async function connectWithRetry(attempt: number = 1): Promise<void> {
  try {
    logger.info(`MongoDB connection attempt ${attempt}/${MAX_RETRIES}`, {
      uri: config.mongodb.uri.replace(/\/\/[^@]+@/, '//***:***@'),
    });

    await mongoose.connect(config.mongodb.uri, {
      maxPoolSize: config.mongodb.poolSize,
      connectTimeoutMS: config.mongodb.connectTimeoutMs,
      socketTimeoutMS: config.mongodb.socketTimeoutMs,
      serverSelectionTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
    });

    logger.info('MongoDB connected successfully');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`MongoDB connection failed (attempt ${attempt}/${MAX_RETRIES})`, {
      error: err.message,
    });

    if (attempt < MAX_RETRIES) {
      logger.info(`Retrying MongoDB connection in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      await connectWithRetry(attempt + 1);
    } else {
      logger.error('Maximum MongoDB connection retries reached. Exiting.');
      process.exit(1);
    }
  }
}

export async function connectMongoDB(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    logger.info('Mongoose connection established');
  });

  mongoose.connection.on('error', (err: Error) => {
    logger.error('Mongoose connection error', { error: err.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('Mongoose disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('Mongoose reconnected');
  });

  process.on('SIGINT', async () => {
    await disconnectMongoDB();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await disconnectMongoDB();
    process.exit(0);
  });

  await connectWithRetry();
}

export async function disconnectMongoDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected gracefully');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error during MongoDB disconnect', { error: err.message });
  }
}

export function getMongooseConnection(): mongoose.Connection {
  return mongoose.connection;
}
