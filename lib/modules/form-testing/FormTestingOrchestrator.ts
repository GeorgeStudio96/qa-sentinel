/**
 * Form Testing Orchestrator
 * Coordinates parallel form testing across multiple sites
 */

import { WebflowApiClient } from '../../integrations/webflow/api-client';
import { BrowserPoolOptimized } from '../../shared/browser-pool/BrowserPoolOptimized';
import { FormTester } from './FormTester';
import { createLogger } from '../../shared/logger';
import type {
  FormTestRequest,
  FormTestResult,
  FormTestProgress,
} from './types';

const logger = createLogger('form-testing-orchestrator');

interface FormToTest {
  formId: string;
  formName: string;
  pageUrl: string;
  siteId: string;
  siteName: string;
  pageName: string;
}

export class FormTestingOrchestrator {
  private browserPool: BrowserPoolOptimized;
  private formTester: FormTester;

  constructor() {
    this.browserPool = new BrowserPoolOptimized({
      minSize: 2,
      maxSize: 10,
      maxContextsPerBrowser: 3,
      browserTimeout: 30000,
      pageTimeout: 10000,
    });
    this.formTester = new FormTester();
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(): Promise<void> {
    await this.browserPool.initialize();
  }

  /**
   * Run complete form testing suite
   */
  async runFormTests(
    request: FormTestRequest,
    progressCallback?: (progress: FormTestProgress) => void
  ): Promise<FormTestResult[]> {
    logger.info('Starting form testing suite', { userId: request.userId });

    try {
      // Step 1: Discover all forms
      progressCallback?.({
        status: 'discovering',
        currentStep: 'Discovering forms across sites...',
        totalSites: 0,
        processedSites: 0,
        totalForms: 0,
        testedForms: 0,
      });

      const formsToTest = await this.discoverForms(request);

      logger.info(`Discovered ${formsToTest.length} forms to test`);

      const totalSites = new Set(formsToTest.map((f) => f.siteId)).size;

      progressCallback?.({
        status: 'testing',
        currentStep: `Testing ${formsToTest.length} forms...`,
        totalSites,
        processedSites: 0,
        totalForms: formsToTest.length,
        testedForms: 0,
      });

      // Step 2: Test forms in parallel
      const results = await this.testFormsInParallel(
        formsToTest,
        (testedCount) => {
          progressCallback?.({
            status: 'testing',
            currentStep: `Tested ${testedCount}/${formsToTest.length} forms`,
            totalSites,
            processedSites: Math.floor((testedCount / formsToTest.length) * totalSites),
            totalForms: formsToTest.length,
            testedForms: testedCount,
          });
        }
      );

      logger.info(`Form testing completed. Tested ${results.length} forms`);

      progressCallback?.({
        status: 'completed',
        currentStep: 'Testing completed!',
        totalSites,
        processedSites: totalSites,
        totalForms: formsToTest.length,
        testedForms: results.length,
        results,
      });

      return results;
    } catch (error) {
      logger.error('Form testing failed:', error as Error);

      progressCallback?.({
        status: 'failed',
        currentStep: 'Testing failed',
        totalSites: 0,
        processedSites: 0,
        totalForms: 0,
        testedForms: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Discover all forms to test using Webflow API
   */
  private async discoverForms(
    request: FormTestRequest
  ): Promise<FormToTest[]> {
    // Get access token from request (passed from API route)
    const webflowClient = new WebflowApiClient(request.userId);

    // Get sites
    let sites;
    if (request.siteIds?.length) {
      sites = await Promise.all(
        request.siteIds.map((id) => webflowClient.getSite(id))
      );
    } else {
      sites = await webflowClient.getSites();
    }

    logger.info(`Found ${sites.length} sites`);

    // Get forms and pages for each site in parallel
    const siteFormsPromises = sites.map(async (site) => {
      try {
        const [forms, pages] = await Promise.all([
          webflowClient.getForms(site.id),
          webflowClient.getPages(site.id),
        ]);

        // Map forms to pages
        const formsToTest: FormToTest[] = forms.map((form) => {
          const page = pages.find((p) => p.id === form.pageId);
          return {
            formId: form.id,
            formName: form.displayName,
            pageUrl: `https://${site.shortName}.webflow.io${page?.slug || ''}`,
            siteId: site.id,
            siteName: site.displayName,
            pageName: page?.title || 'Unknown Page',
          };
        });

        return formsToTest;
      } catch (error) {
        logger.error(`Failed to get forms for site ${site.displayName}:`, error as Error);
        return [];
      }
    });

    const siteForms = await Promise.all(siteFormsPromises);
    return siteForms.flat();
  }

  /**
   * Test forms in parallel using browser pool
   */
  private async testFormsInParallel(
    forms: FormToTest[],
    progressCallback?: (testedCount: number) => void
  ): Promise<FormTestResult[]> {
    logger.info(`Testing ${forms.length} forms in parallel`);

    let testedCount = 0;
    const results: FormTestResult[] = [];

    // Process forms in chunks to avoid overwhelming the system
    const chunkSize = 5;
    const chunks: FormToTest[][] = [];

    for (let i = 0; i < forms.length; i += chunkSize) {
      chunks.push(forms.slice(i, i + chunkSize));
    }

    // Process each chunk
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (form) => {
          const { page, release } = await this.browserPool.acquirePage();

          try {
            const result = await this.formTester.testForm(page, form);
            testedCount++;
            progressCallback?.(testedCount);
            return result;
          } catch (error) {
            logger.error(`Error testing form ${form.formName}:`, error as Error);
            testedCount++;
            progressCallback?.(testedCount);

            // Return error result
            return {
              formId: form.formId,
              formName: form.formName,
              pageUrl: form.pageUrl,
              siteId: form.siteId,
              siteName: form.siteName,
              testResults: {
                hasEmailField: false,
                emailRequired: false,
                canSubmitEmpty: true,
                validationWorks: false,
                successMessageShown: false,
                fieldCount: 0,
                requiredFieldsCount: 0,
                testCases: [],
              },
              issues: [
                {
                  severity: 'critical' as const,
                  category: 'error',
                  title: 'Test Failed',
                  description:
                    error instanceof Error ? error.message : 'Unknown error',
                  recommendation: 'Check if form is accessible',
                },
              ],
              duration: 0,
              testedAt: new Date().toISOString(),
            };
          } finally {
            await release();
          }
        })
      );

      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return this.browserPool.getStats();
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.browserPool.destroy();
  }
}