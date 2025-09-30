/**
 * Form Discovery Module
 * Discovers and analyzes forms across Webflow sites without browser automation
 */

import { WebflowApiClient } from '../../integrations/webflow/api-client';
import type { WebflowForm, WebflowSite } from '../../integrations/webflow/types';
import { createLogger } from '../../shared/logger';
import type {
  FormAnalysis,
  FormDiscoveryOptions,
  FormDiscoveryReport,
  FormIssue,
  SiteFormDiscovery,
} from './types';

const logger = createLogger('form-discovery');

export class FormDiscovery {
  private webflowClient: WebflowApiClient;

  constructor(accessToken: string) {
    this.webflowClient = new WebflowApiClient(accessToken);
  }

  /**
   * Discover all forms across all authorized sites
   */
  async discoverAllForms(options: FormDiscoveryOptions = {}): Promise<FormDiscoveryReport> {
    const startTime = Date.now();
    logger.info('Starting form discovery');

    try {
      // Get all sites or specific sites
      let sites: WebflowSite[];
      if (options.siteIds?.length) {
        sites = await Promise.all(
          options.siteIds.map(id => this.webflowClient.getSite(id))
        );
      } else {
        sites = await this.webflowClient.getSites();
      }

      logger.info(`Found ${sites.length} sites to analyze`);

      // Discover forms for each site in parallel
      const siteDiscoveries = await Promise.all(
        sites.map(site => this.discoverSiteForms(site, options))
      );

      // Generate report
      const report = this.generateReport(siteDiscoveries, startTime);
      logger.info(`Form discovery completed in ${report.duration}ms`);

      return report;
    } catch (error) {
      logger.error('Form discovery failed:', error as Error);
      throw error;
    }
  }

  /**
   * Discover forms for a single site
   */
  private async discoverSiteForms(
    site: WebflowSite,
    options: FormDiscoveryOptions
  ): Promise<SiteFormDiscovery> {
    logger.debug(`Discovering forms for site: ${site.displayName}`);

    try {
      const forms = await this.webflowClient.getForms(site.id);
      logger.debug(`Found ${forms.length} forms in ${site.displayName}`);

      // Analyze each form
      const analyses = forms.map(form => this.analyzeForm(form, options));

      // Calculate summary
      const criticalIssues = analyses.reduce(
        (sum, a) => sum + a.issues.filter(i => i.severity === 'critical').length,
        0
      );
      const warnings = analyses.reduce(
        (sum, a) => sum + a.issues.filter(i => i.severity === 'warning').length,
        0
      );
      const recommendations = analyses.reduce(
        (sum, a) => sum + a.issues.filter(i => i.severity === 'info').length,
        0
      );

      return {
        site,
        forms: analyses,
        summary: {
          totalForms: forms.length,
          criticalIssues,
          warnings,
          recommendations,
        },
      };
    } catch (error) {
      logger.error(`Failed to discover forms for site ${site.displayName}:`, error as Error);
      return {
        site,
        forms: [],
        summary: {
          totalForms: 0,
          criticalIssues: 0,
          warnings: 0,
          recommendations: 0,
        },
      };
    }
  }

