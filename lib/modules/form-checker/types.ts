/**
 * Form Checker Module Types
 */

import type { WebflowForm, WebflowSite } from '../../integrations/webflow/types';

/**
 * Form issue severity levels
 */
export type IssueSeverity = 'critical' | 'warning' | 'info';

/**
 * Form issue categories
 */
export type IssueCategory =
  | 'missing-fields'
  | 'validation'
  | 'accessibility'
  | 'performance'
  | 'security'
  | 'best-practices';

/**
 * Individual form issue
 */
export interface FormIssue {
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  formId: string;
  formName: string;
  pageUrl?: string;
  recommendation?: string;
}

/**
 * Form analysis result for a single form
 */
export interface FormAnalysis {
  form: WebflowForm;
  issues: FormIssue[];
  metadata: {
    fieldCount: number;
    hasEmailField: boolean;
    hasRequiredFields: boolean;
    hasFileUpload: boolean;
    hasRecaptcha: boolean;
  };
}

/**
 * Site form discovery result
 */
export interface SiteFormDiscovery {
  site: WebflowSite;
  forms: FormAnalysis[];
  summary: {
    totalForms: number;
    criticalIssues: number;
    warnings: number;
    recommendations: number;
  };
}

/**
 * Complete discovery report
 */
export interface FormDiscoveryReport {
  timestamp: string;
  duration: number;
  sites: SiteFormDiscovery[];
  overallSummary: {
    totalSites: number;
    totalForms: number;
    totalIssues: number;
    issuesByCategory: Record<IssueCategory, number>;
    issuesBySeverity: Record<IssueSeverity, number>;
  };
}

/**
 * Discovery options
 */
export interface FormDiscoveryOptions {
  siteIds?: string[];  // Specific sites to check
  skipValidation?: boolean;
  includeRecommendations?: boolean;
  checkAccessibility?: boolean;
  checkSecurity?: boolean;
}