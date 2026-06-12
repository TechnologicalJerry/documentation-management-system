import { EventEmitter } from 'events';
import { config } from '../config';
import { logger } from '../lib/logger';
import { QueueFullError } from '../lib/errors';

export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export interface QueueJob<T = unknown> {
  id: string;
  payload: T;
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export type JobHandler<T> = (job: QueueJob<T>) => Promise<void>;

/**
 * In-memory concurrency-limited queue.
 *
 * - Maintains a list of pending jobs and a cap of concurrently running jobs.
 * - Emits events for job lifecycle: 'job:start', 'job:done', 'job:failed'.
 * - Can be swapped for a Bull/BullMQ-backed implementation without changing callers.
 */
export class QueueService<T = unknown> extends EventEmitter {
  private readonly jobs = new Map<string, QueueJob<T>>();
  private readonly pendingQueue: string[] = [];
  private runningCount = 0;
  private readonly maxConcurrent: number;
  private handler: JobHandler<T> | null = null;

  constructor(maxConcurrent?: number) {
    super();
    this.maxConcurrent = maxConcurrent ?? config.ai.maxConcurrentGenerations;
  }

  /**
   * Register the handler that will process each job.
   */
  registerHandler(handler: JobHandler<T>): void {
    this.handler = handler;
  }

  /**
   * Enqueue a new job. Throws QueueFullError if the queue is at capacity.
   */
  enqueue(id: string, payload: T): QueueJob<T> {
    const totalPending = this.pendingQueue.length + this.runningCount;
    if (totalPending >= this.maxConcurrent * 10) {
      throw new QueueFullError();
    }

    const job: QueueJob<T> = {
      id,
      payload,
      status: 'pending',
      createdAt: new Date(),
    };

    this.jobs.set(id, job);
    this.pendingQueue.push(id);

    logger.debug('Job enqueued', { jobId: id, queueLength: this.pendingQueue.length });

    // Kick off next tick so the caller can set up listeners before the job starts
    setImmediate(() => this.drain());

    return job;
  }

  /**
   * Cancel a pending job. Running jobs are marked but the handler must check.
   */
  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) {return false;}

    if (job.status === 'pending') {
      const idx = this.pendingQueue.indexOf(id);
      if (idx !== -1) {
        this.pendingQueue.splice(idx, 1);
      }
      job.status = 'cancelled';
      job.completedAt = new Date();
      this.emit('job:cancelled', job);
      logger.debug('Job cancelled', { jobId: id });

      return true;
    }

    if (job.status === 'running') {
      // Cannot truly cancel a running async job without an AbortController wired up.
      // Mark it as cancelled so the caller can detect it during streaming.
      job.status = 'cancelled';
      this.emit('job:cancelled', job);

      return true;
    }

    return false;
  }

  getJob(id: string): QueueJob<T> | undefined {
    return this.jobs.get(id);
  }

  getStats(): { pending: number; running: number; total: number } {
    return {
      pending: this.pendingQueue.length,
      running: this.runningCount,
      total: this.jobs.size,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private drain(): void {
    while (this.runningCount < this.maxConcurrent && this.pendingQueue.length > 0) {
      const jobId = this.pendingQueue.shift();
      if (!jobId) {break;}

      const job = this.jobs.get(jobId);
      if (!job) {continue;}

      // May have been cancelled while waiting
      if (job.status === 'cancelled') {continue;}

      void this.runJob(job);
    }
  }

  private async runJob(job: QueueJob<T>): Promise<void> {
    if (!this.handler) {
      logger.error('No handler registered for queue job', { jobId: job.id });

      return;
    }

    job.status = 'running';
    job.startedAt = new Date();
    this.runningCount++;
    this.emit('job:start', job);

    logger.debug('Job started', { jobId: job.id, running: this.runningCount });

    try {
      await this.handler(job);

      // The handler may have already transitioned the job (e.g. to COMPLETED).
      // Only set done if still running.
      if (job.status === 'running') {
        job.status = 'done';
      }
      job.completedAt = new Date();
      this.emit('job:done', job);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      job.status = 'failed';
      job.error = err.message;
      job.completedAt = new Date();
      this.emit('job:failed', job);
      logger.error('Job failed', { jobId: job.id, error: err.message });
    } finally {
      this.runningCount--;
      logger.debug('Job finished', { jobId: job.id, running: this.runningCount });
      this.drain();
    }
  }
}

// Singleton instance used by the generation service
export const generationQueue = new QueueService();
