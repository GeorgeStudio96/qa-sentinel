/**
 * API Request/Response Types
 * Specific to our Fastify backend, not Webflow API
 */

import { WebflowSite, WebflowPage } from './index';

/**
 * Site analysis request payload for Fastify API
 */
export interface SiteAnalysisRequest {
  siteToken: string;
  siteId?: string; // Optional if token is site-specific
  analysisOptions: {
    includePages: boolean;
    includeForms: boolean;
    includeCollections: boolean;
    performanceChecks: boolean;
    accessibilityChecks: boolean;
    seoChecks: boolean;
  };
}

/**
 * Site analysis result response from our QA engine
 */
export interface SiteAnalysisResult {
  siteInfo: WebflowSite;
  pages: WebflowPage[];
  totalPages: number;
  pageUrls?: string[];
  analysisStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  issues: {
    performance: unknown[];
    accessibility: unknown[];
    seo: unknown[];
    broken_links: unknown[];
  };
  metadata: {
    analyzedAt: string;
    duration: number;
    tokensUsed: number;
    elementsChecked?: number;
    overallStatus?: string;
  };
  options?: {
    includePages: boolean;
    includeForms: boolean;
    includeCollections: boolean;
    performanceChecks: boolean;
    accessibilityChecks: boolean;
    seoChecks: boolean;
  };
  summary?: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };
}

/**
 * Site token validation response
 */
export interface SiteTokenValidationResult {
  valid: boolean;
  siteInfo?: WebflowSite;
  error?: string;
}