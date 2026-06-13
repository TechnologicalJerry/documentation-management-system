import { RabbitMQClient, EventConsumer } from '@devdocs/event-bus';
import { QUEUES } from '@devdocs/shared-config';
import { AuditService } from '../services/audit.service';
import { logger } from '../lib/logger';

export class AuditConsumer {
  private readonly client = new RabbitMQClient({ serviceName: 'audit-service', logger });
  private consumer: EventConsumer | null = null;

  constructor(private readonly service = new AuditService()) {}

  async start(): Promise<void> {
    await this.client.connect();
    this.consumer = new EventConsumer(this.client, {
      serviceName: 'audit-service',
      logger,
    });
    await this.consumer.subscribe(QUEUES.AUDIT_SERVICE_QUEUE.name, async (event) => {
      const message = event as unknown as { payload?: unknown; data?: unknown };
      const payload = message.payload ?? message.data;
      if (typeof payload === 'object' && payload !== null) {
        await this.service.create(payload as Parameters<AuditService['create']>[0]);
      }
    });
  }

  async stop(): Promise<void> {
    await this.client.close();
  }
}
