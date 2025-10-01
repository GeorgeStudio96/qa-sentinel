/**
 * Fastify routes for form testing
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  addFormTestingJob,
  getJobProgress,
  getQueueStats,
} from '../../queue/FormTestingQueue';
import { createLogger } from '../../shared/logger';
import type { FormTestRequest } from '../../modules/form-testing/types';

const logger = createLogger('form-testing-routes');

interface TestFormsBody {
  accessToken: string;
  userId?: string;
  siteIds?: string[];
  options?: {
    maxFormsToTest?: number;
    timeout?: number;
    testCases?: string[];
    realSubmission?: boolean;
    selectedPreset?: string;
  };
}

interface JobProgressParams {
  jobId: string;
}

export async function formTestingRoutes(server: FastifyInstance) {
  /**
   * POST /api/form-testing/start
   * Start form testing job
   */
  server.post<{ Body: TestFormsBody }>(
    '/api/form-testing/start',
    {
      schema: {
        body: {
          type: 'object',
          required: ['accessToken'],
          properties: {
            accessToken: { type: 'string' },
            siteIds: {
              type: 'array',
              items: { type: 'string' },
            },
            options: {
              type: 'object',
              properties: {
                maxFormsToTest: { type: 'number' },
                timeout: { type: 'number' },
                testCases: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: TestFormsBody }>, reply: FastifyReply) => {
      try {
        const { accessToken, userId, siteIds, options } = request.body;

        logger.info('Starting form testing job', { siteIds, options });

        // Create job request
        const jobRequest: FormTestRequest = {
          userId: userId || accessToken, // Use userId if provided, fallback to accessToken
          accessToken, // Store accessToken separately
          siteIds,
          options,
        };

        // Add to queue
        const jobId = await addFormTestingJob(jobRequest);

        logger.info(`Form testing job created: ${jobId}`);

        return reply.send({
          success: true,
          jobId,
          message: 'Form testing job started',
        });
      } catch (error) {
        logger.error('Error starting form testing job:', error as Error);

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start job',
        });
      }
    }
  );

  /**
   * GET /api/form-testing/progress/:jobId
   * Get job progress (for polling)
   */
  server.get<{ Params: JobProgressParams }>(
    '/api/form-testing/progress/:jobId',
    async (
      request: FastifyRequest<{ Params: JobProgressParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { jobId } = request.params;

        const progress = await getJobProgress(jobId);

        if (!progress) {
          return reply.code(404).send({
            success: false,
            error: 'Job not found',
          });
        }

        return reply.send({
          success: true,
          progress,
        });
      } catch (error) {
        logger.error('Error getting job progress:', error as Error);

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get progress',
        });
      }
    }
  );

  /**
   * GET /api/form-testing/progress/:jobId/stream
   * Stream job progress via Server-Sent Events
   */
  server.get<{ Params: JobProgressParams }>(
    '/api/form-testing/progress/:jobId/stream',
    async (
      request: FastifyRequest<{ Params: JobProgressParams }>,
      reply: FastifyReply
    ) => {
      const { jobId } = request.params;

      logger.info(`Starting SSE stream for job: ${jobId}`);

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      // Send initial progress
      const initialProgress = getJobProgress(jobId);
      if (initialProgress) {
        reply.raw.write(`data: ${JSON.stringify(initialProgress)}\n\n`);
      }

      // Poll for updates and stream them
      const intervalId = setInterval(async () => {
        const progress = await getJobProgress(jobId);

        if (!progress) {
          clearInterval(intervalId);
          reply.raw.end();
          return;
        }

        // Send progress update
        reply.raw.write(`data: ${JSON.stringify(progress)}\n\n`);

        // Close stream if completed or failed
        if (progress.status === 'completed' || progress.status === 'failed') {
          clearInterval(intervalId);
          reply.raw.end();
        }
      }, 500); // Poll every 500ms

      // Clean up on client disconnect
      request.raw.on('close', () => {
        clearInterval(intervalId);
        logger.info(`SSE stream closed for job: ${jobId}`);
      });
    }
  );

  /**
   * GET /api/form-testing/stats
   * Get queue statistics
   */
  server.get('/api/form-testing/stats', async (request, reply) => {
    try {
      const stats = await getQueueStats();

      return reply.send({
        success: true,
        stats,
      });
    } catch (error) {
      logger.error('Error getting queue stats:', error as Error);

      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats',
      });
    }
  });
}