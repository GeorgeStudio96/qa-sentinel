import { Browser } from 'playwright';

/**
 * Browser Pool Management Types
 */

export interface BrowserWrapper {
  id: string;
  browser: Browser;
  createdAt: number;
  lastUsed: number;
  pagesCreated: number;
  isHealthy: boolean;
  consecutiveFailures: number;
  pid?: number;
}

export interface BrowserPoolConfig {
  minPoolSize: number;
  maxPoolSize: number;
  warmupSize: number;
  maxBrowserAge: number;
  maxPagesPerBrowser: number;
  idleTimeout: number;
  healthCheckInterval: number;
  maxConsecutiveFailures: number;
  memoryLimitMB: number;
  cpuThreshold: number;
}

export interface BrowserPoolStats {
  created: number;
  destroyed: number;
  acquired: number;
  released: number;
  healthChecksFailed: number;
  memoryKills: number;
  timeoutKills: number;
}

export interface BrowserHealth {
  lastHealthCheck: number;
  memoryUsage: number;
  cpuUsage: number;
  responseTime: number;
}

export interface AcquiredBrowser {
  browser: Browser;
  id: string;
  release: () => Promise<void>;
}

/**
 * Page Manager Types
 */

export interface PageManagerConfig {
  maxPagesPerBrowser: number;
  pageTimeout: number;
  maxPageAge: number;
}

export interface PageStats {
  created: number;
  destroyed: number;
  errors: number;
}

/**
 * Memory Monitor Types
 */

export interface MemoryThresholds {
  warning: number;
  critical: number;
  restart: number;
}

export interface MemoryMeasurement {
  timestamp: number;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

export interface MemoryReport {
  current: {
    rss: string;
    heapUsed: string;
    heapTotal: string;
    external: string;
  };
  trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';
  thresholds: {
    warning: string;
    critical: string;
    restart: string;
  };
}

/**
 * Health Check Types
 */

export interface HealthCheckResult {
  name: string;
  passed: boolean;
  error?: string;
  responseTime?: number;
  memoryUsage?: number;
  memoryLimit?: number;
  pageCount?: number;
  maxPages?: number;
  pid?: number;
  note?: string;
}

export interface BrowserHealthReport {
  overall: boolean;
  checks: HealthCheckResult[];
  timestamp: number;
}

/**
 * Scanning Types
 */

export interface ScanRequest {
  url: string;
  options?: ScanOptions;
}

export interface ScanOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
  blockResources?: string[];
}

export interface ScanResult {
  url: string;
  success: boolean;
  timestamp: number;
  duration: number;
  screenshot?: Buffer;
  metrics?: PerformanceMetrics;
  errors?: string[];
}

export interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  timeToInteractive?: number;
}

export interface AccessibilityResult {
  violations: Array<{
    id: string;
    description: string;
    impact: string;
    nodes: number;
  }>;
  passes: number;
}

export interface BrokenLinksResult {
  url: string;
  status: number;
  text: string;
}

/**
 * Error Types
 */

export class BrowserPoolError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'BrowserPoolError';
  }
}

export class MemoryLimitError extends Error {
  constructor(
    message: string,
    public currentUsage: number,
    public limit: number
  ) {
    super(message);
    this.name = 'MemoryLimitError';
  }
}

export class BrowserTimeoutError extends Error {
  constructor(message: string, public timeout: number) {
    super(message);
    this.name = 'BrowserTimeoutError';
  }
}