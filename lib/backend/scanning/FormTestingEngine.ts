import {
  FormInfo,
  FormTestResult,
  FormFieldAnalysis,
  FormSubmissionResult,
  FormScanOptions
} from '../utils/types';
import { PageManager } from '../browser-pool/PageManagerLegacy';
import { createLogger } from '../utils/logger';

const logger = createLogger('form-testing-engine');

export class FormTestingEngine {
  constructor() {}

  async testAllFormsOnPage(
    pageManager: PageManager,
    url: string,
    options?: FormScanOptions
  ): Promise<FormTestResult[]> {
    logger.info(`Starting form testing for page: ${url}`);

    try {
      // Find all forms on the page
      const forms = await pageManager.findForms();

      if (forms.length === 0) {
        logger.debug(`No forms found on page: ${url}`);
        return [];
      }

      logger.info(`Found ${forms.length} forms on page: ${url}`);

      // Test each form
      const formResults: FormTestResult[] = [];

      for (const form of forms) {
        try {
          const formResult = await this.testSingleForm(
            pageManager,
            form,
            options
          );
          formResults.push(formResult);
        } catch (error) {
          logger.error(`Failed to test form ${form.id}:`, error instanceof Error ? error : { error: String(error) });

          // Create error result for failed form
          formResults.push({
            form,
            fieldAnalysis: { validation: [], accessibility: [] },
            submissionResult: {
              success: false,
              responseStatus: 0,
              responseUrl: '',
              errors: [error instanceof Error ? error.message : 'Unknown error'],
              warnings: [],
              submissionTime: 0
            }
          });
        }
      }

      logger.info(`Completed form testing for page: ${url}. Tested ${formResults.length} forms`);
      return formResults;

    } catch (error) {
      logger.error(`Failed to test forms on page ${url}:`, error instanceof Error ? error : { error: String(error) });
      throw error;
    }
  }

  private async testSingleForm(
    pageManager: PageManager,
    form: FormInfo,
    options?: FormScanOptions
  ): Promise<FormTestResult> {
    logger.debug(`Testing form: ${form.id}`);

    try {
      // Analyze form fields
      const fieldAnalysis = await pageManager.analyzeFormFields(form.id);

      // Test form submission if enabled
      let submissionResult: FormSubmissionResult;

      const shouldSkipSubmission =
        options?.testFormSubmissions === false ||
        options?.skipFormSubmissionFor?.includes(form.id);

      if (shouldSkipSubmission) {
        logger.debug(`Skipping form submission for form: ${form.id}`);
        submissionResult = {
          success: true,
          responseStatus: 0,
          responseUrl: '',
          errors: [],
          warnings: ['Form submission test was skipped'],
          submissionTime: 0
        };
      } else {
        // Get test data for this form
        const testData = options?.formTestData?.[form.id];

        logger.debug(`Testing form submission for form: ${form.id}`);
        submissionResult = await pageManager.testFormSubmission(form.id, testData);
      }

      return {
        form,
        fieldAnalysis,
        submissionResult
      };

    } catch (error) {
      logger.error(`Failed to test form ${form.id}:`, error instanceof Error ? error : { error: String(error) });
      throw error;
    }
  }

