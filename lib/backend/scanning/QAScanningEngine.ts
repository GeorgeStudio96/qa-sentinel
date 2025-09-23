import {
  ScanRequest,
  ScanResult,
  PerformanceMetrics,
  ScanOptions,
  BrowserPoolConfig,
  MemoryMeasurement,
  AccessibilityResult,
  BrokenLinksResult
} from '../utils/types';
import { BrowserPoolManager } from '../browser-pool/BrowserPoolManager';
import { PageManager } from '../browser-pool/PageManager';
import { MemoryMonitor } from '../monitoring/MemoryMonitor';
import { createLogger } from '../utils/logger';

const logger = createLogger('qa-scanning-engine');

export class QAScanningEngine {
  private browserPool: BrowserPoolManager;
  private memoryMonitor: MemoryMonitor;
  private activScans = new Map<string, Promise<ScanResult>>();
  private scanStats = {
    totalScans: 0,
    successfulScans: 0,
    failedScans: 0,
    averageDuration: 0
  };

  constructor(options: {
    browserPoolOptions?: Partial<BrowserPoolConfig>;
    memoryMonitorOptions?: {
      warningThreshold?: number;
      criticalThreshold?: number;
      restartThreshold?: number;
      checkInterval?: number;
      onWarning?: (usage: MemoryMeasurement) => void;
      onCritical?: (usage: MemoryMeasurement) => void;
      onRestart?: (usage: MemoryMeasurement) => Promise<void>;
    };
  } = {}) {
    // Initialize browser pool
    this.browserPool = new BrowserPoolManager(options.browserPoolOptions);

    // Initialize memory monitor
    const defaultMemoryOptions = {
      warningThreshold: 400 * 1024 * 1024, // 400MB
      criticalThreshold: 600 * 1024 * 1024, // 600MB
      restartThreshold: 800 * 1024 * 1024, // 800MB
      onCritical: this.handleMemoryCritical,
      onRestart: this.handleMemoryRestart
    };

    this.memoryMonitor = new MemoryMonitor({
      ...defaultMemoryOptions,
      ...(options.memoryMonitorOptions || {})
    });

    this.memoryMonitor.start();
  }

  async scanWebsite(request: ScanRequest): Promise<ScanResult> {
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info(`Starting scan for ${request.url}`, { scanId });

    // Check if we already have too many concurrent scans
    if (this.activScans.size >= 10) {
      throw new Error('Too many concurrent scans. Please try again later.');
    }

    const scanPromise = this.performScan(request, scanId, startTime);
    this.activScans.set(scanId, scanPromise);

    try {
      const result = await scanPromise;
      this.updateScanStats(result, startTime);
      return result;
    } finally {
      this.activScans.delete(scanId);
    }
  }

  private async performScan(
    request: ScanRequest,
    scanId: string,
    startTime: number
  ): Promise<ScanResult> {
    let acquiredBrowser;
    let pageManager: PageManager | null = null;

    try {
      // Acquire browser from pool
      acquiredBrowser = await this.browserPool.acquire(30000);
      logger.debug(`Browser acquired for scan`, { scanId });

      // Create page manager
      pageManager = new PageManager(acquiredBrowser.browser, {
        pageTimeout: request.options?.timeout || 30000,
        maxPagesPerBrowser: 5
      });

      // Navigate to URL
      await pageManager.navigateToUrl(request.url, {
        waitUntil: request.options?.waitUntil || 'networkidle',
        timeout: request.options?.timeout || 30000
      });

      logger.debug(`Navigation completed for scan`, { scanId, url: request.url });

      // Collect data in parallel
      const [
        screenshot,
        metrics,
        accessibility,
        brokenLinks
      ] = await Promise.allSettled([
        this.captureScreenshot(pageManager, request.options),
        this.collectPerformanceMetrics(pageManager),
        this.checkAccessibility(pageManager),
        this.findBrokenLinks(pageManager)
      ]);

      // Process results
      const result: ScanResult = {
        url: request.url,
        success: true,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        screenshot: screenshot.status === 'fulfilled' ? screenshot.value : undefined,
        metrics: metrics.status === 'fulfilled' ? metrics.value : undefined,
        errors: this.collectErrors([screenshot, metrics, accessibility, brokenLinks])
      };

      // Add accessibility and broken links to result
      const extendedResult = result as ScanResult & {
        accessibility?: AccessibilityResult;
        brokenLinks?: BrokenLinksResult[];
      };
      if (accessibility.status === 'fulfilled') {
        extendedResult.accessibility = accessibility.value;
      }
      if (brokenLinks.status === 'fulfilled') {
        extendedResult.brokenLinks = brokenLinks.value;
      }

      logger.info(`Scan completed successfully`, {
        scanId,
        url: request.url,
        duration: extendedResult.duration,
        screenshotSize: extendedResult.screenshot?.length,
        errorsCount: extendedResult.errors?.length || 0
      });

      return extendedResult;

    } catch (error) {
      logger.error(`Scan failed`, { scanId, url: request.url, error });

      return {
        url: request.url,
        success: false,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };

    } finally {
      // Cleanup resources
      if (pageManager) {
        await pageManager.destroy().catch(err =>
          logger.debug('Error destroying page manager:', err)
        );
      }

      if (acquiredBrowser) {
        await acquiredBrowser.release().catch(err =>
          logger.debug('Error releasing browser:', err)
        );
      }
    }
  }

