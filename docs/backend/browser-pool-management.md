# Browser Pool Management
> Эффективное управление браузерами для QA сканирования

## 🎯 Цель документа
Обеспечить надежное и производительное управление пулом браузеров для параллельного сканирования сотен сайтов без memory leaks и resource exhaustion.

---

## 🧠 Browser Pool Strategy

### **Архитектурный подход**
```
┌─────────────────────────────────────────────────────────┐
│                    Browser Pool Manager                  │
├─────────────────────────────────────────────────────────┤
│  Available Pool    │    Active Pool    │  Warming Pool   │
│  ┌─────────────┐   │   ┌─────────────┐ │ ┌─────────────┐ │
│  │ Browser 1   │   │   │ Browser 4   │ │ │ Browser 7   │ │
│  │ Browser 2   │   │   │ Browser 5   │ │ │ Browser 8   │ │
│  │ Browser 3   │   │   │ Browser 6   │ │ │             │ │
│  └─────────────┘   │   └─────────────┘ │ └─────────────┘ │
├─────────────────────────────────────────────────────────┤
│              Health Monitor & Auto-scaling               │
└─────────────────────────────────────────────────────────┘
```

### **Core Implementation**
```javascript
class BrowserPoolManager {
  constructor(options = {}) {
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

    // Pool state
    this.availableBrowsers = [];
    this.activeBrowsers = new Map();
    this.warmingBrowsers = new Set();

    // Statistics
    this.stats = {
      created: 0,
      destroyed: 0,
      acquired: 0,
      released: 0,
      healthChecksFailed: 0,
      memoryKills: 0,
      timeoutKills: 0
    };

    // Health monitoring
    this.browserHealth = new Map();
    this.isDestroyed = false;

    this.initialize();
  }

  async initialize() {
    logger.info('Initializing browser pool', this.config);

    // Create initial pool
    const initPromises = [];
    for (let i = 0; i < this.config.minPoolSize; i++) {
      initPromises.push(this.createBrowser());
    }

    await Promise.allSettled(initPromises);

    // Start background processes
    this.startHealthMonitoring();
    this.startPoolMaintenance();

    logger.info(`Browser pool initialized with ${this.availableBrowsers.length} browsers`);
  }

  async createBrowser() {
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

      const browserWrapper = {
        id: browserId,
        browser,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        pagesCreated: 0,
        isHealthy: true,
        consecutiveFailures: 0,
        pid: browser.process()?.pid
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
      logger.error(`Failed to create browser ${browserId}:`, error);
      throw error;
    }
  }

  setupBrowserHandlers(browserWrapper) {
    const { browser, id } = browserWrapper;

    // Handle browser disconnection
    browser.on('disconnected', () => {
      logger.warn(`Browser ${id} disconnected unexpectedly`);
      this.handleBrowserDisconnection(browserWrapper);
    });

    // Monitor browser process if available
    if (browser.process()) {
      browser.process().on('close', (code) => {
        if (code !== 0 && code !== null) {
          logger.error(`Browser ${id} process exited with code ${code}`);
        }
        this.handleBrowserDisconnection(browserWrapper);
      });
    }
  }

  async acquire(timeout = 30000) {
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
          logger.error('Failed to create browser on demand:', error);
        }
      }

      // Wait briefly before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Failed to acquire browser within ${timeout}ms`);
  }

  getAvailableBrowser() {
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
      return this.availableBrowsers.shift();
    }

    return null;
  }

  async release(browserId) {
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
      logger.error(`Failed to cleanup browser ${browserId}:`, error);
      await this.destroyBrowser(browserWrapper);
    }
  }

  async cleanupBrowserState(browserWrapper) {
    const { browser } = browserWrapper;

    // Close all pages except the first one
    const pages = await browser.pages();
    const closePromises = pages.slice(1).map(page =>
      page.close().catch(err =>
        logger.debug(`Failed to close page: ${err.message}`)
      )
    );

    await Promise.allSettled(closePromises);

    // Reset the default page
    if (pages[0]) {
      try {
        await pages[0].goto('about:blank');
        await pages[0].evaluate(() => {
          // Clear any global state
          window.localStorage.clear();
          window.sessionStorage.clear();
        });
      } catch (error) {
        logger.debug(`Failed to reset default page: ${error.message}`);
      }
    }

    // Update browser stats
    browserWrapper.pagesCreated = 0;
  }

  shouldRetireBrowser(browserWrapper) {
    const age = Date.now() - browserWrapper.createdAt;

    return (
      age > this.config.maxBrowserAge ||
      browserWrapper.pagesCreated > this.config.maxPagesPerBrowser ||
      !browserWrapper.isHealthy ||
      browserWrapper.consecutiveFailures > this.config.maxConsecutiveFailures
    );
  }

  async destroyBrowser(browserWrapper) {
    const { browser, id } = browserWrapper;

    try {
      // Remove from all pools
      this.removeBrowserFromPools(browserWrapper);

      // Cleanup health tracking
      this.browserHealth.delete(id);

      // Close browser
      if (browser && !browser.isClosed()) {
        await Promise.race([
          browser.close(),
          new Promise(resolve => setTimeout(resolve, 5000)) // 5s timeout
        ]);
      }

      this.stats.destroyed++;
      logger.debug(`Browser destroyed: ${id}`);

    } catch (error) {
      logger.error(`Error destroying browser ${id}:`, error);
    }
  }

  removeBrowserFromPools(browserWrapper) {
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

  isBrowserHealthy(browserWrapper) {
    // Basic health checks
    if (!browserWrapper.browser || browserWrapper.browser.isClosed()) {
      return false;
    }

    if (browserWrapper.consecutiveFailures > this.config.maxConsecutiveFailures) {
      return false;
    }

    // Check browser process
    if (browserWrapper.pid) {
      try {
        process.kill(browserWrapper.pid, 0); // Check if process exists
      } catch (error) {
        return false;
      }
    }

    return true;
  }

  async performHealthCheck(browserWrapper) {
    const { browser, id } = browserWrapper;
    const startTime = Date.now();

    try {
      // Test browser responsiveness
      const pages = await Promise.race([
        browser.pages(),
        new Promise((_, reject) =>
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
      logger.warn(`Health check failed for browser ${id}:`, error.message);

      browserWrapper.consecutiveFailures++;
      browserWrapper.isHealthy = false;
      this.stats.healthChecksFailed++;

      return false;
    }
  }

  startHealthMonitoring() {
    setInterval(async () => {
      await this.runHealthChecks();
    }, this.config.healthCheckInterval);
  }

  async runHealthChecks() {
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

  startPoolMaintenance() {
    setInterval(async () => {
      await this.maintainPool();
    }, 60000); // Every minute
  }

  async maintainPool() {
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
      logger.error('Pool maintenance error:', error);
    }
  }

  async removeIdleBrowsers() {
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

  async ensureMinimumPoolSize() {
    const currentSize = this.getTotalBrowserCount();
    const needed = this.config.minPoolSize - currentSize;

    if (needed > 0) {
      logger.info(`Creating ${needed} browsers to maintain minimum pool size`);

      const createPromises = [];
      for (let i = 0; i < needed; i++) {
        createPromises.push(this.createBrowser().catch(err => {
          logger.error('Failed to create browser for minimum pool:', err);
        }));
      }

      await Promise.allSettled(createPromises);
    }
  }

  async warmUpBrowsers() {
    const availableCount = this.availableBrowsers.length;
    const warmupNeeded = this.config.warmupSize - availableCount;

    if (warmupNeeded > 0 && this.getTotalBrowserCount() < this.config.maxPoolSize) {
      const createCount = Math.min(warmupNeeded, this.config.maxPoolSize - this.getTotalBrowserCount());

      for (let i = 0; i < createCount; i++) {
        this.createBrowser().catch(err => {
          logger.debug('Failed to warm up browser:', err.message);
        });
      }
    }
  }

  getTotalBrowserCount() {
    return this.availableBrowsers.length + this.activeBrowsers.size;
  }

  logPoolStatus() {
    const status = {
      available: this.availableBrowsers.length,
      active: this.activeBrowsers.size,
      total: this.getTotalBrowserCount(),
      stats: this.stats
    };

    logger.debug('Browser pool status:', status);
  }

  getStats() {
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

  handleBrowserDisconnection(browserWrapper) {
    logger.warn(`Handling disconnection for browser ${browserWrapper.id}`);
    this.removeBrowserFromPools(browserWrapper);
    this.browserHealth.delete(browserWrapper.id);
  }

  async destroy() {
    if (this.isDestroyed) return;

    logger.info('Destroying browser pool...');
    this.isDestroyed = true;

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
```

---

## 🎭 Page Management

### **Page Lifecycle Manager**
```javascript
class PageManager {
  constructor(browser, options = {}) {
    this.browser = browser;
    this.options = {
      maxPagesPerBrowser: options.maxPagesPerBrowser || 5,
      pageTimeout: options.pageTimeout || 30000,
      maxPageAge: options.maxPageAge || 5 * 60 * 1000, // 5 minutes
      ...options
    };

    this.activePage = null;
    this.pageStats = {
      created: 0,
      destroyed: 0,
      errors: 0
    };
  }

  async getPage() {
    if (this.activePage && !this.activePage.isClosed()) {
      await this.resetPage(this.activePage);
      return this.activePage;
    }

    this.activePage = await this.createPage();
    return this.activePage;
  }

  async createPage() {
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
      throw error;
    }
  }

  async configurePage(page) {
    // Set viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 QASentinel/1.0'
    );

    // Block unnecessary resources
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();

      // Block ads, analytics, and other non-essential resources
      const blockedTypes = ['font', 'media'];
      const blockedDomains = [
        'google-analytics.com',
        'googletagmanager.com',
        'facebook.com',
        'doubleclick.net'
      ];

      const url = route.request().url();
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
        logger.debug('Page console error:', msg.text());
      }
    });
  }

  setupPageHandlers(page) {
    page.on('crash', () => {
      logger.error('Page crashed');
      this.pageStats.errors++;
    });

    page.on('error', (error) => {
      logger.error('Page error:', error);
      this.pageStats.errors++;
    });

    page.on('pageerror', (error) => {
      logger.debug('Page JavaScript error:', error.message);
    });
  }

  async resetPage(page) {
    try {
      // Navigate to blank page
      await page.goto('about:blank');

      // Clear storage
      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          // Storage might not be available
        }
      });

      // Clear cookies
      const context = page.context();
      await context.clearCookies();

    } catch (error) {
      logger.debug('Failed to reset page:', error.message);
      // If reset fails, create a new page
      await page.close();
      this.activePage = null;
    }
  }

  async destroy() {
    if (this.activePage && !this.activePage.isClosed()) {
      try {
        await this.activePage.close();
        this.pageStats.destroyed++;
      } catch (error) {
        logger.debug('Error closing page:', error.message);
      }
    }
  }

  getStats() {
    return { ...this.pageStats };
  }
}
```

---

## 📊 Browser Pool Monitoring

### **Metrics Collection**
```javascript
class BrowserPoolMetrics {
  constructor(poolManager) {
    this.poolManager = poolManager;
    this.metrics = {
      // Pool metrics
      browserPoolSize: new Gauge('browser_pool_size', ['status']),
      browserLifetime: new Histogram('browser_lifetime_seconds'),
      browserCreationTime: new Histogram('browser_creation_time_seconds'),

      // Usage metrics
      browserAcquisitionTime: new Histogram('browser_acquisition_time_seconds'),
      browserUtilization: new Gauge('browser_utilization_percent'),

      // Health metrics
      browserHealthChecks: new Counter('browser_health_checks_total', ['result']),
      browserMemoryUsage: new Gauge('browser_memory_usage_mb', ['browser_id']),

      // Error metrics
      browserErrors: new Counter('browser_errors_total', ['type']),
      browserRestartsTotal: new Counter('browser_restarts_total', ['reason'])
    };

    this.startCollecting();
  }

