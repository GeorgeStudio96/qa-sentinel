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
 * Form Analysis Types
 */

export interface FormField {
  name: string;
  type: string;
  required: boolean;
  label: string;
  placeholder: string;
  options?: string[];
}

export interface FormSubmitButton {
  text: string;
  type: string;
}

export interface FormInfo {
  id: string;
  action: string;
  method: string;
  fields: FormField[];
  submitButtons: FormSubmitButton[];
}

export interface FormValidation {
  field: string;
  validationType: string;
  isValid: boolean;
  message: string;
}

export interface FormAccessibilityIssue {
  field: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
}

export interface FormFieldAnalysis {
  validation: FormValidation[];
  accessibility: FormAccessibilityIssue[];
}

export interface FormSubmissionResult {
  success: boolean;
  responseStatus: number;
  responseUrl: string;
  errors: string[];
  warnings: string[];
  submissionTime: number;
}

export interface FormTestResult {
  form: FormInfo;
  fieldAnalysis: FormFieldAnalysis;
  submissionResult: FormSubmissionResult;
}

/**
 * Multi-Page Scanning Types
 */

export interface InternalLink {
  url: string;
  text: string;
  isInternal: boolean;
}

export interface PageScanResult {
  url: string;
  success: boolean;
  timestamp: number;
  duration: number;
  forms: FormTestResult[];
  screenshot?: Buffer;
  metrics?: PerformanceMetrics;
  accessibility?: AccessibilityResult;
  brokenLinks?: BrokenLinksResult[];
  errors?: string[];
}

export interface MultiPageScanResult {
  mainUrl: string;
  pages: PageScanResult[];
  summary: {
    totalPages: number;
    successfulPages: number;
    totalForms: number;
    formsWithIssues: number;
    totalDuration: number;
  };
  timestamp: number;
}

/**
 * Enhanced Scan Options for Form Testing
 */

export interface FormScanOptions extends ScanOptions {
  maxPages?: number;
  testFormSubmissions?: boolean;
  formTestData?: Record<string, Record<string, string>>; // formId -> fieldName -> value
  skipFormSubmissionFor?: string[]; // form IDs to skip submission testing
}

export interface EnhancedScanRequest {
  url: string;
  options?: FormScanOptions;
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