import { Page } from 'playwright';

/**
 * Base interface for all QA checkers
 * Every checker must implement this interface
 */
export interface BaseChecker {
  check(): Promise<CheckerResult>;
}

/**
 * Common result structure for all checkers
 * Provides consistency across different check types
 */
export interface CheckerResult {
  type: CheckerType;
  status: 'success' | 'warning' | 'error';
  issues: Issue[];
  metadata: CheckerMetadata;
}

/**
 * Types of available checkers
 * Each checker has its own specialized logic
 */
export type CheckerType =
  | 'broken-links'
  | 'seo'
  | 'performance'
  | 'accessibility'
  | 'forms';

/**
 * Individual issue found during checking
 * Contains details about what went wrong and where
 */
export interface Issue {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  element?: ElementInfo;
  url?: string;
  suggestion?: string;
}

/**
 * Information about HTML element that caused an issue
 * Helps users locate and fix problems
 */
export interface ElementInfo {
  tagName: string;
  selector: string;
  text?: string;
  attributes?: Record<string, string>;
  position?: {
    x: number;
    y: number;
  };
}

/**
 * Metadata about the checking process
 * Provides context about how the check was performed
 */
export interface CheckerMetadata {
  checkedAt: string;
  duration: number;
  elementsChecked: number;
  url: string;
  viewport?: {
    width: number;
    height: number;
  };
}

/**
 * Configuration for broken links checker
 * Allows customization of link checking behavior
 */
export interface BrokenLinksConfig {
  maxLinksToCheck?: number; // No limit by default
  timeout?: number; // HTTP request timeout
  followRedirects?: boolean;
  checkExternalLinks?: boolean;
  ignoreFragments?: boolean; // Skip #anchor links
}

/**
 * Result of checking a single link
 * Contains status and context information
 */
export interface LinkCheckResult {
  url: string;
  status: 'ok' | 'broken' | 'empty' | 'invalid';
  httpStatus?: number;
  error?: string;
  responseTime?: number;
  redirectUrl?: string;
  element: ElementInfo;
  context: LinkContext;
}

/**
 * Context information about where the link was found
 * Helps users understand the link's purpose and location
 */
export interface LinkContext {
  section?: string; // Navigation, footer, content, etc.
  linkType: 'internal' | 'external' | 'email' | 'tel' | 'fragment';
  isEmpty: boolean; // href="" or missing href
  text: string;
  ariaLabel?: string;
}

/**
 * Configuration for SEO checker
 * Defines what SEO aspects to analyze
 */
export interface SEOConfig {
  checkMetaTags?: boolean;
  checkHeadings?: boolean;
  checkImages?: boolean;
  checkInternalLinks?: boolean;
  maxDescriptionLength?: number;
  maxTitleLength?: number;
}

/**
 * Configuration for performance checker
 * Defines performance metrics to measure
 */
export interface PerformanceConfig {
  collectMetrics?: boolean;
  checkImageOptimization?: boolean;
  checkResourceSizes?: boolean;
  timeout?: number;
}

/**
 * Configuration for accessibility checker
 * Defines accessibility rules to check
 */
export interface AccessibilityConfig {
  checkColorContrast?: boolean;
  checkAltText?: boolean;
  checkFormLabels?: boolean;
  checkKeyboardNavigation?: boolean;
  wcagLevel?: 'A' | 'AA' | 'AAA';
}

/**
 * Context object passed to all checkers
 * Provides access to page and configuration
 */
export interface CheckerContext {
  page: Page;
  url: string;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
}