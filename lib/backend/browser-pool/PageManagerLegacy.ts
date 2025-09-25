import { Browser, Page } from 'playwright';
import {
  PageManagerConfig,
  PageStats
} from '../utils/types';
import { createLogger } from '../utils/logger';

const logger = createLogger('page-manager');

export class PageManager {
  private browser: Browser;
  private options: PageManagerConfig;
  private activePage: Page | null = null;
  private pageStats: PageStats;

  constructor(browser: Browser, options: Partial<PageManagerConfig> = {}) {
    this.browser = browser;
    this.options = {
      maxPagesPerBrowser: options.maxPagesPerBrowser || 5,
      pageTimeout: options.pageTimeout || 30000,
      maxPageAge: options.maxPageAge || 5 * 60 * 1000, // 5 minutes
      ...options
    };

    this.pageStats = {
      created: 0,
      destroyed: 0,
      errors: 0
    };
  }

  async getPage(): Promise<Page> {
    if (this.activePage && !this.activePage.isClosed()) {
      await this.resetPage(this.activePage);
      return this.activePage;
    }

    this.activePage = await this.createPage();
    return this.activePage;
  }

  async createPage(): Promise<Page> {
    try {
      const page = await this.browser.newPage();
      this.pageStats.created++;

      // Configure page
      await this.configurePage(page);

      // Setup page handlers
      this.setupPageHandlers(page);

      return page;

    } catch (error) {
      this.pageStats.errors++;
      logger.error('Failed to create page:', error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  private async configurePage(page: Page): Promise<void> {
    try {
      // Set viewport
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Set user agent
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 QASentinel/1.0'
      });

      // Block unnecessary resources
      await page.route('**/*', (route) => {
        const request = route.request();
        const resourceType = request.resourceType();
        const url = request.url();

        // Block ads, analytics, and other non-essential resources
        const blockedTypes = ['font', 'media'];
        const blockedDomains = [
          'google-analytics.com',
          'googletagmanager.com',
          'facebook.com',
          'doubleclick.net',
          'googlesyndication.com',
          'googleadservices.com',
          'amazon-adsystem.com'
        ];

        const shouldBlock = blockedTypes.includes(resourceType) ||
                           blockedDomains.some(domain => url.includes(domain));

        if (shouldBlock) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // Set timeouts
      page.setDefaultTimeout(this.options.pageTimeout);
      page.setDefaultNavigationTimeout(this.options.pageTimeout);

      // Intercept console messages for debugging
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          logger.debug('Page console error:', { message: msg.text() });
        }
      });

    } catch (error) {
      logger.error('Failed to configure page:', error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  private setupPageHandlers(page: Page): void {
    page.on('crash', () => {
      logger.error('Page crashed');
      this.pageStats.errors++;
    });

    page.on('pageerror', (error: Error) => {
      logger.error('Page error:', error);
      this.pageStats.errors++;
    });

    page.on('pageerror', (error: Error) => {
      logger.debug('Page JavaScript error:', { message: error.message });
    });

    // Handle page response errors
    page.on('response', (response) => {
      if (response.status() >= 400) {
        logger.debug('HTTP error response:', {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    // Handle request failures
    page.on('requestfailed', (request) => {
      logger.debug('Request failed:', {
        url: request.url(),
        failure: request.failure()?.errorText,
        method: request.method()
      });
    });
  }

  async resetPage(page: Page): Promise<void> {
    try {
      // Navigate to blank page
      await page.goto('about:blank', { waitUntil: 'load' });

      // Clear storage
      await page.evaluate(() => {
        try {
          if (typeof window !== 'undefined') {
            window.localStorage?.clear();
            window.sessionStorage?.clear();
          }

          // Clear any timers/intervals
          const highestTimeoutId = setTimeout(() => {}, 0);
          for (let i = 0; i < Number(highestTimeoutId); i++) {
            clearTimeout(i);
            clearInterval(i);
          }
        } catch (e) {
          // Storage might not be available in some contexts
          console.debug('Storage cleanup failed:', e);
        }
      });

      // Clear cookies for this page's context
      const context = page.context();
      await context.clearCookies();

      // Clear any active network requests
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
        // Ignore timeout, just continue
      });

    } catch (error) {
      logger.debug('Failed to reset page:', { message: error instanceof Error ? error.message : 'Unknown error' });
      // If reset fails, close the page and create a new one
      await this.destroyCurrentPage();
    }
  }

  async navigateToUrl(url: string, options: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
    timeout?: number;
  } = {}): Promise<void> {
    const page = await this.getPage();

    try {
      await page.goto(url, {
        waitUntil: options.waitUntil || 'networkidle',
        timeout: options.timeout || this.options.pageTimeout
      });
    } catch (error) {
      logger.error(`Failed to navigate to ${url}:`, error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  async takeScreenshot(options: {
    path?: string;
    fullPage?: boolean;
    clip?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  } = {}): Promise<Buffer> {
    const page = await this.getPage();

    try {
      return await page.screenshot({
        path: options.path,
        fullPage: options.fullPage ?? true,
        clip: options.clip,
        type: 'png'
      });
    } catch (error) {
      logger.error('Failed to take screenshot:', error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  async evaluateOnPage<T>(
    pageFunction: () => Promise<T> | T,
    ...args: unknown[]
  ): Promise<T> {
    const page = await this.getPage();

    try {
      return await page.evaluate(pageFunction, ...args);
    } catch (error) {
      logger.error('Failed to evaluate function on page:', error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  async waitForSelector(
    selector: string,
    options: {
      timeout?: number;
      visible?: boolean;
      hidden?: boolean;
    } = {}
  ): Promise<void> {
    const page = await this.getPage();

    try {
      await page.waitForSelector(selector, {
        timeout: options.timeout || this.options.pageTimeout,
        state: options.visible ? 'visible' : options.hidden ? 'hidden' : 'attached'
      });
    } catch (error) {
      logger.error(`Failed to wait for selector ${selector}:`, error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  async getPageMetrics(): Promise<{
    url: string;
    title: string;
    loadTime: number;
    domContentLoaded: number;
    networkRequests: number;
    failedRequests: number;
  }> {
    const page = await this.getPage();

    try {
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

        return {
          loadTime: navigation.loadEventEnd - navigation.fetchStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          networkRequests: resources.length,
          failedRequests: resources.filter((r: PerformanceResourceTiming) =>
            r.transferSize === 0 && r.encodedBodySize === 0
          ).length
        };
      });

      return {
        url: page.url(),
        title: await page.title(),
        ...performanceMetrics
      };
    } catch (error) {
      logger.error('Failed to get page metrics:', error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  async checkAccessibility(): Promise<{
    violations: Array<{
      id: string;
      description: string;
      impact: string;
      nodes: number;
    }>;
    passes: number;
  }> {
    const page = await this.getPage();

    try {
      // Inject axe-core for accessibility testing
      await page.addScriptTag({
        url: 'https://unpkg.com/axe-core@4.7.2/axe.min.js'
      });

      const results = await page.evaluate(() => {
        return new Promise((resolve) => {
          // @ts-expect-error - axe is loaded dynamically
          window.axe.run().then((results: { violations: Array<{ id: string; description: string; impact: string; nodes: unknown[] }>; passes: unknown[] }) => {
            resolve({
              violations: results.violations.map((violation) => ({
                id: violation.id,
                description: violation.description,
                impact: violation.impact,
                nodes: violation.nodes.length
              })),
              passes: results.passes.length
            });
          });
        });
      });

      return results as {
        violations: Array<{
          id: string;
          description: string;
          impact: string;
          nodes: number;
        }>;
        passes: number;
      };
    } catch (error) {
      logger.error('Failed to check accessibility:', error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  async findBrokenLinks(): Promise<Array<{
    url: string;
    status: number;
    text: string;
  }>> {
    const page = await this.getPage();

    try {
      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors.map(anchor => ({
          url: (anchor as HTMLAnchorElement).href,
          text: anchor.textContent?.trim() || ''
        }));
      });

      const brokenLinks: Array<{
        url: string;
        status: number;
        text: string;
      }> = [];

      // Check each link (limit to first 20 to avoid overwhelming)
      const linksToCheck = links.slice(0, 20);

      for (const link of linksToCheck) {
        try {
          const response = await page.goto(link.url, {
            waitUntil: 'domcontentloaded',
            timeout: 10000
          });

          if (response && response.status() >= 400) {
            brokenLinks.push({
              url: link.url,
              status: response.status(),
              text: link.text
            });
          }
        } catch {
          brokenLinks.push({
            url: link.url,
            status: 0, // Connection failed
            text: link.text
          });
        }
      }

      return brokenLinks;
    } catch (error) {
      logger.error('Failed to find broken links:', error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  async findInternalLinks(): Promise<Array<{
    url: string;
    text: string;
    isInternal: boolean;
  }>> {
    const page = await this.getPage();

    try {
      const currentDomain = new URL(page.url()).hostname;

      const links = await page.evaluate((currentDomain) => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors.map(anchor => {
          const href = (anchor as HTMLAnchorElement).href;
          let isInternal = false;

          try {
            const linkUrl = new URL(href);
            isInternal = linkUrl.hostname === currentDomain;
          } catch {
            isInternal = !!(href && (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')));
          }

          return {
            url: href,
            text: anchor.textContent?.trim() || '',
            isInternal
          };
        });
      }, currentDomain);

      return links.filter(link => link.isInternal);
    } catch (error) {
      logger.error('Failed to find internal links:', error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  async findForms(): Promise<Array<{
    id: string;
    action: string;
    method: string;
    fields: Array<{
      name: string;
      type: string;
      required: boolean;
      label: string;
      placeholder: string;
      options?: string[];
    }>;
    submitButtons: Array<{
      text: string;
      type: string;
    }>;
  }>> {
    const page = await this.getPage();

    try {
      const forms = await page.evaluate(() => {
        const formElements = Array.from(document.querySelectorAll('form'));

        return formElements.map((form, index) => {
          const formId = form.id || `form-${index}`;
          const action = form.action || window.location.href;
          const method = form.method.toLowerCase() || 'get';

          // Find all input, select, textarea elements
          const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
          const fields = inputs
            .filter(input => {
              const type = (input as HTMLInputElement).type;
              return !['submit', 'button', 'reset', 'image'].includes(type);
            })
            .map(input => {
              const element = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
              const label = form.querySelector(`label[for="${element.id}"]`)?.textContent?.trim() ||
                           element.closest('label')?.textContent?.trim() || '';

              let options: string[] | undefined = undefined;
              if (element.tagName === 'SELECT') {
                const selectElement = element as HTMLSelectElement;
                options = Array.from(selectElement.options).map(option => option.text);
              }

              return {
                name: element.name || element.id || '',
                type: (element as HTMLInputElement).type || element.tagName.toLowerCase(),
                required: element.hasAttribute('required'),
                label: label.replace(element.value || '', '').trim(),
                placeholder: (element as HTMLInputElement).placeholder || '',
                options
              };
            });

          // Find submit buttons
          const submitButtons = Array.from(form.querySelectorAll('input[type="submit"], button[type="submit"], button:not([type])'))
            .map(button => ({
              text: (button as HTMLInputElement).value || button.textContent?.trim() || '',
              type: (button as HTMLInputElement).type || 'submit'
            }));

          return {
            id: formId,
            action,
            method,
            fields,
            submitButtons
          };
        });
      });

      logger.debug(`Found ${forms.length} forms on page`);
      return forms;
    } catch (error) {
      logger.error('Failed to find forms:', error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  async analyzeFormFields(formId: string): Promise<{
    validation: Array<{
      field: string;
      validationType: string;
      isValid: boolean;
      message: string;
    }>;
    accessibility: Array<{
      field: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  }> {
    const page = await this.getPage();

    try {
      const analysis = await page.evaluate((formId) => {
        const form = document.querySelector(`#${formId}`) || document.querySelectorAll('form')[parseInt(formId.replace('form-', ''))];
        if (!form) return { validation: [], accessibility: [] };

        const validation: Array<{
          field: string;
          validationType: string;
          isValid: boolean;
          message: string;
        }> = [];

        const accessibility: Array<{
          field: string;
          issue: string;
          severity: 'low' | 'medium' | 'high';
        }> = [];

        const inputs = Array.from(form.querySelectorAll('input, select, textarea'));

        inputs.forEach((input) => {
          const element = input as HTMLInputElement;
          const fieldName = element.name || element.id || element.placeholder || 'unnamed';

          // Validation analysis
          if (element.type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            validation.push({
              field: fieldName,
              validationType: 'email',
              isValid: !element.value || emailRegex.test(element.value),
              message: element.value && !emailRegex.test(element.value) ? 'Invalid email format' : 'Valid'
            });
          }

          if (element.type === 'url') {
            try {
              new URL(element.value);
              validation.push({
                field: fieldName,
                validationType: 'url',
                isValid: true,
                message: 'Valid URL'
              });
            } catch {
              validation.push({
                field: fieldName,
                validationType: 'url',
                isValid: !element.value,
                message: element.value ? 'Invalid URL format' : 'Empty'
              });
            }
          }

          if (element.hasAttribute('required')) {
            validation.push({
              field: fieldName,
              validationType: 'required',
              isValid: !!element.value,
              message: element.value ? 'Required field filled' : 'Required field is empty'
            });
          }

          // Accessibility analysis
          const label = form.querySelector(`label[for="${element.id}"]`) || element.closest('label');
          if (!label && element.type !== 'hidden') {
            accessibility.push({
              field: fieldName,
              issue: 'Missing label',
              severity: 'high'
            });
          }

          if (element.hasAttribute('required') && !element.hasAttribute('aria-required')) {
            accessibility.push({
              field: fieldName,
              issue: 'Missing aria-required attribute',
              severity: 'medium'
            });
          }

          if (!element.id && !element.name) {
            accessibility.push({
              field: fieldName,
              issue: 'Missing id and name attributes',
              severity: 'medium'
            });
          }
        });

        return { validation, accessibility };
      }, formId);

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze form fields:', error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  async testFormSubmission(formId: string, testData?: Record<string, string>): Promise<{
    success: boolean;
    responseStatus: number;
    responseUrl: string;
    errors: string[];
    warnings: string[];
    submissionTime: number;
  }> {
    const page = await this.getPage();

    try {
      const startTime = Date.now();

      // Fill form with test data
      const fillResult = await page.evaluate(({ formId, testData }: { formId: string, testData?: Record<string, string> }) => {
        const form = document.querySelector(`#${formId}`) || document.querySelectorAll('form')[parseInt(formId.replace('form-', ''))];
        if (!form) return { success: false, error: 'Form not found' };

        const inputs = Array.from(form.querySelectorAll('input, select, textarea'));

        inputs.forEach((input) => {
          const element = input as HTMLInputElement;

          if (element.type === 'hidden' || element.type === 'submit' || element.type === 'button') {
            return;
          }

          const fieldName = element.name || element.id;
          if (!fieldName) return;

          // Use provided test data or generate appropriate test values
          let testValue = testData?.[fieldName];

          if (!testValue) {
            switch (element.type) {
              case 'email':
                testValue = 'test@example.com';
                break;
              case 'tel':
                testValue = '+1234567890';
                break;
              case 'url':
                testValue = 'https://example.com';
                break;
              case 'number':
                const min = parseFloat(element.min) || 1;
                const max = parseFloat(element.max) || 100;
                testValue = String(Math.floor(Math.random() * (max - min) + min));
                break;
              case 'date':
                testValue = new Date().toISOString().split('T')[0];
                break;
              case 'checkbox':
                element.checked = true;
                return;
              case 'radio':
                // Only select the first radio button in each group
                const radios = form.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
                if (radios[0] === element) {
                  element.checked = true;
                }
                return;
              default:
                testValue = element.placeholder || `Test ${fieldName}`;
            }
          }

          if (element.tagName === 'SELECT') {
            const selectElement = input as HTMLSelectElement;
            if (selectElement.options.length > 1) {
              selectElement.selectedIndex = 1; // Skip the first option (usually placeholder)
            }
          } else {
            element.value = testValue;
          }
        });

        return { success: true, error: null };
      }, { formId, testData }) as { success: boolean; error: string | null };

      if (!fillResult.success) {
        return {
          success: false,
          responseStatus: 0,
          responseUrl: '',
          errors: [fillResult.error || 'Failed to fill form'],
          warnings: [],
          submissionTime: Date.now() - startTime
        };
      }

      // Set up response listener
      let responseReceived = false;
      let responseStatus = 0;
      let responseUrl = '';
      const errors: string[] = [];
      const warnings: string[] = [];

      const responsePromise = new Promise<void>((resolve) => {
        page.on('response', (response) => {
          responseStatus = response.status();
          responseUrl = response.url();
          responseReceived = true;
          resolve();
        });
      });

      // Submit the form
      await page.evaluate((formId) => {
        const form = document.querySelector(`#${formId}`) || document.querySelectorAll('form')[parseInt(formId.replace('form-', ''))];
        if (form) {
          (form as HTMLFormElement).submit();
        }
      }, formId);

      // Wait for response or timeout
      await Promise.race([
        responsePromise,
        new Promise((resolve) => setTimeout(resolve, 10000)) // 10 second timeout
      ]);

      if (!responseReceived) {
        warnings.push('No response received within timeout');
      }

      if (responseStatus >= 400) {
        errors.push(`HTTP error: ${responseStatus}`);
      }

      return {
        success: responseReceived && responseStatus < 400,
        responseStatus,
        responseUrl,
        errors,
        warnings,
        submissionTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Failed to test form submission:', error instanceof Error ? error : new Error('Unknown error'));
      return {
        success: false,
        responseStatus: 0,
        responseUrl: '',
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        warnings: [],
        submissionTime: Date.now()
      };
    }
  }

  private async destroyCurrentPage(): Promise<void> {
    if (this.activePage && !this.activePage.isClosed()) {
      try {
        await this.activePage.close();
        this.pageStats.destroyed++;
      } catch (error) {
        logger.debug('Error closing page:', { message: error instanceof Error ? error.message : 'Unknown error' });
      }
      this.activePage = null;
    }
  }

  async destroy(): Promise<void> {
    await this.destroyCurrentPage();
  }

  getStats(): PageStats {
    return { ...this.pageStats };
  }

  getCurrentPage(): Page | null {
    return this.activePage && !this.activePage.isClosed() ? this.activePage : null;
  }

  isPageActive(): boolean {
    return this.activePage !== null && !this.activePage.isClosed();
  }
}