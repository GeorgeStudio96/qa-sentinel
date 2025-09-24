/**
 * Webflow Integration Routes for Fastify
 * Site Token-based API endpoints
 */

import { FastifyInstance } from 'fastify';
import { createWebflowClient, validateSiteTokenFormat } from './client';

interface ValidateTokenRequest {
  Body: {
    siteToken: string;
  };
}

interface AnalyzeSiteRequest {
  Body: {
    siteToken: string;
    siteId?: string;
    analysisOptions?: {
      includePages?: boolean;
      includeForms?: boolean;
      includeCollections?: boolean;
      performanceChecks?: boolean;
      accessibilityChecks?: boolean;
      seoChecks?: boolean;
    };
  };
}

interface GetSiteStatusRequest {
  Params: {
    siteId: string;
  };
  Querystring: {
    token: string;
  };
}

export async function webflowRoutes(fastify: FastifyInstance) {
  // Prefix all routes with /api/webflow
  await fastify.register(async function (fastify) {
    /**
     * POST /api/webflow/validate-token
     * Validate Site Token and get basic site info
     */
    fastify.post<ValidateTokenRequest>('/validate-token', {
      schema: {
        body: {
          type: 'object',
          required: ['siteToken'],
          properties: {
            siteToken: { type: 'string', minLength: 40 }
          }
        }
      }
    }, async (request, reply) => {
      const { siteToken } = request.body as any;

      try {
        // Basic format validation
        if (!validateSiteTokenFormat(siteToken)) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid site token format'
          });
        }

        // Create client and validate token
        const client = createWebflowClient(siteToken);
        const validation = await client.validateSiteToken();

        if (!validation.valid) {
          return reply.code(401).send({
            success: false,
            error: validation.error || 'Invalid site token'
          });
        }

        return reply.send({
          success: true,
          siteInfo: validation.siteInfo,
          message: 'Site token is valid'
        });

      } catch (error) {
        fastify.log.error({ error }, 'Site token validation error');
        return reply.code(500).send({
          success: false,
          error: 'Failed to validate site token',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    /**
     * POST /api/webflow/analyze-site
     * Start site analysis with QA scanning
     */
    fastify.post<AnalyzeSiteRequest>('/analyze-site', {
      schema: {
        body: {
          type: 'object',
          required: ['siteToken'],
          properties: {
            siteToken: { type: 'string', minLength: 40 },
            siteId: { type: 'string' },
            analysisOptions: {
              type: 'object',
              properties: {
                includePages: { type: 'boolean', default: true },
                includeForms: { type: 'boolean', default: true },
                includeCollections: { type: 'boolean', default: false },
                performanceChecks: { type: 'boolean', default: true },
                accessibilityChecks: { type: 'boolean', default: true },
                seoChecks: { type: 'boolean', default: true }
              }
            }
          }
        }
      }
    }, async (request, reply) => {
      const { siteToken, siteId, analysisOptions = {} } = request.body as any;

      try {
        // Create client and validate token first
        const client = createWebflowClient(siteToken);
        const validation = await client.validateSiteToken();

        if (!validation.valid) {
          return reply.code(401).send({
            success: false,
            error: 'Invalid site token'
          });
        }

        const siteInfo = validation.siteInfo!;
        const targetSiteId = siteId || siteInfo.id;

        // Get pages for analysis
        const pages = await client.getSitePages(targetSiteId);
        const pageUrls = await client.getPageUrls(targetSiteId);

        fastify.log.info(`Starting analysis for site: ${siteInfo.displayName} (${pageUrls.length} pages)`);

        // TODO: Integrate with existing QA scanning engine
        // For now, return mock analysis result
        const analysisResult = {
          siteInfo,
          pages,
          totalPages: pages.length,
          pageUrls,
          analysisStatus: 'completed' as const,
          issues: {
            performance: [],
            accessibility: [],
            seo: [],
            broken_links: []
          },
          metadata: {
            analyzedAt: new Date().toISOString(),
            duration: 0,
            tokensUsed: pageUrls.length
          },
          options: {
            includePages: analysisOptions.includePages !== false,
            includeForms: analysisOptions.includeForms !== false,
            includeCollections: analysisOptions.includeCollections === true,
            performanceChecks: analysisOptions.performanceChecks !== false,
            accessibilityChecks: analysisOptions.accessibilityChecks !== false,
            seoChecks: analysisOptions.seoChecks !== false
          }
        };

        return reply.send({
          success: true,
          analysis: analysisResult,
          message: `Site analysis completed for ${siteInfo.displayName}`
        });

      } catch (error) {
        fastify.log.error({ error }, 'Site analysis error');
        return reply.code(500).send({
          success: false,
          error: 'Failed to analyze site',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    /**
     * GET /api/webflow/site/:siteId/status
     * Get site analysis status and basic info
     */
    fastify.get<GetSiteStatusRequest>('/site/:siteId/status', {
      schema: {
        params: {
          type: 'object',
          required: ['siteId'],
          properties: {
            siteId: { type: 'string' }
          }
        },
        querystring: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string', minLength: 40 }
          }
        }
      }
    }, async (request, reply) => {
      const { siteId } = request.params as any;
      const { token } = request.query as any;

      try {
        const client = createWebflowClient(token);

        // Get site info to verify access
        const siteInfo = await client.getSiteInfo(siteId);
        const pages = await client.getSitePages(siteId);

        return reply.send({
          success: true,
          site: {
            ...siteInfo,
            totalPages: pages.length,
            lastChecked: new Date().toISOString()
          }
        });

      } catch (error) {
        fastify.log.error({ error }, 'Site status error');
        return reply.code(500).send({
          success: false,
          error: 'Failed to get site status',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    /**
     * GET /api/webflow/health
     * Health check endpoint
     */
    fastify.get('/health', async (request, reply) => {
      return reply.send({
        status: 'healthy',
        service: 'webflow-integration',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

  }, { prefix: '/api/webflow' });
}