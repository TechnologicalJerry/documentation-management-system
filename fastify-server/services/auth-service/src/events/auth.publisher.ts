import { RabbitMQClient, EventPublisher } from '@devdocs/event-bus';
import { EXCHANGES, ROUTING_KEYS } from '@devdocs/shared-config';
import { logger } from '../lib/logger';

export class AuthPublisher {
  private readonly client = new RabbitMQClient({ serviceName: 'auth-service', logger });
  private publisher: EventPublisher | null = null;

  async connect(): Promise<void> {
    await this.client.connect();
    this.publisher = new EventPublisher(this.client, {
      serviceName: 'auth-service',
      logger,
    });
  }

  async publishUserCreated(user: { id: string; email: string; firstName: string; lastName: string }): Promise<void> {
    if (!this.publisher) {return;}
    await this.publisher.publishEvent(
      ROUTING_KEYS.USER_CREATED,
      {
        payload: {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: 'USER',
        },
      },
      EXCHANGES.USERS.name,
      ROUTING_KEYS.USER_CREATED,
    );
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
