/**
 * Webflow Integration Routes for Fastify
 * Site Token-based API endpoints
 */

import { FastifyInstance } from 'fastify';
import { validateSiteTokenFormat, FastifyWebflowClient } from './client';
import { chromium } from 'playwright';
import { runAllCheckers, CheckerContext } from '../../backend/checkers';

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
            siteToken: { type: 'string', minLength: 32 }
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
        const client = new FastifyWebflowClient(siteToken);
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
            siteToken: { type: 'string', minLength: 32 },
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
        const client = new FastifyWebflowClient(siteToken);
        const validation = await client.validateSiteToken();

        if (!validation.valid) {
          return reply.code(401).send({
            success: false,
            error: 'Invalid site token'
          });
        }

        const siteInfo = validation.siteInfo!;
        const targetSiteId = siteId || siteInfo.id;

        // Perform real QA analysis with specialized checkers
        const analyzeUrl = `https://${siteInfo.shortName}.webflow.io`;
        fastify.log.info(`Starting real QA analysis for: ${analyzeUrl}`);

        const startTime = Date.now();
        let browser;
        let analysisResult;

        try {
          // Launch browser for analysis
          browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });

          const page = await browser.newPage({
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (compatible; QA-Sentinel/1.0)'
          });

          // Navigate to the site with more forgiving settings
          await page.goto(analyzeUrl, {
            waitUntil: 'domcontentloaded', // Don't wait for all resources
            timeout: 15000 // Shorter timeout
          });

          // Wait a bit more for critical resources to load
          await page.waitForTimeout(2000);

          // Create checker context
          const context: CheckerContext = {
            page,
            url: analyzeUrl,
            viewport: { width: 1280, height: 720 }
          };

          // Run all QA checks with real analysis
          const qaReport = await runAllCheckers(context, {
            brokenLinks: {
              checkExternalLinks: analysisOptions.includePages !== false,
              timeout: 10000
            },
            seo: {
              checkMetaTags: analysisOptions.seoChecks !== false,
              checkHeadings: analysisOptions.seoChecks !== false,
              checkImages: analysisOptions.seoChecks !== false
            },
            performance: {
              collectMetrics: analysisOptions.performanceChecks !== false,
              checkImageOptimization: analysisOptions.performanceChecks !== false
            },
            accessibility: {
              checkColorContrast: analysisOptions.accessibilityChecks !== false,
              checkAltText: analysisOptions.accessibilityChecks !== false,
              checkFormLabels: analysisOptions.includeForms !== false
            }
          });

          const duration = Date.now() - startTime;

          // Structure results in expected format
          analysisResult = {
            siteInfo,
            pages: [], // Keep empty for now as we're analyzing main page
            totalPages: 1,
            pageUrls: [analyzeUrl],
            analysisStatus: qaReport.overallStatus === 'error' ? 'failed' as const : 'completed' as const,
            issues: {
              performance: qaReport.issuesByType.performance || [],
              accessibility: qaReport.issuesByType.accessibility || [],
              seo: qaReport.issuesByType.seo || [],
              broken_links: qaReport.issuesByType['broken-links'] || []
            },
            metadata: {
              analyzedAt: new Date().toISOString(),
              duration,
              tokensUsed: qaReport.totalIssues,
              elementsChecked: qaReport.results.reduce((sum, r) => sum + r.metadata.elementsChecked, 0),
              overallStatus: qaReport.overallStatus
            },
            options: {
              includePages: analysisOptions.includePages !== false,
              includeForms: analysisOptions.includeForms !== false,
              includeCollections: analysisOptions.includeCollections === true,
              performanceChecks: analysisOptions.performanceChecks !== false,
              accessibilityChecks: analysisOptions.accessibilityChecks !== false,
              seoChecks: analysisOptions.seoChecks !== false
            },
            summary: {
              totalIssues: qaReport.totalIssues,
              criticalIssues: qaReport.issuesBySeverity.critical || 0,
              highIssues: qaReport.issuesBySeverity.high || 0,
              mediumIssues: qaReport.issuesBySeverity.medium || 0,
              lowIssues: qaReport.issuesBySeverity.low || 0
            }
          };

          fastify.log.info(`QA analysis completed: ${qaReport.totalIssues} issues found in ${duration}ms`);

        } finally {
          if (browser) {
            await browser.close();
          }
        }

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
            token: { type: 'string', minLength: 32 }
          }
        }
      }
    }, async (request, reply) => {
      const { siteId } = request.params as any;
      const { token } = request.query as any;

      try {
        const client = new FastifyWebflowClient(token);

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