  private async captureScreenshot(
    pageManager: PageManager,
    options?: ScanOptions
  ): Promise<Buffer> {
    return await pageManager.takeScreenshot({
      fullPage: true,
      clip: options?.viewport ? {
        x: 0,
        y: 0,
        width: options.viewport.width,
        height: options.viewport.height
      } : undefined
    });
  }

  private async collectPerformanceMetrics(
    pageManager: PageManager
  ): Promise<PerformanceMetrics> {
    const pageMetrics = await pageManager.getPageMetrics();

    return {
      loadTime: pageMetrics.loadTime,
      domContentLoaded: pageMetrics.domContentLoaded,
      firstPaint: undefined, // Would need more detailed performance API
      firstContentfulPaint: undefined,
      largestContentfulPaint: undefined,
      timeToInteractive: undefined
    };
  }

  private async checkAccessibility(pageManager: PageManager): Promise<{
    violations: Array<{
      id: string;
      description: string;
      impact: string;
      nodes: number;
    }>;
    passes: number;
  }> {
    return await pageManager.checkAccessibility();
  }

  private async findBrokenLinks(pageManager: PageManager): Promise<Array<{
    url: string;
    status: number;
    text: string;
  }>> {
    return await pageManager.findBrokenLinks();
  }

  private collectErrors(results: Array<PromiseSettledResult<unknown>>): string[] {
    const errors: string[] = [];

    for (const result of results) {
      if (result.status === 'rejected') {
        const errorMessage = result.reason instanceof Error
          ? result.reason.message
          : 'Unknown error occurred';
        errors.push(errorMessage);
      }
    }

    return errors;
  }

  private updateScanStats(result: ScanResult, startTime: number): void {
    this.scanStats.totalScans++;

    if (result.success) {
      this.scanStats.successfulScans++;
    } else {
      this.scanStats.failedScans++;
    }

    // Update average duration
    const duration = Date.now() - startTime;
    this.scanStats.averageDuration =
      (this.scanStats.averageDuration * (this.scanStats.totalScans - 1) + duration) /
      this.scanStats.totalScans;
  }

  async scanMultipleWebsites(requests: ScanRequest[]): Promise<ScanResult[]> {
    logger.info(`Starting batch scan for ${requests.length} websites`);

    // Process scans in batches to avoid overwhelming the system
    const batchSize = 5;
    const results: ScanResult[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(request => this.scanWebsite(request));

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Create error result for failed batch item
          results.push({
            url: 'unknown',
            success: false,
            timestamp: Date.now(),
            duration: 0,
            errors: [result.reason instanceof Error ? result.reason.message : 'Batch scan failed']
          });
        }
      }

      // Small delay between batches to prevent overwhelming
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info(`Batch scan completed`, {
      totalRequests: requests.length,
      successfulScans: results.filter(r => r.success).length,
      failedScans: results.filter(r => !r.success).length
    });

    return results;
  }

  private handleMemoryCritical = (): void => {
    logger.warn('Critical memory usage detected, forcing GC and reducing concurrent scans');
    this.memoryMonitor.forceGC();

    // Could implement additional logic like pausing new scans temporarily
  };

  private handleMemoryRestart = async (): Promise<void> => {
    logger.error('Memory limit exceeded, initiating graceful shutdown');

    // Stop accepting new scans
    // Wait for active scans to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.activScans.size > 0 && Date.now() - startTime < timeout) {
      logger.info(`Waiting for ${this.activScans.size} active scans to complete`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Force cleanup
    await this.destroy();
  };

  getStats() {
    return {
      scanning: { ...this.scanStats },
      browserPool: this.browserPool.getStats(),
      memory: this.memoryMonitor.getMemoryReport(),
      activeScans: this.activScans.size
    };
  }

  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    checks: {
      memory: boolean;
      browserPool: boolean;
      activeScans: boolean;
    };
  } {
    const memoryHealthy = this.memoryMonitor.isMemoryHealthy();
    const browserPoolStats = this.browserPool.getStats();
    const browserPoolHealthy = browserPoolStats.pool.available > 0;
    const activeScanHealthy = this.activScans.size < 8; // Arbitrary threshold

    const allHealthy = memoryHealthy && browserPoolHealthy && activeScanHealthy;
    const anyWarning = !memoryHealthy || !activeScanHealthy;

    return {
      status: allHealthy ? 'healthy' : anyWarning ? 'warning' : 'critical',
      checks: {
        memory: memoryHealthy,
        browserPool: browserPoolHealthy,
        activeScans: activeScanHealthy
      }
    };
  }

  async destroy(): Promise<void> {
    logger.info('Destroying QA Scanning Engine...');

    // Cancel active scans (they will handle cleanup themselves)
    this.activScans.clear();

    // Destroy components
    await this.browserPool.destroy();
    this.memoryMonitor.destroy();

    logger.info('QA Scanning Engine destroyed');
  }
}