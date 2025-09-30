/**
 * BullMQ Worker for Form Testing
 * Processes form testing jobs from the queue
 */

import { createFormTestingWorker } from '../queue/FormTestingQueue';
import { createLogger } from '../shared/logger';

const logger = createLogger('form-testing-worker');

logger.info('Starting form testing worker...');

// Create and start worker (access token comes from each job)
const worker = createFormTestingWorker();

logger.info('Form testing worker started successfully');

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down worker...');
  await worker.close();
  logger.info('Worker shut down successfully');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error as Error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error as Error);
  process.exit(1);
});