import { chromium, Page } from 'playwright';
import {
  BrowserWrapper,
  BrowserPoolConfig,
  BrowserPoolStats,
  BrowserHealth,
  AcquiredBrowser,
  BrowserTimeoutError
} from '../utils/types';
import { createLogger } from '../utils/logger';

const logger = createLogger('browser-pool-manager');

export class BrowserPoolManager {
  private config: BrowserPoolConfig;
  private availableBrowsers: BrowserWrapper[] = [];
  private activeBrowsers = new Map<string, BrowserWrapper>();
  private warmingBrowsers = new Set<string>();
  private stats: BrowserPoolStats;
  private browserHealth = new Map<string, BrowserHealth>();
  private isDestroyed = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private maintenanceInterval?: NodeJS.Timeout;

  constructor(options: Partial<BrowserPoolConfig> = {}) {
    this.config = {
      minPoolSize: options.minPoolSize || 3,
      maxPoolSize: options.maxPoolSize || 10,
      warmupSize: options.warmupSize || 2,

      // Lifecycle settings
      maxBrowserAge: options.maxBrowserAge || 30 * 60 * 1000, // 30 minutes
      maxPagesPerBrowser: options.maxPagesPerBrowser || 50,
      idleTimeout: options.idleTimeout || 5 * 60 * 1000, // 5 minutes

      // Health check settings
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      maxConsecutiveFailures: options.maxConsecutiveFailures || 3,

      // Resource limits
      memoryLimitMB: options.memoryLimitMB || 512,
      cpuThreshold: options.cpuThreshold || 80
    };

    this.stats = {
      created: 0,
      destroyed: 0,
      acquired: 0,
      released: 0,
      healthChecksFailed: 0,
      memoryKills: 0,
      timeoutKills: 0
    };

    this.initialize();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing browser pool', { config: this.config });

    // Create initial pool
    const initPromises: Promise<BrowserWrapper | null>[] = [];
    for (let i = 0; i < this.config.minPoolSize; i++) {
      initPromises.push(this.createBrowser());
    }

    await Promise.allSettled(initPromises);

    // Start background processes
    this.startHealthMonitoring();
    this.startPoolMaintenance();

    logger.info(`Browser pool initialized with ${this.availableBrowsers.length} browsers`);
  }