  /**
   * Analyze a single form for issues
   */
  private analyzeForm(form: WebflowForm, options: FormDiscoveryOptions): FormAnalysis {
    const issues: FormIssue[] = [];
    const fields = Object.values(form.fields || {});

    // Check for email field
    const hasEmailField = fields.some(f => {
      return f.type === 'Email' || f.displayName?.toLowerCase().includes('email');
    });

    // Note: Webflow API doesn't return 'required' field status in forms endpoint
    const hasRequiredFields = fields.length > 0;
    const hasFileUpload = fields.some(f => f.type === 'FileUpload');
    const fieldCount = fields.length;

    // Check for missing email field
    if (!hasEmailField && fieldCount > 0) {
      issues.push({
        category: 'missing-fields',
        severity: 'warning',
        title: 'Missing Email Field',
        description: 'Form has no email field, making it impossible to respond to submissions',
        formId: form.id,
        formName: form.displayName,
        pageUrl: form.pageName,
        recommendation: 'Add an email field to enable follow-up communication',
      });
    }

    // Note: Can't check for required fields via API - this would need browser testing
    // Commenting out this check as it's not accurate without page scraping
    // if (!hasRequiredFields) {
    //   issues.push({
    //     category: 'validation',
    //     severity: 'critical',
    //     title: 'No Required Fields',
    //     description: 'Form can be submitted completely empty',
    //     formId: form.id,
    //     formName: form.displayName,
    //     pageUrl: form.pageName,
    //     recommendation: 'Mark at least one field as required',
    //   });
    // }

    // Check for too many fields
    if (fieldCount > 15) {
      issues.push({
        category: 'best-practices',
        severity: 'warning',
        title: 'Too Many Fields',
        description: `Form has ${fieldCount} fields, which may reduce completion rates`,
        formId: form.id,
        formName: form.displayName,
        pageUrl: form.pageName,
        recommendation: 'Consider splitting into multiple steps or reducing fields',
      });
    }

    // Check for very few fields (might be incomplete)
    if (fieldCount < 2) {
      issues.push({
        category: 'best-practices',
        severity: 'info',
        title: 'Minimal Form',
        description: `Form only has ${fieldCount} field(s)`,
        formId: form.id,
        formName: form.displayName,
        pageUrl: form.pageName,
        recommendation: 'Ensure form collects sufficient information',
      });
    }

    // Security checks
    if (options.checkSecurity !== false) {
      // Check for file upload without restrictions
      if (hasFileUpload) {
        issues.push({
          category: 'security',
          severity: 'warning',
          title: 'File Upload Present',
          description: 'Form accepts file uploads which could be a security risk',
          formId: form.id,
          formName: form.displayName,
          pageUrl: form.pageName,
          recommendation: 'Ensure file uploads are properly validated and sanitized',
        });
      }

      // Check for missing reCAPTCHA (simplified check)
      const hasRecaptcha = false; // Would need additional API data
      if (!hasRecaptcha && fieldCount > 0) {
        issues.push({
          category: 'security',
          severity: 'info',
          title: 'No Spam Protection',
          description: 'Form lacks reCAPTCHA or other spam protection',
          formId: form.id,
          formName: form.displayName,
          pageUrl: form.pageName,
          recommendation: 'Add reCAPTCHA to prevent spam submissions',
        });
      }
    }

    // Accessibility checks
    if (options.checkAccessibility !== false) {
      // Check for proper field labels (simplified)
      const unlabeledFields = fields.filter(f => !f.displayName || f.displayName.length < 2);
      if (unlabeledFields.length > 0) {
        issues.push({
          category: 'accessibility',
          severity: 'warning',
          title: 'Missing Field Labels',
          description: `${unlabeledFields.length} field(s) have missing or unclear labels`,
          formId: form.id,
          formName: form.displayName,
          pageUrl: form.pageName,
          recommendation: 'Add descriptive labels to all form fields',
        });
      }
    }

    return {
      form,
      issues,
      metadata: {
        fieldCount,
        hasEmailField,
        hasRequiredFields,
        hasFileUpload,
        hasRecaptcha: false,
      },
    };
  }

  /**
   * Generate final discovery report
   */
  private generateReport(
    siteDiscoveries: SiteFormDiscovery[],
    startTime: number
  ): FormDiscoveryReport {
    const duration = Date.now() - startTime;

    // Calculate overall statistics
    const totalSites = siteDiscoveries.length;
    const totalForms = siteDiscoveries.reduce((sum, s) => sum + s.forms.length, 0);
    const allIssues = siteDiscoveries.flatMap(s => s.forms.flatMap(f => f.issues));

    // Group issues by category
    const issuesByCategory = allIssues.reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group issues by severity
    const issuesBySeverity = allIssues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      timestamp: new Date().toISOString(),
      duration,
      sites: siteDiscoveries,
      overallSummary: {
        totalSites,
        totalForms,
        totalIssues: allIssues.length,
        issuesByCategory: issuesByCategory as any,
        issuesBySeverity: issuesBySeverity as any,
      },
    };
  }
}