  generateFormReport(formResults: FormTestResult[]): {
    summary: {
      totalForms: number;
      formsWithValidationIssues: number;
      formsWithAccessibilityIssues: number;
      formsWithSubmissionIssues: number;
      formsCompletelyHealthy: number;
    };
    issues: Array<{
      formId: string;
      action: string;
      issueType: 'validation' | 'accessibility' | 'submission';
      severity: 'low' | 'medium' | 'high';
      message: string;
      field?: string;
    }>;
    recommendations: string[];
  } {
    const summary = {
      totalForms: formResults.length,
      formsWithValidationIssues: 0,
      formsWithAccessibilityIssues: 0,
      formsWithSubmissionIssues: 0,
      formsCompletelyHealthy: 0
    };

    const issues: Array<{
      formId: string;
      action: string;
      issueType: 'validation' | 'accessibility' | 'submission';
      severity: 'low' | 'medium' | 'high';
      message: string;
      field?: string;
    }> = [];

    const recommendations: string[] = [];

    for (const formResult of formResults) {
      const { form, fieldAnalysis, submissionResult } = formResult;

      let hasValidationIssues = false;
      let hasAccessibilityIssues = false;
      let hasSubmissionIssues = false;

      // Check validation issues
      const invalidFields = fieldAnalysis.validation.filter(v => !v.isValid);
      if (invalidFields.length > 0) {
        hasValidationIssues = true;
        summary.formsWithValidationIssues++;

        for (const validation of invalidFields) {
          issues.push({
            formId: form.id,
            action: form.action,
            issueType: 'validation',
            severity: 'medium',
            message: validation.message,
            field: validation.field
          });
        }
      }

      // Check accessibility issues
      if (fieldAnalysis.accessibility.length > 0) {
        hasAccessibilityIssues = true;
        summary.formsWithAccessibilityIssues++;

        for (const accessibility of fieldAnalysis.accessibility) {
          issues.push({
            formId: form.id,
            action: form.action,
            issueType: 'accessibility',
            severity: accessibility.severity,
            message: accessibility.issue,
            field: accessibility.field
          });
        }
      }

      // Check submission issues
      if (!submissionResult.success || submissionResult.errors.length > 0) {
        hasSubmissionIssues = true;
        summary.formsWithSubmissionIssues++;

        const errorMessage = submissionResult.errors.length > 0
          ? submissionResult.errors.join(', ')
          : 'Form submission failed';

        issues.push({
          formId: form.id,
          action: form.action,
          issueType: 'submission',
          severity: submissionResult.responseStatus >= 500 ? 'high' : 'medium',
          message: errorMessage
        });
      }

      // Check if form is completely healthy
      if (!hasValidationIssues && !hasAccessibilityIssues && !hasSubmissionIssues) {
        summary.formsCompletelyHealthy++;
      }
    }

    // Generate recommendations
    if (summary.formsWithAccessibilityIssues > 0) {
      recommendations.push('Add proper labels and ARIA attributes to form fields for better accessibility');
    }

    if (summary.formsWithValidationIssues > 0) {
      recommendations.push('Implement proper client-side validation for required fields');
    }

    if (summary.formsWithSubmissionIssues > 0) {
      recommendations.push('Review form submission endpoints and error handling');
    }

    const highSeverityIssues = issues.filter(issue => issue.severity === 'high');
    if (highSeverityIssues.length > 0) {
      recommendations.push('Address high-severity issues immediately to prevent user experience problems');
    }

    return {
      summary,
      issues,
      recommendations
    };
  }

  identifyFormPatterns(formResults: FormTestResult[]): {
    commonPatterns: string[];
    antiPatterns: string[];
    bestPractices: string[];
  } {
    const commonPatterns: string[] = [];
    const antiPatterns: string[] = [];
    const bestPractices: string[] = [];

    const totalForms = formResults.length;
    if (totalForms === 0) return { commonPatterns, antiPatterns, bestPractices };

    // Analyze patterns
    const formsWithLabels = formResults.filter(fr =>
      fr.fieldAnalysis.accessibility.filter(a => a.issue === 'Missing label').length === 0
    ).length;

    const formsWithRequiredAttributes = formResults.filter(fr =>
      fr.form.fields.some(field => field.required)
    ).length;

    const formsWithPlaceholders = formResults.filter(fr =>
      fr.form.fields.some(field => field.placeholder)
    ).length;

    // Common patterns
    if (formsWithLabels / totalForms > 0.8) {
      commonPatterns.push('Most forms have proper labels for accessibility');
    }

    if (formsWithRequiredAttributes / totalForms > 0.6) {
      commonPatterns.push('Forms commonly use required field validation');
    }

    if (formsWithPlaceholders / totalForms > 0.7) {
      commonPatterns.push('Forms frequently use placeholder text for user guidance');
    }

    // Anti-patterns
    if (formsWithLabels / totalForms < 0.5) {
      antiPatterns.push('Many forms lack proper labels, creating accessibility issues');
    }

    const formsWithLongActions = formResults.filter(fr =>
      fr.form.action.length > 100
    ).length;
    if (formsWithLongActions / totalForms > 0.3) {
      antiPatterns.push('Forms have overly complex action URLs');
    }

    // Best practices
    if (formsWithLabels / totalForms >= 0.9) {
      bestPractices.push('Excellent form accessibility with proper labeling');
    }

    const formsWithGoodValidation = formResults.filter(fr =>
      fr.fieldAnalysis.validation.every(v => v.isValid)
    ).length;
    if (formsWithGoodValidation / totalForms >= 0.8) {
      bestPractices.push('Strong form validation implementation');
    }

    return {
      commonPatterns,
      antiPatterns,
      bestPractices
    };
  }
}