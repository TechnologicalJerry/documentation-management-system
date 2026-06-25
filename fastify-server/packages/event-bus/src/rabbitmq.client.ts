import amqp, { ChannelModel, Channel, ConfirmChannel, Options } from 'amqplib';
import { EventEmitter } from 'events';
import { EXCHANGES, QUEUES, getRabbitMQConfig } from '@devdocs/shared-config';

export type LoggerLike = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
};

export interface RabbitMQClientOptions {
  logger?: LoggerLike;
  serviceName?: string;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'closing' | 'closed';

/**
 * RabbitMQ connection manager with automatic reconnection logic.
 * Emits events: 'connected', 'disconnected', 'error', 'reconnecting'
 */
export class RabbitMQClient extends EventEmitter {
  private connection: ChannelModel | null = null;
  private publishChannel: ConfirmChannel | null = null;
  private consumerChannels: Map<string, Channel> = new Map();
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly config = getRabbitMQConfig();
  private readonly logger: LoggerLike;
  private readonly serviceName: string;

  constructor(options: RabbitMQClientOptions = {}) {
    super();
    this.logger = options.logger ?? {
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };
    this.serviceName = options.serviceName ?? 'unknown-service';
  }

  get isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Connect to RabbitMQ and set up topology (exchanges + queues).
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') return;

    this.state = 'connecting';
    this.logger.info(`[EventBus] Connecting to RabbitMQ`, { service: this.serviceName });

    try {
      const connectOptions: Options.Connect = {
        heartbeat: this.config.heartbeat,
        vhost: this.config.vhost,
      };

      this.connection = await amqp.connect(this.config.url, connectOptions);

      this.connection.on('error', (err: Error) => {
        this.logger.error('[EventBus] Connection error', { error: err.message });
        this.handleDisconnect();
      });

      this.connection.on('close', () => {
        if (this.state !== 'closing' && this.state !== 'closed') {
          this.logger.warn('[EventBus] Connection closed unexpectedly');
          this.handleDisconnect();
        }
      });

      // Set up publish channel (confirm mode for reliability)
      this.publishChannel = await this.connection.createConfirmChannel();
      this.publishChannel.on('error', (err: Error) => {
        this.logger.error('[EventBus] Publish channel error', { error: err.message });
      });

      await this.publishChannel.prefetch(this.config.prefetchCount);

      // Assert all exchanges and queues
      await this.setupTopology(this.publishChannel);

      this.state = 'connected';
      this.reconnectAttempts = 0;

      this.logger.info('[EventBus] Connected to RabbitMQ', { service: this.serviceName });
      this.emit('connected');
    } catch (error) {
      this.state = 'disconnected';
      const err = error as Error;
      this.logger.error('[EventBus] Failed to connect', { error: err.message });
      this.scheduleReconnect();
      throw error;
    }
  }

  private async setupTopology(channel: Channel | ConfirmChannel): Promise<void> {
    // Assert all exchanges
    for (const exchange of Object.values(EXCHANGES)) {
      await channel.assertExchange(exchange.name, exchange.type, {
        durable: exchange.durable,
        autoDelete: exchange.autoDelete,
      });
    }

    // Assert all queues
    for (const queue of Object.values(QUEUES)) {
      await channel.assertQueue(queue.name, {
        durable: queue.durable,
        autoDelete: queue.autoDelete,
        exclusive: queue.exclusive,
        arguments: (queue as any).arguments ?? {},
      });
    }

    this.logger.debug('[EventBus] Topology setup complete');
  }

  /**
   * Create a dedicated consumer channel with its own topology setup.
   */
  async createConsumerChannel(channelId: string): Promise<Channel> {
    if (!this.connection) throw new Error('Not connected to RabbitMQ');

    const existing = this.consumerChannels.get(channelId);
    if (existing) return existing;

    const channel = await this.connection.createChannel();
    await channel.prefetch(this.config.prefetchCount);

    channel.on('error', (err: Error) => {
      this.logger.error(`[EventBus] Consumer channel [${channelId}] error`, { error: err.message });
      this.consumerChannels.delete(channelId);
    });

    channel.on('close', () => {
      this.consumerChannels.delete(channelId);
    });

    await this.setupTopology(channel);
    this.consumerChannels.set(channelId, channel);
    return channel;
  }

  getPublishChannel(): ConfirmChannel {
    if (!this.publishChannel || !this.isConnected) {
      throw new Error('RabbitMQ is not connected. Cannot get publish channel.');
    }
    return this.publishChannel;
  }

  private handleDisconnect(): void {
    this.state = 'disconnected';
    this.publishChannel = null;
    this.consumerChannels.clear();
    this.emit('disconnected');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.error(
        `[EventBus] Max reconnect attempts (${this.config.maxReconnectAttempts}) reached. Giving up.`,
      );
      this.state = 'closed';
      this.emit('error', new Error('RabbitMQ max reconnect attempts exceeded'));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      60000, // max 60 seconds
    );

    this.logger.warn(
      `[EventBus] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`,
    );

    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        // scheduleReconnect is called again inside connect() on failure
      }
    }, delay);
  }

  /**
   * Gracefully close the connection.
   */
  async close(): Promise<void> {
    this.state = 'closing';

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    for (const channel of this.consumerChannels.values()) {
      try {
        await channel.close();
      } catch {
        // Ignore errors on close
      }
    }
    this.consumerChannels.clear();

    if (this.publishChannel) {
      try {
        await this.publishChannel.close();
      } catch {
        // Ignore errors on close
      }
      this.publishChannel = null;
    }

    if (this.connection) {
      try {
        await this.connection.close();
      } catch {
        // Ignore errors on close
      }
      this.connection = null;
    }

    this.state = 'closed';
    this.logger.info('[EventBus] Connection closed gracefully');
    this.emit('closed');
  }
}

// Singleton instance per process
let defaultClient: RabbitMQClient | null = null;

export function getDefaultRabbitMQClient(options?: RabbitMQClientOptions): RabbitMQClient {
  if (!defaultClient) {
    defaultClient = new RabbitMQClient(options);
  }
  return defaultClient;
}