  startCollecting() {
    setInterval(() => {
      this.collectPoolMetrics();
    }, 10000); // Every 10 seconds

    setInterval(() => {
      this.collectDetailedMetrics();
    }, 60000); // Every minute
  }

  collectPoolMetrics() {
    const stats = this.poolManager.getStats();

    this.metrics.browserPoolSize.set({ status: 'available' }, stats.pool.available);
    this.metrics.browserPoolSize.set({ status: 'active' }, stats.pool.active);
    this.metrics.browserPoolSize.set({ status: 'total' }, stats.pool.total);

    // Calculate utilization
    const utilization = stats.pool.maxSize > 0
      ? (stats.pool.active / stats.pool.maxSize) * 100
      : 0;
    this.metrics.browserUtilization.set(utilization);

    // Update counters
    this.metrics.browserErrors.inc({ type: 'health_check' }, stats.lifetime.healthChecksFailed);
    this.metrics.browserRestartsTotal.inc({ reason: 'memory' }, stats.lifetime.memoryKills);
    this.metrics.browserRestartsTotal.inc({ reason: 'timeout' }, stats.lifetime.timeoutKills);
  }

  async collectDetailedMetrics() {
    // Collect memory usage for each browser
    const allBrowsers = [
      ...this.poolManager.availableBrowsers,
      ...this.poolManager.activeBrowsers.values()
    ];

    for (const browserWrapper of allBrowsers) {
      try {
        const memoryUsage = await this.getBrowserMemoryUsage(browserWrapper);
        this.metrics.browserMemoryUsage.set(
          { browser_id: browserWrapper.id },
          memoryUsage
        );
      } catch (error) {
        logger.debug(`Failed to get memory usage for ${browserWrapper.id}:`, error.message);
      }
    }
  }

