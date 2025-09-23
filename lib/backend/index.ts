// Core Engine Exports
export { QAScanningEngine } from './scanning';

// Browser Pool Management
export { BrowserPoolManager, PageManager } from './browser-pool';

// Monitoring
export { MemoryMonitor } from './monitoring';

// Utils and Types
export { logger, createLogger } from './utils';
export type {
  ScanRequest,
  ScanResult,
  BrowserPoolConfig,
  MemoryThresholds,
  PerformanceMetrics,
  ScanOptions
} from './utils/types';