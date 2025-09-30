import {
  MemoryThresholds,
  MemoryMeasurement,
  MemoryReport
} from '../utils/types';
import { createLogger } from '../utils/logger';

const logger = createLogger('memory-monitor');

export class MemoryMonitor {
  private thresholds: MemoryThresholds;
  private checkInterval: number;
  private measurements: MemoryMeasurement[] = [];
  private isMonitoring = false;
  private intervalId?: NodeJS.Timeout;
  private onWarning?: (usage: MemoryMeasurement) => void;
  private onCritical?: (usage: MemoryMeasurement) => void;
  private onRestart?: (usage: MemoryMeasurement) => Promise<void>;

  constructor(options: {
    warningThreshold?: number;
    criticalThreshold?: number;
    restartThreshold?: number;
    checkInterval?: number;
    onWarning?: (usage: MemoryMeasurement) => void;
    onCritical?: (usage: MemoryMeasurement) => void;
    onRestart?: (usage: MemoryMeasurement) => Promise<void>;
  } = {}) {
    this.thresholds = {
      warning: options.warningThreshold || 500 * 1024 * 1024, // 500MB
      critical: options.criticalThreshold || 800 * 1024 * 1024, // 800MB
      restart: options.restartThreshold || 1000 * 1024 * 1024 // 1GB
    };

    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.onWarning = options.onWarning;
    this.onCritical = options.onCritical;
    this.onRestart = options.onRestart;
  }

  start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.intervalId = setInterval(() => {
      this.checkMemory();
    }, this.checkInterval);