  async getBrowserMemoryUsage(browserWrapper) {
    const { browser } = browserWrapper;

    try {
      // Get memory usage from browser
      const pages = await browser.pages();
      if (pages.length === 0) return 0;

      const metrics = await pages[0].evaluate(() => {
        return (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null;
      });

      return metrics ? metrics.usedJSHeapSize / (1024 * 1024) : 0; // MB

    } catch (error) {
      return 0;
    }
  }

  // Track browser acquisition time
  onBrowserAcquired(startTime) {
    const duration = (Date.now() - startTime) / 1000;
    this.metrics.browserAcquisitionTime.observe(duration);
  }

  // Track browser creation time
  onBrowserCreated(startTime) {
    const duration = (Date.now() - startTime) / 1000;
    this.metrics.browserCreationTime.observe(duration);
  }

  // Track browser lifetime
  onBrowserDestroyed(browserWrapper) {
    const lifetime = (Date.now() - browserWrapper.createdAt) / 1000;
    this.metrics.browserLifetime.observe(lifetime);
  }

  // Track health check results
  onHealthCheck(success) {
    this.metrics.browserHealthChecks.inc({ result: success ? 'success' : 'failure' });
  }
}
```

---

## 🚨 Browser Pool Health Checks

### **Comprehensive Health Monitoring**
```javascript
class BrowserHealthMonitor {
  constructor(poolManager) {
    this.poolManager = poolManager;
    this.healthChecks = [
      this.checkBrowserResponsiveness.bind(this),
      this.checkMemoryUsage.bind(this),
      this.checkPageCount.bind(this),
      this.checkProcessHealth.bind(this)
    ];
  }

