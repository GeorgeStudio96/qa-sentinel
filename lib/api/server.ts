import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { QAScanningEngine } from '../backend';
import { createLogger } from '../backend/utils/logger';
import { db } from '../database/supabase-client';
import { webflowRoutes } from './webflow/routes';

const logger = createLogger('api-server');

// Initialize scanning engine globally
let scanningEngine: QAScanningEngine;

export async function createServer() {
  const server = Fastify({
    logger: process.env.NODE_ENV === 'development',
    trustProxy: true
  });

  // Register security plugins
  await server.register(helmet, {
    contentSecurityPolicy: false // Allow Next.js to handle CSP
  });

  await server.register(cors, {
    origin: [
      'http://localhost:3000',
      'https://qa-sentinel.vercel.app'
    ],
    credentials: true
  });

  await server.register(rateLimit, {
    max: 100, // 100 requests per window
    timeWindow: '1 minute'
  });

  // Initialize scanning engine
  scanningEngine = new QAScanningEngine({
    browserPoolOptions: {
      minPoolSize: parseInt(process.env.BROWSER_POOL_MIN_SIZE || '2'),
      maxPoolSize: parseInt(process.env.BROWSER_POOL_MAX_SIZE || '5'),
      maxBrowserAge: 30 * 60 * 1000, // 30 minutes
      healthCheckInterval: 30000 // 30 seconds
    },
    memoryMonitorOptions: {
      warningThreshold: parseInt(process.env.MEMORY_WARNING_THRESHOLD || '400') * 1024 * 1024,
      criticalThreshold: parseInt(process.env.MEMORY_CRITICAL_THRESHOLD || '600') * 1024 * 1024
    }
  });

  // Register Webflow integration routes
  await server.register(webflowRoutes);

  // Health check endpoint
  server.get('/api/health', async () => {
    const health = scanningEngine.getHealthStatus();
    const stats = scanningEngine.getStats();

    return {
      status: health.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks: health.checks,
      browser_pool: stats.browserPool,
      active_scans: stats.activeScans
    };
  });

  // System stats endpoint
  server.get('/api/stats', async () => {
    return scanningEngine.getStats();
  });

  // Enhanced scan endpoint with form analysis
  server.post<{
    Body: {
      url: string;
      options?: {
        timeout?: number;
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
        viewport?: { width: number; height: number };
        maxPages?: number;
        testFormSubmissions?: boolean;
        formTestData?: Record<string, Record<string, string>>;
        skipFormSubmissionFor?: string[];
      };
    };
  }>('/api/scan/forms', {
    schema: {
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            pattern: '^https?://'
          },
          options: {
            type: 'object',
            properties: {
              timeout: { type: 'number', minimum: 5000, maximum: 60000 },
              waitUntil: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle'] },
              viewport: {
                type: 'object',
                properties: {
                  width: { type: 'number', minimum: 320, maximum: 1920 },
                  height: { type: 'number', minimum: 240, maximum: 1080 }
                },
                required: ['width', 'height']
              },
              maxPages: { type: 'number', minimum: 1, maximum: 10 },
              testFormSubmissions: { type: 'boolean' },
              formTestData: { type: 'object' },
              skipFormSubmissionFor: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { url, options } = request.body;

    logger.info('Starting enhanced form scan request', { url, options });

    try {
      const scanResult = await scanningEngine.scanWebsiteWithForms({
        url,
        options: {
          timeout: options?.timeout || 30000,
          waitUntil: options?.waitUntil || 'networkidle',
          viewport: options?.viewport,
          maxPages: options?.maxPages || 5,
          testFormSubmissions: options?.testFormSubmissions !== false,
          formTestData: options?.formTestData,
          skipFormSubmissionFor: options?.skipFormSubmissionFor
        }
      });

      logger.info('Enhanced scan completed', {
        url,
        totalPages: scanResult.summary.totalPages,
        totalForms: scanResult.summary.totalForms,
        formsWithIssues: scanResult.summary.formsWithIssues,
        duration: scanResult.summary.totalDuration
      });

      return {
        success: true,
        data: {
          mainUrl: scanResult.mainUrl,
          summary: scanResult.summary,
          pages: scanResult.pages.map(page => ({
            url: page.url,
            success: page.success,
            duration: page.duration,
            formsCount: page.forms.length,
            formsWithIssues: page.forms.filter(form =>
              form.fieldAnalysis.validation.some(v => !v.isValid) ||
              form.fieldAnalysis.accessibility.length > 0 ||
              !form.submissionResult.success
            ).length,
            screenshot_size: page.screenshot?.length || 0,
            errors: page.errors
          })),
          timestamp: scanResult.timestamp
        }
      };

    } catch (error) {
      logger.error('Enhanced scan failed', error instanceof Error ? error : { error: String(error) });

      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Single website scan endpoint
  server.post<{
    Body: {
      url: string;
      options?: {
        timeout?: number;
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
        viewport?: { width: number; height: number };
      };
    };
  }>('/api/scan', {
    schema: {
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            pattern: '^https?://'
          },
          options: {
            type: 'object',
            properties: {
              timeout: { type: 'number', minimum: 5000, maximum: 60000 },
              waitUntil: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle'] },
              viewport: {
                type: 'object',
                properties: {
                  width: { type: 'number', minimum: 320, maximum: 1920 },
                  height: { type: 'number', minimum: 240, maximum: 1080 }
                },
                required: ['width', 'height']
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { url, options } = request.body;

    logger.info('Starting scan request', { url, options });

    try {
      const scanResult = await scanningEngine.scanWebsite({
        url,
        options: {
          timeout: options?.timeout || 30000,
          waitUntil: options?.waitUntil || 'networkidle',
          viewport: options?.viewport
        }
      });

      // Save scan results to database
      const { site, scan } = await db.storeScanResults(url, {
        success: scanResult.success,
        duration: scanResult.duration,
        errors: scanResult.errors
      });

      logger.info('Scan completed and saved to database', {
        url,
        siteId: site.id,
        scanId: scan.id,
        success: scanResult.success,
        duration: scanResult.duration,
        screenshotSize: scanResult.screenshot?.length || 0
      });

      return {
        success: true,
        data: {
          scan_id: scan.id,
          site_id: site.id,
          url: scanResult.url,
          success: scanResult.success,
          duration: scanResult.duration,
          timestamp: scanResult.timestamp,
          screenshot_size: scanResult.screenshot?.length || 0,
          metrics: scanResult.metrics,
          errors: scanResult.errors
        }
      };

    } catch (error) {
      logger.error('Scan failed', error instanceof Error ? error : { error: String(error) });

      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Batch scan endpoint
  server.post<{
    Body: {
      urls: string[];
      options?: {
        timeout?: number;
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
        viewport?: { width: number; height: number };
      };
    };
  }>('/api/scan/batch', {
    schema: {
      body: {
        type: 'object',
        required: ['urls'],
        properties: {
          urls: {
            type: 'array',
            items: {
              type: 'string',
              format: 'uri',
              pattern: '^https?://'
            },
            minItems: 1,
            maxItems: 10 // Limit batch size
          },
          options: {
            type: 'object',
            properties: {
              timeout: { type: 'number', minimum: 5000, maximum: 60000 },
              waitUntil: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle'] },
              viewport: {
                type: 'object',
                properties: {
                  width: { type: 'number', minimum: 320, maximum: 1920 },
                  height: { type: 'number', minimum: 240, maximum: 1080 }
                },
                required: ['width', 'height']
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { urls, options } = request.body;

    logger.info('Starting batch scan request', { urlCount: urls.length });

    try {
      const scanRequests = urls.map(url => ({
        url,
        options: {
          timeout: options?.timeout || 30000,
          waitUntil: options?.waitUntil || 'networkidle',
          viewport: options?.viewport
        }
      }));

      const results = await scanningEngine.scanMultipleWebsites(scanRequests);

      const summary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        total_duration: results.reduce((sum, r) => sum + r.duration, 0)
      };

      logger.info('Batch scan completed', summary);

      return {
        success: true,
        summary,
        results: results.map(result => ({
          url: result.url,
          success: result.success,
          duration: result.duration,
          timestamp: result.timestamp,
          screenshot_size: result.screenshot?.length || 0,
          metrics: result.metrics,
          errors: result.errors
        }))
      };

    } catch (error) {
      logger.error('Batch scan failed', error instanceof Error ? error : { error: String(error) });

      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // 404 handler
  server.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      success: false,
      error: 'Endpoint not found',
      available_endpoints: [
        'GET /api/health',
        'GET /api/stats',
        'POST /api/scan/forms',
        'POST /api/scan',
        'POST /api/scan/batch',
        'GET /api/webflow/health',
        'POST /api/webflow/validate-token',
        'POST /api/webflow/analyze-site',
        'GET /api/webflow/site/:siteId/status'
      ]
    });
  });

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error('API error', error);

    const statusCode = error.statusCode || 500;

    reply.code(statusCode).send({
      success: false,
      error: error.message || 'Internal server error',
      statusCode
    });
  });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    logger.info('Shutting down API server...');

    try {
      await server.close();
      if (scanningEngine) {
        await scanningEngine.destroy();
      }
      logger.info('Server shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error instanceof Error ? error : { error: String(error) });
      process.exit(1);
    }
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  return server;
}

// Start server if this file is run directly
if (require.main === module) {
  const start = async () => {
    try {
      const server = await createServer();
      const port = parseInt(process.env.API_PORT || '3001');
      const host = process.env.API_HOST || 'localhost';

      await server.listen({ port, host });
      logger.info(`API server listening on http://${host}:${port}`);
    } catch (error) {
      logger.error('Failed to start server', error instanceof Error ? error : { error: String(error) });
      process.exit(1);
    }
  };

  start();
}