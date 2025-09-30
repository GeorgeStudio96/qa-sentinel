/**
 * Form Testing Job Queue
 * Handles high-volume form testing requests with BullMQ
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { FormTestingOrchestrator } from '../modules/form-testing';
import { createLogger } from '../shared/logger';
import type { FormTestRequest, FormTestProgress } from '../modules/form-testing/types';

const logger = createLogger('form-testing-queue');

// Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Create queue
export const formTestingQueue = new Queue<FormTestRequest>('form-testing', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  },
});

// Progress storage (in-memory for now, can be moved to Redis if needed)
const progressStore = new Map<string, FormTestProgress>();

/**
 * Add form testing job to queue
 */
export async function addFormTestingJob(
  request: FormTestRequest,
  priority: number = 10
): Promise<string> {
  const job = await formTestingQueue.add('test-forms', request, {
    priority, // Lower number = higher priority
    jobId: `test-${request.userId}-${Date.now()}`,
  });

  logger.info(`Added form testing job: ${job.id}`);

  // Initialize progress
  if (job.id) {
    progressStore.set(job.id, {
      status: 'queued',
      currentStep: 'Queued for processing',
      totalSites: 0,
      processedSites: 0,
      totalForms: 0,
      testedForms: 0,
    });
  }

  return job.id || '';
}

/**
 * Get job progress
 */
export function getJobProgress(jobId: string): FormTestProgress | null {
  return progressStore.get(jobId) || null;
}

/**
 * Create worker to process jobs
 */
export function createFormTestingWorker(accessToken: string): Worker {
  const orchestrator = new FormTestingOrchestrator();

  const worker = new Worker<FormTestRequest>(
    'form-testing',
    async (job: Job<FormTestRequest>) => {
      logger.info(`Processing job: ${job.id}`);

      try {
        // Initialize orchestrator
        await orchestrator.initialize();

        // Update progress callback
        const progressCallback = (progress: FormTestProgress) => {
          if (job.id) {
            progressStore.set(job.id, progress);
          }

          // Update job progress
          job.updateProgress(progress);
        };

        // Add access token to request
        const requestWithToken = {
          ...job.data,
          userId: accessToken, // Pass access token as userId (will be used by WebflowApiClient)
        };

        // Run tests
        const results = await orchestrator.runFormTests(
          requestWithToken,
          progressCallback
        );

        logger.info(`Job ${job.id} completed with ${results.length} results`);

        return results;
      } catch (error) {
        logger.error(`Job ${job.id} failed:`, error as Error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 5, // Process 5 jobs concurrently
      limiter: {
        max: 10, // Max 10 jobs per duration
        duration: 1000, // per 1 second
      },
    }
  );

  // Worker event handlers
  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, error) => {
    logger.error(`Job ${job?.id} failed:`, error as Error);

    if (job?.id) {
      progressStore.set(job.id, {
        status: 'failed',
        currentStep: 'Job failed',
        totalSites: 0,
        processedSites: 0,
        totalForms: 0,
        testedForms: 0,
        error: error.message,
      });
    }
  });

  worker.on('error', (error) => {
    logger.error('Worker error:', error as Error);
  });

  return worker;
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    formTestingQueue.getWaitingCount(),
    formTestingQueue.getActiveCount(),
    formTestingQueue.getCompletedCount(),
    formTestingQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed,
  };
}

/**
 * Clean up old jobs
 */
export async function cleanQueue() {
  await formTestingQueue.clean(24 * 60 * 60 * 1000, 1000, 'completed'); // Clean completed jobs older than 24h
  await formTestingQueue.clean(7 * 24 * 60 * 60 * 1000, 1000, 'failed'); // Clean failed jobs older than 7 days
}