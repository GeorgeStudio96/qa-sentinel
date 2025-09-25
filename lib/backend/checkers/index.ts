/**
 * QA Checkers Module Index
 *
 * This file exports all QA checker modules in a clean, organized way.
 * Each checker is a specialized, isolated module that performs specific
 * quality assurance checks on web pages.
 *
 * Usage for developers:
 * 1. Import the checker you need: import { BrokenLinksChecker } from './checkers'
 * 2. Create an instance with context and config
 * 3. Call the check() method to get results
 * 4. Process the issues array for display/reporting
 */

// Export all checker classes
export { BrokenLinksChecker } from './BrokenLinksChecker';
export { SEOChecker } from './SEOChecker';
export { PerformanceChecker } from './PerformanceChecker';
export { AccessibilityChecker } from './AccessibilityChecker';

// Export all types and interfaces
export type {
  BaseChecker,
  CheckerResult,
  CheckerType,
  CheckerContext,
  Issue,
  ElementInfo,
  CheckerMetadata,
  BrokenLinksConfig,
  LinkCheckResult,
  LinkContext,
  SEOConfig,
  PerformanceConfig,
  AccessibilityConfig
} from './types';

/**
 * Factory function to create all checkers at once
 * Useful for running comprehensive QA analysis
 *
 * Example usage:
 * ```typescript
 * const context: CheckerContext = { page, url: 'https://example.com' };
 * const checkers = createAllCheckers(context);
 *
 * const results = await Promise.all(
 *   checkers.map(checker => checker.check())
 * );
 * ```
 */
export function createAllCheckers(
  context: CheckerContext,
  configs?: {
    brokenLinks?: BrokenLinksConfig;
    seo?: SEOConfig;
    performance?: PerformanceConfig;
    accessibility?: AccessibilityConfig;
  }
): BaseChecker[] {
  return [
    new BrokenLinksChecker(context, configs?.brokenLinks),
    new SEOChecker(context, configs?.seo),
    new PerformanceChecker(context, configs?.performance),
    new AccessibilityChecker(context, configs?.accessibility)
  ];
}

/**
 * Factory function to create specific checker by type
 * Provides type-safe way to create individual checkers
 *
 * Example usage:
 * ```typescript
 * const checker = createChecker('broken-links', context, config);
 * const result = await checker.check();
 * ```
 */
export function createChecker(
  type: CheckerType,
  context: CheckerContext,
  config?: any
): BaseChecker {
  switch (type) {
    case 'broken-links':
      return new BrokenLinksChecker(context, config);
    case 'seo':
      return new SEOChecker(context, config);
    case 'performance':
      return new PerformanceChecker(context, config);
    case 'accessibility':
      return new AccessibilityChecker(context, config);
    default:
      throw new Error(`Unknown checker type: ${type}`);
  }
}

/**
 * Utility function to run all checkers and combine results
 * Returns aggregated report with all issues organized by type
 *
 * Example usage:
 * ```typescript
 * const report = await runAllCheckers(context);
 * console.log(`Total issues found: ${report.totalIssues}`);
 * ```
 */
export async function runAllCheckers(
  context: CheckerContext,
  configs?: {
    brokenLinks?: BrokenLinksConfig;
    seo?: SEOConfig;
    performance?: PerformanceConfig;
    accessibility?: AccessibilityConfig;
  }
): Promise<{
  results: CheckerResult[];
  totalIssues: number;
  issuesBySeverity: Record<string, number>;
  issuesByType: Record<CheckerType, Issue[]>;
  overallStatus: 'success' | 'warning' | 'error';
}> {
  const checkers = createAllCheckers(context, configs);
  const results = await Promise.all(
    checkers.map(checker => checker.check())
  );

  // Aggregate statistics
  const allIssues = results.flatMap(result => result.issues);
  const totalIssues = allIssues.length;

  // Count issues by severity
  const issuesBySeverity = allIssues.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Organize issues by checker type
  const issuesByType = results.reduce((acc, result) => {
    acc[result.type] = result.issues;
    return acc;
  }, {} as Record<CheckerType, Issue[]>);

  // Determine overall status
  const overallStatus = determineOverallStatus(results);

  return {
    results,
    totalIssues,
    issuesBySeverity,
    issuesByType,
    overallStatus
  };
}

/**
 * Helper function to determine overall status from all checker results
 * Returns the most severe status found across all checkers
 */
function determineOverallStatus(results: CheckerResult[]): 'success' | 'warning' | 'error' {
  if (results.some(result => result.status === 'error')) {
    return 'error';
  }
  if (results.some(result => result.status === 'warning')) {
    return 'warning';
  }
  return 'success';
}

// Re-export types for convenience
import type {
  BaseChecker,
  CheckerResult,
  CheckerType,
  CheckerContext,
  Issue,
  ElementInfo,
  CheckerMetadata,
  BrokenLinksConfig,
  LinkCheckResult,
  LinkContext,
  SEOConfig,
  PerformanceConfig,
  AccessibilityConfig
} from './types';