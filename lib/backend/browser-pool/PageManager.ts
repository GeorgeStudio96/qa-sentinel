import { Browser, Page } from 'playwright';
import { createLogger } from '../utils/logger';
import { runAllCheckers, CheckerContext, CheckerResult } from '../checkers';

const logger = createLogger('page-manager');

/**
 * PageManager - Lightweight page coordinator
 *
 * This is a streamlined version that focuses only on:
 * - Page lifecycle management (create, configure, destroy)
 * - Coordinating specialized checkers
 * - Memory management
 *
 * All QA checking logic has been moved to specialized checker modules.
 * This keeps PageManager focused on browser/page management only.
 */
export class PageManager {
  private browser: Browser;
  private currentPage: Page | null = null;
  private pageCount = 0;
  private readonly config = {
    maxPages: 10,
    pageTimeout: 30000,
    userAgent: 'Mozilla/5.0 (compatible; QA-Sentinel/1.0)'
  };

  constructor(browser: Browser) {
    this.browser = browser;
    logger.info('PageManager initialized');
  }

  /**
   * Get or create a page for analysis
   * Handles page lifecycle and configuration
   */
  async getPage(): Promise<Page> {
    if (this.currentPage && !this.currentPage.isClosed()) {
      return this.currentPage;
    }

    return await this.createPage();
  }

  /**
   * Create and configure a new page
   * Sets up viewport, user agent, and error handling
   */
  async createPage(): Promise<Page> {
    try {
      if (this.pageCount >= this.config.maxPages) {
        await this.destroyCurrentPage();
      }

      const page = await this.browser.newPage({
        viewport: { width: 1280, height: 720 },
        userAgent: this.config.userAgent
      });

      await this.configurePage(page);

      this.currentPage = page;
      this.pageCount++;

      logger.info(`Created new page (total: ${this.pageCount})`);
      return page;

    } catch (error) {
      logger.error('Failed to create page:', error);
      throw error;
    }
  }

  /**
   * Configure page settings and error handling
   * Sets up timeouts and basic page behavior
   */
  private async configurePage(page: Page): Promise<void> {
    // Set default timeout
    page.setDefaultTimeout(this.config.pageTimeout);

    // Handle console messages and errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logger.warn(`Page console error: ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      logger.warn(`Page error: ${error.message}`);
    });

    // Block unnecessary resources to speed up loading
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();

      // Block ads, analytics, and other non-essential resources
      if (['font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  /**
   * Run comprehensive QA analysis using specialized checkers
   * This is the main method that coordinates all QA checks
   */
  async runQAAnalysis(url: string, options?: {
    includeBrokenLinks?: boolean;
    includeSEO?: boolean;
    includePerformance?: boolean;
    includeAccessibility?: boolean;
  }): Promise<{
    results: CheckerResult[];
    summary: {
      totalIssues: number;
      criticalIssues: number;
      highIssues: number;
      mediumIssues: number;
      lowIssues: number;
    };
    overallStatus: 'success' | 'warning' | 'error';
  }> {
    const startTime = Date.now();
    logger.info(`Starting QA analysis for: ${url}`);

    try {
      const page = await this.getPage();

      // Navigate to the URL with optimized settings
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // Wait for critical resources to load
      await page.waitForTimeout(2000);

      // Create checker context
      const context: CheckerContext = {
        page,
        url,
        viewport: { width: 1280, height: 720 }
      };

      // Configure which checkers to run based on options
      const checkerConfigs = {
        brokenLinks: options?.includeBrokenLinks !== false ? {
          timeout: 10000,
          checkExternalLinks: true
        } : undefined,

        seo: options?.includeSEO !== false ? {
          checkMetaTags: true,
          checkHeadings: true,
          checkImages: true
        } : undefined,

        performance: options?.includePerformance !== false ? {
          collectMetrics: true,
          checkImageOptimization: true
        } : undefined,

        accessibility: options?.includeAccessibility !== false ? {
          checkColorContrast: true,
          checkAltText: true,
          checkFormLabels: true
        } : undefined
      };

      // Run all enabled checkers
      const report = await runAllCheckers(context, checkerConfigs);

      const duration = Date.now() - startTime;
      logger.info(`QA analysis completed in ${duration}ms: ${report.totalIssues} issues found`);

      return {
        results: report.results,
        summary: {
          totalIssues: report.totalIssues,
          criticalIssues: report.issuesBySeverity.critical || 0,
          highIssues: report.issuesBySeverity.high || 0,
          mediumIssues: report.issuesBySeverity.medium || 0,
          lowIssues: report.issuesBySeverity.low || 0
        },
        overallStatus: report.overallStatus
      };

    } catch (error) {
      logger.error('QA analysis failed:', error);
      throw error;
    }
  }

  /**
   * Reset page to clean state
   * Useful between different analyses
   */
  async resetPage(): Promise<void> {
    if (!this.currentPage || this.currentPage.isClosed()) return;

    try {
      // Clear cache and cookies
      const context = this.currentPage.context();
      await context.clearCookies();

      // Navigate to blank page to reset state
      await this.currentPage.goto('about:blank');

      logger.info('Page reset completed');
    } catch (error) {
      logger.error('Failed to reset page:', error);
      // If reset fails, create new page
      await this.destroyCurrentPage();
    }
  }

  /**
   * Get basic page metrics for monitoring
   * Lightweight alternative to full performance analysis
   */
  async getBasicMetrics(): Promise<{
    url: string;
    title: string;
    loadTime: number;
    domReady: number;
  } | null> {
    if (!this.currentPage || this.currentPage.isClosed()) return null;

    try {
      const metrics = await this.currentPage.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          url: window.location.href,
          title: document.title,
          loadTime: navigation.loadEventEnd - navigation.navigationStart,
          domReady: navigation.domContentLoadedEventEnd - navigation.navigationStart
        };
      });

      return metrics;
    } catch (error) {
      logger.error('Failed to get basic metrics:', error);
      return null;
    }
  }

  /**
   * Check if page is ready for analysis
   * Verifies page state before running checkers
   */
  async isPageReady(): Promise<boolean> {
    if (!this.currentPage || this.currentPage.isClosed()) return false;

    try {
      const readyState = await this.currentPage.evaluate(() => document.readyState);
      return readyState === 'complete' || readyState === 'interactive';
    } catch {
      return false;
    }
  }

  /**
   * Destroy current page and cleanup resources
   * Important for memory management
   */
  private async destroyCurrentPage(): Promise<void> {
    if (this.currentPage && !this.currentPage.isClosed()) {
      try {
        await this.currentPage.close();
        this.pageCount = Math.max(0, this.pageCount - 1);
        logger.info(`Page destroyed (remaining: ${this.pageCount})`);
      } catch (error) {
        logger.error('Failed to destroy page:', error);
      }
    }
    this.currentPage = null;
  }

  /**
   * Cleanup all resources
   * Should be called when PageManager is no longer needed
   */
  async destroy(): Promise<void> {
    await this.destroyCurrentPage();
    logger.info('PageManager destroyed');
  }

  /**
   * Get current page count for monitoring
   * Useful for memory management tracking
   */
  getPageCount(): number {
    return this.pageCount;
  }
}