  async runAllHealthChecks(browserWrapper) {
    const results = [];

    for (const check of this.healthChecks) {
      try {
        const result = await check(browserWrapper);
        results.push(result);
      } catch (error) {
        results.push({
          name: check.name,
          passed: false,
          error: error.message
        });
      }
    }

    const overallHealth = results.every(r => r.passed);
    return {
      overall: overallHealth,
      checks: results,
      timestamp: Date.now()
    };
  }

  async checkBrowserResponsiveness(browserWrapper) {
    const startTime = Date.now();

    try {
      await Promise.race([
        browserWrapper.browser.pages(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]);

      return {
        name: 'responsiveness',
        passed: true,
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        name: 'responsiveness',
        passed: false,
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  async checkMemoryUsage(browserWrapper) {
    const { browser, pid } = browserWrapper;

    try {
      // Check process memory if PID available
      if (pid) {
        const memoryUsage = await this.getProcessMemoryUsage(pid);
        const memoryLimitMB = this.poolManager.config.memoryLimitMB;

        return {
          name: 'memory',
          passed: memoryUsage < memoryLimitMB,
          memoryUsage,
          memoryLimit: memoryLimitMB
        };
      }

      return { name: 'memory', passed: true, note: 'PID not available' };

    } catch (error) {
      return {
        name: 'memory',
        passed: false,
        error: error.message
      };
    }
  }

  async getProcessMemoryUsage(pid) {
    // This is a simplified implementation
    // In production, you might use a more robust method
    try {
      const { execSync } = require('child_process');
      const output = execSync(`ps -p ${pid} -o rss=`, { encoding: 'utf8' });
      const rssKB = parseInt(output.trim());
      return rssKB / 1024; // Convert to MB
    } catch (error) {
      throw new Error(`Failed to get memory usage: ${error.message}`);
    }
  }

  async checkPageCount(browserWrapper) {
    try {
      const pages = await browserWrapper.browser.pages();
      const maxPages = this.poolManager.config.maxPagesPerBrowser;

      return {
        name: 'page_count',
        passed: pages.length <= maxPages,
        pageCount: pages.length,
        maxPages
      };

    } catch (error) {
      return {
        name: 'page_count',
        passed: false,
        error: error.message
      };
    }
  }

  async checkProcessHealth(browserWrapper) {
    const { pid } = browserWrapper;

    if (!pid) {
      return { name: 'process', passed: true, note: 'PID not available' };
    }

    try {
      // Check if process exists
      process.kill(pid, 0);

      return {
        name: 'process',
        passed: true,
        pid
      };

    } catch (error) {
      return {
        name: 'process',
        passed: false,
        error: 'Process not found',
        pid
      };
    }
  }
}
```

---

## ✅ Browser Pool Checklist

### **Pre-deployment Checklist**
- [ ] Pool size limits настроены based на server resources
- [ ] Health check intervals оптимизированы
- [ ] Memory limits установлены per browser
- [ ] Timeout settings протестированы
- [ ] Browser args оптимизированы для performance
- [ ] Error handling реализован для all edge cases
- [ ] Metrics collection настроен
- [ ] Log levels настроены appropriately

### **Monitoring Checklist**
- [ ] Browser pool utilization tracked
- [ ] Memory usage per browser monitored
- [ ] Browser creation/destruction rates tracked
- [ ] Health check failure rates monitored
- [ ] Browser lifetime metrics collected
- [ ] Resource exhaustion alerts configured

### **Performance Checklist**
- [ ] Browser warm-up strategy implemented
- [ ] Page reuse optimized
- [ ] Resource blocking configured
- [ ] Navigation timeouts set appropriately
- [ ] Cleanup procedures optimized

---

*Документ обновлен: 2024-09-23*
*Критично для стабильности QA сканирования*