    logger.info('Memory monitoring started', {
      thresholds: {
        warning: this.formatBytes(this.thresholds.warning),
        critical: this.formatBytes(this.thresholds.critical),
        restart: this.formatBytes(this.thresholds.restart)
      },
      checkInterval: this.checkInterval
    });
  }

  stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    logger.info('Memory monitoring stopped');
  }

  checkMemory(): MemoryMeasurement {
    const usage = process.memoryUsage();
    const timestamp = Date.now();

    const measurement: MemoryMeasurement = {
      timestamp,
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external
    };

    this.measurements.push(measurement);

    // Keep only the last 100 measurements
    if (this.measurements.length > 100) {
      this.measurements.shift();
    }

    // Check thresholds
    this.checkThresholds(measurement);

    return measurement;
  }

  private checkThresholds(usage: MemoryMeasurement): void {
    const { heapUsed } = usage;

    if (heapUsed > this.thresholds.restart) {
      logger.error('CRITICAL: Memory usage exceeded restart threshold', {
        heapUsed: this.formatBytes(heapUsed),
        threshold: this.formatBytes(this.thresholds.restart),
        trend: this.calculateTrend()
      });

      // Trigger restart callback
      if (this.onRestart) {
        this.onRestart(usage).catch(error => {
          logger.error('Restart callback failed:', error instanceof Error ? error : new Error('Unknown error'));
        });
      } else {
        this.initiateGracefulRestart();
      }

    } else if (heapUsed > this.thresholds.critical) {
      logger.error('CRITICAL: High memory usage detected', {
        heapUsed: this.formatBytes(heapUsed),
        threshold: this.formatBytes(this.thresholds.critical),
        trend: this.calculateTrend()
      });

      // Trigger critical callback
      if (this.onCritical) {
        this.onCritical(usage);
      } else {
        this.forceGC();
      }

    } else if (heapUsed > this.thresholds.warning) {
      logger.warn('WARNING: Elevated memory usage', {
        heapUsed: this.formatBytes(heapUsed),
        threshold: this.formatBytes(this.thresholds.warning),
        trend: this.calculateTrend()
      });

      // Trigger warning callback
      if (this.onWarning) {
        this.onWarning(usage);
      }
    }
  }

  forceGC(): void {
    if (global.gc) {
      logger.info('Forcing garbage collection');
      try {
        global.gc();
        logger.info('Garbage collection completed');
      } catch (error) {
        logger.error('Garbage collection failed:', error instanceof Error ? error : new Error('Unknown error'));
      }
    } else {
      logger.warn('Garbage collection not available. Start Node.js with --expose-gc flag to enable manual GC');
    }
  }

  async createHeapSnapshot(): Promise<string | null> {
    try {
      const v8 = await import('v8');
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');

      // Ensure snapshots directory exists
      const snapshotDir = './heap-snapshots';
      await fs.mkdir(snapshotDir, { recursive: true });

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `heap-snapshot-${timestamp}.heapsnapshot`;
      const filepath = path.join(snapshotDir, filename);

      // Create heap snapshot
      logger.info(`Creating heap snapshot: ${filename}`);
      v8.writeHeapSnapshot(filepath);

      logger.info(`Heap snapshot created: ${filepath}`);
      return filepath;

    } catch (error) {
      logger.error('Failed to create heap snapshot:', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private async initiateGracefulRestart(): Promise<void> {
    logger.info('Initiating graceful restart due to memory threshold breach');

    try {
      // Create heap snapshot before restart
      await this.createHeapSnapshot();

      // Allow some time for cleanup
      setTimeout(() => {
        logger.error('Restarting process due to memory limit');
        process.exit(1);
      }, 5000);

    } catch (error) {
      logger.error('Error during graceful restart:', error instanceof Error ? error : new Error('Unknown error'));
      process.exit(1);
    }
  }

  getMemoryReport(): MemoryReport {
    const current = process.memoryUsage();
    const trend = this.calculateTrend();

    return {
      current: {
        rss: this.formatBytes(current.rss),
        heapUsed: this.formatBytes(current.heapUsed),
        heapTotal: this.formatBytes(current.heapTotal),
        external: this.formatBytes(current.external)
      },
      trend,
      thresholds: {
        warning: this.formatBytes(this.thresholds.warning),
        critical: this.formatBytes(this.thresholds.critical),
        restart: this.formatBytes(this.thresholds.restart)
      }
    };
  }

  calculateTrend(): 'increasing' | 'decreasing' | 'stable' | 'insufficient_data' {
    if (this.measurements.length < 10) return 'insufficient_data';

    const recent = this.measurements.slice(-10);
    const first = recent[0].heapUsed;
    const last = recent[recent.length - 1].heapUsed;

    const changePercent = ((last - first) / first) * 100;

    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  getMemoryHistory(count = 20): MemoryMeasurement[] {
    return this.measurements.slice(-count);
  }

  isMemoryHealthy(): boolean {
    if (this.measurements.length === 0) return true;

    const latest = this.measurements[this.measurements.length - 1];
    return latest.heapUsed < this.thresholds.warning;
  }

  getCurrentMemoryUsage(): MemoryMeasurement {
    const usage = process.memoryUsage();
    return {
      timestamp: Date.now(),
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external
    };
  }

  setThresholds(thresholds: Partial<MemoryThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds
    };

    logger.info('Memory thresholds updated', {
      warning: this.formatBytes(this.thresholds.warning),
      critical: this.formatBytes(this.thresholds.critical),
      restart: this.formatBytes(this.thresholds.restart)
    });
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100}${units[unitIndex]}`;
  }

  // Static method to check if memory usage exceeds threshold
  static checkMemoryThreshold(threshold: number): boolean {
    const usage = process.memoryUsage();
    return usage.heapUsed > threshold;
  }

  // Static method to get current memory usage in a readable format
  static getCurrentMemoryUsage(): {
    rss: string;
    heapUsed: string;
    heapTotal: string;
    external: string;
    percentage: number;
  } {
    const usage = process.memoryUsage();
    const formatBytes = (bytes: number): string => {
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unitIndex = 0;

      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }

      return `${Math.round(size * 100) / 100}${units[unitIndex]}`;
    };

    return {
      rss: formatBytes(usage.rss),
      heapUsed: formatBytes(usage.heapUsed),
      heapTotal: formatBytes(usage.heapTotal),
      external: formatBytes(usage.external),
      percentage: Math.round((usage.heapUsed / usage.heapTotal) * 100)
    };
  }

  // Cleanup method
  destroy(): void {
    this.stop();
    this.measurements = [];
    this.onWarning = undefined;
    this.onCritical = undefined;
    this.onRestart = undefined;
  }
}