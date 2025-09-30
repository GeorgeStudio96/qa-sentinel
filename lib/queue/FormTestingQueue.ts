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

// Use Redis for progress storage instead of in-memory Map
// so that Worker and API server can share progress data
const progressRedis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});

async function saveProgress(jobId: string, progress: FormTestProgress): Promise<void> {
  await progressRedis.set(
    `form-testing:progress:${jobId}`,
    JSON.stringify(progress),
    'EX',
    600 // Expire after 10 minutes
  );
}

async function getProgress(jobId: string): Promise<FormTestProgress | null> {
  const data = await progressRedis.get(`form-testing:progress:${jobId}`);
  return data ? JSON.parse(data) : null;
}

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

  // Initialize progress in Redis
  if (job.id) {
    await saveProgress(job.id, {
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
export async function getJobProgress(jobId: string): Promise<FormTestProgress | null> {
  return await getProgress(jobId);
}

/**
 * Create worker to process jobs
 */
export function createFormTestingWorker(): Worker {
  const orchestrator = new FormTestingOrchestrator();

  const worker = new Worker<FormTestRequest>(
    'form-testing',
    async (job: Job<FormTestRequest>) => {
      logger.info(`Processing job: ${job.id}`);

      try {
        // Initialize orchestrator
        await orchestrator.initialize();

        // Update progress callback (non-blocking)
        const progressCallback = (progress: FormTestProgress) => {
          logger.info(`Progress callback called for job ${job.id}:`, {
            status: progress.status,
            totalForms: progress.totalForms,
            testedForms: progress.testedForms
          });
          if (job.id) {
            // Save to Redis (non-blocking)
            void saveProgress(job.id, progress).then(() => {
              logger.info(`Progress saved to Redis for job ${job.id}`);
            });
          }

          // Update job progress
          job.updateProgress(progress);
        };

        // Run tests (access token is already in job.data.userId)
        const results = await orchestrator.runFormTests(
          job.data,
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

  worker.on('failed', async (job, error) => {
    logger.error(`Job ${job?.id} failed:`, error as Error);

    if (job?.id) {
      await saveProgress(job.id, {
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