  async createBrowser(): Promise<BrowserWrapper | null> {
    if (this.isDestroyed) return null;

    const browserId = `browser-${++this.stats.created}`;
    const startTime = Date.now();

    try {
      const browser = await chromium.launch({
        headless: true,
        args: [
          // Performance optimizations
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',

          // Memory optimizations
          '--memory-pressure-off',
          '--max_old_space_size=512',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-client-side-phishing-detection',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-hang-monitor',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--no-default-browser-check',
          '--safebrowsing-disable-auto-update',

          // Viewport and display
          '--window-size=1920,1080',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection'
        ],

        // Browser context options
        ignoreDefaultArgs: ['--enable-automation'],
        env: {
          ...process.env,
          TZ: 'UTC' // Consistent timezone
        }
      });

      const browserWrapper: BrowserWrapper = {
        id: browserId,
        browser,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        pagesCreated: 0,
        isHealthy: true,
        consecutiveFailures: 0,
        pid: undefined
      };

      // Setup browser event handlers
      this.setupBrowserHandlers(browserWrapper);

      // Initialize browser health tracking
      this.browserHealth.set(browserId, {
        lastHealthCheck: Date.now(),
        memoryUsage: 0,
        cpuUsage: 0,
        responseTime: Date.now() - startTime
      });

      this.availableBrowsers.push(browserWrapper);

      logger.debug(`Browser created: ${browserId} (${Date.now() - startTime}ms)`);
      return browserWrapper;

    } catch (error) {
      logger.error(`Failed to create browser ${browserId}:`, error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  private setupBrowserHandlers(browserWrapper: BrowserWrapper): void {
    const { browser, id } = browserWrapper;

    // Handle browser disconnection
    browser.on('disconnected', () => {
      logger.warn(`Browser ${id} disconnected unexpectedly`);
      this.handleBrowserDisconnection(browserWrapper);
    });

    // Monitor browser process if available
    // Note: browser.process() is not available in all Playwright configurations
    // Browser process monitoring is not available in current Playwright version
    // if (process) {
    //   process.on('close', (code: number | null) => {
    //     if (code !== 0 && code !== null) {
    //       logger.error(`Browser ${id} process exited with code ${code}`);
    //     }
    //     this.handleBrowserDisconnection(browserWrapper);
    //   });
    // }
  }

  async acquire(timeout = 30000): Promise<AcquiredBrowser> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Try to get available browser
      const browserWrapper = this.getAvailableBrowser();

      if (browserWrapper) {
        // Move to active pool
        this.activeBrowsers.set(browserWrapper.id, browserWrapper);
        browserWrapper.lastUsed = Date.now();
        this.stats.acquired++;

        return {
          browser: browserWrapper.browser,
          id: browserWrapper.id,
          release: () => this.release(browserWrapper.id)
        };
      }

      // Try to create new browser if under limit
      if (this.getTotalBrowserCount() < this.config.maxPoolSize) {
        try {
          const newBrowser = await this.createBrowser();
          if (newBrowser) {
            // Immediately acquire the new browser
            this.availableBrowsers.pop(); // Remove from available
            this.activeBrowsers.set(newBrowser.id, newBrowser);
            newBrowser.lastUsed = Date.now();
            this.stats.acquired++;

            return {
              browser: newBrowser.browser,
              id: newBrowser.id,
              release: () => this.release(newBrowser.id)
            };
          }
        } catch (error) {
          logger.error('Failed to create browser on demand:', error instanceof Error ? error : new Error('Unknown error'));
        }
      }

      // Wait briefly before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new BrowserTimeoutError(`Failed to acquire browser within ${timeout}ms`, timeout);
  }

  private getAvailableBrowser(): BrowserWrapper | null {
    // Remove unhealthy browsers
    this.availableBrowsers = this.availableBrowsers.filter(wrapper => {
      if (!this.isBrowserHealthy(wrapper)) {
        this.destroyBrowser(wrapper);
        return false;
      }
      return true;
    });

    // Return the least recently used browser
    if (this.availableBrowsers.length > 0) {
      return this.availableBrowsers.shift() || null;
    }

    return null;
  }

  async release(browserId: string): Promise<void> {
    const browserWrapper = this.activeBrowsers.get(browserId);
    if (!browserWrapper) {
      logger.warn(`Attempted to release unknown browser: ${browserId}`);
      return;
    }

    this.activeBrowsers.delete(browserId);
    browserWrapper.lastUsed = Date.now();
    this.stats.released++;

    // Check if browser should be retired
    if (this.shouldRetireBrowser(browserWrapper)) {
      await this.destroyBrowser(browserWrapper);
      return;
    }

    // Cleanup browser state
    try {
      await this.cleanupBrowserState(browserWrapper);
      this.availableBrowsers.push(browserWrapper);
    } catch (error) {
      logger.error(`Failed to cleanup browser ${browserId}:`, error instanceof Error ? error : new Error('Unknown error'));
      await this.destroyBrowser(browserWrapper);
    }
  }

  private async cleanupBrowserState(browserWrapper: BrowserWrapper): Promise<void> {
    const { browser } = browserWrapper;

    try {
      // Close all pages except the first one
      const contexts = browser.contexts();
      const pages = contexts.length > 0 ? contexts[0].pages() : [];
      const closePromises = pages.slice(1).map((page: Page) =>
        page.close().catch((err: unknown) =>
          logger.debug(`Failed to close page: ${err instanceof Error ? err.message : 'Unknown error'}`)
        )
      );

      await Promise.allSettled(closePromises);

      // Reset the default page
      if (pages[0]) {
        try {
          await pages[0].goto('about:blank');
          await pages[0].evaluate(() => {
            // Clear any global state
            if (typeof window !== 'undefined') {
              window.localStorage?.clear();
              window.sessionStorage?.clear();
            }
          });
        } catch (error) {
          logger.debug(`Failed to reset default page: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update browser stats
      browserWrapper.pagesCreated = 0;
    } catch (error) {
      logger.error(`Error during browser cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private shouldRetireBrowser(browserWrapper: BrowserWrapper): boolean {
    const age = Date.now() - browserWrapper.createdAt;

    return (
      age > this.config.maxBrowserAge ||
      browserWrapper.pagesCreated > this.config.maxPagesPerBrowser ||
      !browserWrapper.isHealthy ||
      browserWrapper.consecutiveFailures > this.config.maxConsecutiveFailures
    );
  }

  async destroyBrowser(browserWrapper: BrowserWrapper): Promise<void> {
    const { browser, id } = browserWrapper;

    try {
      // Remove from all pools
      this.removeBrowserFromPools(browserWrapper);

      // Cleanup health tracking
      this.browserHealth.delete(id);

      // Close browser
      if (browser && browser.isConnected()) {
        await Promise.race([
          browser.close(),
          new Promise<void>(resolve => setTimeout(resolve, 5000)) // 5s timeout
        ]);
      }

      this.stats.destroyed++;
      logger.debug(`Browser destroyed: ${id}`);

    } catch (error) {
      logger.error(`Error destroying browser ${id}:`, error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  private removeBrowserFromPools(browserWrapper: BrowserWrapper): void {
    // Remove from available pool
    const availableIndex = this.availableBrowsers.findIndex(b => b.id === browserWrapper.id);
    if (availableIndex !== -1) {
      this.availableBrowsers.splice(availableIndex, 1);
    }

    // Remove from active pool
    this.activeBrowsers.delete(browserWrapper.id);

    // Remove from warming pool
    this.warmingBrowsers.delete(browserWrapper.id);
  }

  private isBrowserHealthy(browserWrapper: BrowserWrapper): boolean {
    // Basic health checks
    if (!browserWrapper.browser || !browserWrapper.browser.isConnected()) {
      return false;
    }

    if (browserWrapper.consecutiveFailures > this.config.maxConsecutiveFailures) {
      return false;
    }

    // Check browser process
    if (browserWrapper.pid) {
      try {
        process.kill(browserWrapper.pid, 0); // Check if process exists
      } catch {
        return false;
      }
    }

    return true;
  }

  private async performHealthCheck(browserWrapper: BrowserWrapper): Promise<boolean> {
    const { browser, id } = browserWrapper;
    const startTime = Date.now();

    try {
      // Test browser responsiveness
      await Promise.race([
        Promise.resolve(browser.contexts().length > 0 ? browser.contexts()[0].pages() : []),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]);

      // Update health status
      browserWrapper.isHealthy = true;
      browserWrapper.consecutiveFailures = 0;

      const healthData = this.browserHealth.get(id);
      if (healthData) {
        healthData.lastHealthCheck = Date.now();
        healthData.responseTime = Date.now() - startTime;
      }

      return true;

    } catch (error) {
      logger.warn(`Health check failed for browser ${id}:`, { message: error instanceof Error ? error.message : 'Unknown error' });

      browserWrapper.consecutiveFailures++;
      browserWrapper.isHealthy = false;
      this.stats.healthChecksFailed++;

      return false;
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.runHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async runHealthChecks(): Promise<void> {
    if (this.isDestroyed) return;

    const allBrowsers = [
      ...this.availableBrowsers,
      ...this.activeBrowsers.values()
    ];

    const healthPromises = allBrowsers.map(browserWrapper =>
      this.performHealthCheck(browserWrapper)
    );

    await Promise.allSettled(healthPromises);

    // Remove unhealthy browsers
    const unhealthyBrowsers = allBrowsers.filter(wrapper => !wrapper.isHealthy);
    for (const wrapper of unhealthyBrowsers) {
      await this.destroyBrowser(wrapper);
    }
  }

  private startPoolMaintenance(): void {
    this.maintenanceInterval = setInterval(async () => {
      await this.maintainPool();
    }, 60000); // Every minute
  }

  private async maintainPool(): Promise<void> {
    if (this.isDestroyed) return;

    try {
      // Remove idle browsers
      await this.removeIdleBrowsers();

      // Ensure minimum pool size
      await this.ensureMinimumPoolSize();

      // Warm up additional browsers if needed
      await this.warmUpBrowsers();

      // Log pool status
      this.logPoolStatus();

    } catch (error) {
      logger.error('Pool maintenance error:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async removeIdleBrowsers(): Promise<void> {
    const now = Date.now();
    const idleBrowsers = this.availableBrowsers.filter(wrapper => {
      const idleTime = now - wrapper.lastUsed;
      return idleTime > this.config.idleTimeout &&
             this.availableBrowsers.length > this.config.minPoolSize;
    });

    for (const wrapper of idleBrowsers) {
      await this.destroyBrowser(wrapper);
      this.stats.timeoutKills++;
    }
  }

  private async ensureMinimumPoolSize(): Promise<void> {
    const currentSize = this.getTotalBrowserCount();
    const needed = this.config.minPoolSize - currentSize;

    if (needed > 0) {
      logger.info(`Creating ${needed} browsers to maintain minimum pool size`);

      const createPromises: Promise<void>[] = [];
      for (let i = 0; i < needed; i++) {
        createPromises.push(this.createBrowser().catch(err => {
          logger.error('Failed to create browser for minimum pool:', err instanceof Error ? err : new Error('Unknown error'));
        }).then(() => {})); // Convert to void
      }

      await Promise.allSettled(createPromises);
    }
  }

  private async warmUpBrowsers(): Promise<void> {
    const availableCount = this.availableBrowsers.length;
    const warmupNeeded = this.config.warmupSize - availableCount;

    if (warmupNeeded > 0 && this.getTotalBrowserCount() < this.config.maxPoolSize) {
      const createCount = Math.min(warmupNeeded, this.config.maxPoolSize - this.getTotalBrowserCount());

      for (let i = 0; i < createCount; i++) {
        this.createBrowser().catch(err => {
          logger.debug('Failed to warm up browser:', { message: err instanceof Error ? err.message : String(err) });
        });
      }
    }
  }

  private getTotalBrowserCount(): number {
    return this.availableBrowsers.length + this.activeBrowsers.size;
  }

  private logPoolStatus(): void {
    const status = {
      available: this.availableBrowsers.length,
      active: this.activeBrowsers.size,
      total: this.getTotalBrowserCount(),
      stats: this.stats
    };

    logger.debug('Browser pool status:', status);
  }

  getStats(): {
    pool: {
      available: number;
      active: number;
      total: number;
      maxSize: number;
    };
    lifetime: BrowserPoolStats;
    health: {
      totalHealthChecks: number;
      healthyBrowsers: number;
      unhealthyBrowsers: number;
    };
  } {
    return {
      pool: {
        available: this.availableBrowsers.length,
        active: this.activeBrowsers.size,
        total: this.getTotalBrowserCount(),
        maxSize: this.config.maxPoolSize
      },
      lifetime: { ...this.stats },
      health: {
        totalHealthChecks: this.stats.healthChecksFailed + (this.stats.created * 10), // Estimate
        healthyBrowsers: this.availableBrowsers.filter(b => b.isHealthy).length,
        unhealthyBrowsers: this.availableBrowsers.filter(b => !b.isHealthy).length
      }
    };
  }

  private handleBrowserDisconnection(browserWrapper: BrowserWrapper): void {
    logger.warn(`Handling disconnection for browser ${browserWrapper.id}`);
    this.removeBrowserFromPools(browserWrapper);
    this.browserHealth.delete(browserWrapper.id);
  }

  async destroy(): Promise<void> {
    if (this.isDestroyed) return;

    logger.info('Destroying browser pool...');
    this.isDestroyed = true;

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }

    // Destroy all browsers
    const allBrowsers = [
      ...this.availableBrowsers,
      ...this.activeBrowsers.values()
    ];

    const destroyPromises = allBrowsers.map(wrapper =>
      this.destroyBrowser(wrapper)
    );

    await Promise.allSettled(destroyPromises);

    // Clear all pools
    this.availableBrowsers = [];
    this.activeBrowsers.clear();
    this.warmingBrowsers.clear();
    this.browserHealth.clear();

    logger.info('Browser pool destroyed');
  }
}