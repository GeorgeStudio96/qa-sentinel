/**
 * Form Testing Orchestrator
 * Coordinates parallel form testing across multiple sites
 */

import { WebflowApiClient } from '../../integrations/webflow/api-client';
import { BrowserPoolOptimized } from '../../shared/browser-pool/BrowserPoolOptimized';
import { FormTester } from './FormTester';
import { RealisticDataGenerator } from './RealisticDataGenerator';
import { createLogger } from '../../shared/logger';
import { createClient } from '@supabase/supabase-js';
import type {
  FormTestRequest,
  FormTestResult,
  FormTestProgress,
  TestDataPreset,
  PresetData,
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
  private supabase;

  constructor() {
    this.browserPool = new BrowserPoolOptimized({
      minSize: 2,
      maxSize: 10,
      maxContextsPerBrowser: 3,
      browserTimeout: 30000,
      pageTimeout: 10000,
    });
    this.formTester = new FormTester();
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
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
    logger.info(`Progress callback provided: ${!!progressCallback}`);

    try {
      // Step 1: Discover all forms
      logger.info('Sending discovering progress...');
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

      logger.info('Sending testing progress...');
      progressCallback?.({
        status: 'testing',
        currentStep: `Testing ${formsToTest.length} forms...`,
        totalSites,
        processedSites: 0,
        totalForms: formsToTest.length,
        testedForms: 0,
      });

      // Load preset if real submission is enabled
      let presetData: PresetData | undefined;
      let presetName: string | undefined;

      if (request.options?.realSubmission && request.options?.selectedPreset) {
        const preset = await this.loadPreset(request.userId, request.options.selectedPreset);
        if (preset) {
          presetData = preset.presetData;
          presetName = preset.presetName;
          logger.info(`Using preset: ${presetName} for real submissions`);
        }
      }

      // Step 2: Test forms in parallel
      const results = await this.testFormsInParallel(
        formsToTest,
        request.options?.realSubmission || false,
        presetData,
        presetName,
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

      logger.info('Sending completed progress with results...');
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
    const accessToken = request.accessToken || request.userId;
    logger.info(`Using access token (first 20 chars): ${accessToken?.substring(0, 20)}...`);
    const webflowClient = new WebflowApiClient(accessToken);

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
          // Ensure slug starts with / for correct URL construction
          const slug = page?.slug || '';
          const normalizedSlug = slug.startsWith('/') ? slug : `/${slug}`;
          const pageUrl = `https://${site.shortName}.webflow.io${normalizedSlug}`;

          logger.info(`Form URL constructed: ${pageUrl} (slug: "${slug}", normalized: "${normalizedSlug}")`);

          return {
            formId: form.id,
            formName: form.displayName,
            pageUrl,
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
    realSubmission: boolean,
    presetData?: PresetData,
    presetName?: string,
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
            const result = await this.formTester.testForm(
              page,
              form,
              10000,
              realSubmission,
              presetData,
              presetName
            );
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
   * Load preset from database
   */
  private async loadPreset(
    userId: string,
    presetName: string
  ): Promise<TestDataPreset | null> {
    try {
      const { data, error } = await this.supabase
        .from('form_test_scenarios')
        .select('*')
        .eq('user_id', userId)
        .eq('preset_name', presetName)
        .eq('is_active', true)
        .single();

      if (error) {
        logger.error('Error loading preset:', error);
        return null;
      }

      return data ? {
        id: data.id,
        userId: data.user_id,
        presetType: data.preset_type,
        presetName: data.preset_name,
        presetData: data.preset_data,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      } : null;
    } catch (error) {
      logger.error('Failed to load preset:', error as Error);
      return null;
    }
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