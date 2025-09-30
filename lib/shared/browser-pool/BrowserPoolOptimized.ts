/**
 * Optimized Browser Pool for high-performance form testing
 * Reuses browsers across multiple tests for maximum throughput
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { createLogger } from '../logger';

const logger = createLogger('browser-pool-optimized');

interface PooledBrowser {
  browser: Browser;
  contexts: BrowserContext[];
  inUse: boolean;
  createdAt: number;
  lastUsed: number;
}

interface BrowserPoolOptions {
  minSize?: number;
  maxSize?: number;
  maxContextsPerBrowser?: number;
  browserTimeout?: number;
  pageTimeout?: number;
}

export class BrowserPoolOptimized {
  private pool: PooledBrowser[] = [];
  private readonly minSize: number;
  private readonly maxSize: number;
  private readonly maxContextsPerBrowser: number;
  private readonly browserTimeout: number;
  private readonly pageTimeout: number;
  private initPromise: Promise<void> | null = null;

  constructor(options: BrowserPoolOptions = {}) {
    this.minSize = options.minSize || 2;
    this.maxSize = options.maxSize || 10;
    this.maxContextsPerBrowser = options.maxContextsPerBrowser || 5;
    this.browserTimeout = options.browserTimeout || 30000;
    this.pageTimeout = options.pageTimeout || 10000;
  }

  /**
   * Initialize the browser pool
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      logger.info(`Initializing browser pool with ${this.minSize} browsers`);

      const initPromises = Array.from({ length: this.minSize }, () =>
        this.createBrowser()
      );

      await Promise.all(initPromises);
      logger.info(`Browser pool initialized with ${this.pool.length} browsers`);
    })();

    return this.initPromise;
  }

  /**
   * Create a new browser instance
   */
  private async createBrowser(): Promise<PooledBrowser> {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const pooledBrowser: PooledBrowser = {
      browser,
      contexts: [],
      inUse: false,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };

    this.pool.push(pooledBrowser);
    logger.debug(`Created new browser. Pool size: ${this.pool.length}`);

    return pooledBrowser;
  }

  /**
   * Get a page from the pool (creates context if needed)
   */
  async acquirePage(): Promise<{ page: Page; release: () => Promise<void> }> {
    await this.initialize();

    // Find available browser
    let pooledBrowser = this.pool.find(
      (pb) => !pb.inUse && pb.contexts.length < this.maxContextsPerBrowser
    );

    // Create new browser if needed and pool not full
    if (!pooledBrowser && this.pool.length < this.maxSize) {
      pooledBrowser = await this.createBrowser();
    }

    // Wait for available browser if pool is full
    if (!pooledBrowser) {
      pooledBrowser = await this.waitForAvailableBrowser();
    }

    pooledBrowser.inUse = true;
    pooledBrowser.lastUsed = Date.now();

    // Create new context
    const context = await pooledBrowser.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    pooledBrowser.contexts.push(context);

    // Create page
    const page = await context.newPage();

    // Set default timeout
    page.setDefaultTimeout(this.pageTimeout);

    // Optimize page loading
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    const release = async () => {
      try {
        await page.close();
        await context.close();

        // Remove context from list
        const index = pooledBrowser!.contexts.indexOf(context);
        if (index > -1) {
          pooledBrowser!.contexts.splice(index, 1);
        }

        pooledBrowser!.inUse = false;
        logger.debug(
          `Released page. Browser contexts: ${pooledBrowser!.contexts.length}`
        );
      } catch (error) {
        logger.error('Error releasing page:', error as Error);
      }
    };

    return { page, release };
  }

  /**
   * Wait for an available browser
   */
  private async waitForAvailableBrowser(): Promise<PooledBrowser> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const available = this.pool.find(
          (pb) => !pb.inUse && pb.contexts.length < this.maxContextsPerBrowser
        );

        if (available) {
          clearInterval(checkInterval);
          resolve(available);
        }
      }, 100);
    });
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalBrowsers: this.pool.length,
      availableBrowsers: this.pool.filter((pb) => !pb.inUse).length,
      totalContexts: this.pool.reduce((sum, pb) => sum + pb.contexts.length, 0),
      maxSize: this.maxSize,
      minSize: this.minSize,
    };
  }

  /**
   * Destroy all browsers and cleanup
   */
  async destroy(): Promise<void> {
    logger.info('Destroying browser pool...');

    await Promise.all(
      this.pool.map(async (pooledBrowser) => {
        try {
          await pooledBrowser.browser.close();
        } catch (error) {
          logger.error('Error closing browser:', error as Error);
        }
      })
    );

    this.pool = [];
    this.initPromise = null;
    logger.info('Browser pool destroyed');
  }
}