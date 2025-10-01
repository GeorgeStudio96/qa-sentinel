/**
 * High-Performance Form Tester
 * Tests forms in parallel using browser pool
 */

import { Page } from 'playwright';
import { createLogger } from '../../shared/logger';
import { RealSubmissionTester } from './RealSubmissionTester';
import type { FormTestResult, TestCase, FormIssue, PresetData, SubmissionResult } from './types';

const logger = createLogger('form-tester');

interface FormToTest {
  formId: string;
  formName: string;
  pageUrl: string;
  siteId: string;
  siteName: string;
  formSelector?: string;
}

export class FormTester {
  private realSubmissionTester: RealSubmissionTester;

  constructor() {
    this.realSubmissionTester = new RealSubmissionTester();
  }

  /**
   * Test a single form on a page
   */
  async testForm(
    page: Page,
    form: FormToTest,
    timeout = 10000,
    realSubmission = false,
    presetData?: PresetData,
    presetName?: string
  ): Promise<FormTestResult> {
    const startTime = Date.now();
    logger.info(`Testing form: ${form.formName} on ${form.pageUrl}`);

    try {
      // Navigate to page
      await page.goto(form.pageUrl, {
        waitUntil: 'domcontentloaded',
        timeout,
      });

      // Find form element
      const formElement = await this.findFormElement(page, form);

      if (!formElement) {
        throw new Error(`Form not found: ${form.formName}`);
      }

      // Analyze form structure
      const formAnalysis = await this.analyzeFormStructure(page, formElement);

      // Run test cases
      const testCases = await this.runTestCases(page, formElement, formAnalysis);

      // Generate issues
      const issues = this.generateIssues(formAnalysis, testCases);

      // Take screenshot
      const screenshotBuffer = await formElement.screenshot();
      const screenshot = screenshotBuffer.toString('base64');

      // Real submission if requested
      let submissionResult: SubmissionResult | undefined;
      if (realSubmission && presetData && presetName) {
        logger.info(`Performing real submission with preset: ${presetName}`);
        submissionResult = await this.realSubmissionTester.submitForm(
          page,
          presetData,
          presetName
        );
      }

      const duration = Date.now() - startTime;

      return {
        formId: form.formId,
        formName: form.formName,
        pageUrl: form.pageUrl,
        siteId: form.siteId,
        siteName: form.siteName,
        testResults: {
          hasEmailField: formAnalysis.hasEmailField,
          emailRequired: formAnalysis.emailRequired,
          canSubmitEmpty: testCases.find((tc) => tc.name === 'empty-submission')
            ?.passed || false,
          validationWorks: formAnalysis.hasValidation,
          successMessageShown:
            testCases.find((tc) => tc.name === 'valid-submission')?.passed ||
            false,
          fieldCount: formAnalysis.fieldCount,
          requiredFieldsCount: formAnalysis.requiredFieldsCount,
          testCases,
        },
        issues,
        screenshot,
        duration,
        testedAt: new Date().toISOString(),
        submissionResult,
      };
    } catch (error) {
      logger.error(`Error testing form ${form.formName}:`, error as Error);

      return {
        formId: form.formId,
        formName: form.formName,
        pageUrl: form.pageUrl,
        siteId: form.siteId,
        siteName: form.siteName,
        testResults: {
          hasEmailField: false,
          emailRequired: false,
          canSubmitEmpty: true,
          validationWorks: false,
          successMessageShown: false,
          fieldCount: 0,
          requiredFieldsCount: 0,
          testCases: [
            {
              name: 'error',
              description: 'Form testing failed',
              passed: false,
              details: error instanceof Error ? error.message : 'Unknown error',
            },
          ],
        },
        issues: [
          {
            severity: 'critical',
            category: 'testing-error',
            title: 'Form Test Failed',
            description: `Could not test form: ${error instanceof Error ? error.message : 'Unknown error'}`,
            recommendation: 'Check if form is accessible and page loads correctly',
          },
        ],
        duration: Date.now() - startTime,
        testedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Find form element on page
   */
  private async findFormElement(page: Page, form: FormToTest) {
    // Try by form ID from Webflow
    if (form.formSelector) {
      const bySelector = await page.$(form.formSelector);
      if (bySelector) return bySelector;
    }

    // Try by Webflow data attribute
    const byDataAttr = await page.$(`[data-wf-element-id="${form.formId}"]`);
    if (byDataAttr) return byDataAttr;

    // Try by form name
    const byName = await page.$(`form[name="${form.formName}"]`);
    if (byName) return byName;

    // Get first form on page as fallback
    const firstForm = await page.$('form');
    return firstForm;
  }

  /**
   * Analyze form structure
   */
  private async analyzeFormStructure(page: Page, formElement: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await page.evaluate((form: any) => {
      const inputs = Array.from(
        form.querySelectorAll('input, textarea, select')
      );

      const emailInput = inputs.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (input: any) =>
          input.getAttribute('type') === 'email' ||
          input.getAttribute('name')?.toLowerCase().includes('email')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any;

      const requiredFields = inputs.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (input: any) =>
          input.hasAttribute('required') ||
          input.getAttribute('aria-required') === 'true'
      );

      return {
        fieldCount: inputs.length,
        requiredFieldsCount: requiredFields.length,
        hasEmailField: !!emailInput,
        emailRequired: emailInput?.hasAttribute('required') || false,
        hasValidation: requiredFields.length > 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fieldTypes: inputs.map((input: any) => ({
          type: input.getAttribute('type') || input.tagName.toLowerCase(),
          name: input.getAttribute('name') || '',
          required: input.hasAttribute('required'),
        })),
      };
    }, formElement);
  }

  /**
   * Run test cases
   */
  private async runTestCases(
    page: Page,
    formElement: unknown,
    formAnalysis: { hasEmailField: boolean; requiredFieldsCount: number }
  ): Promise<TestCase[]> {
    const testCases: TestCase[] = [];

    // Test 1: Try submitting empty form
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emptySubmitBlocked = await page.evaluate((form: any) => {
        const submitButton =
          form.querySelector('button[type="submit"]') ||
          form.querySelector('input[type="submit"]');

        if (!submitButton) return false;

        // Check if form validation will block submission
        return !form.checkValidity();
      }, formElement);

      testCases.push({
        name: 'empty-submission',
        description: 'Form prevents empty submission',
        passed: emptySubmitBlocked,
        details: emptySubmitBlocked
          ? 'Form correctly prevents empty submission'
          : 'Form allows empty submission',
      });
    } catch {
      testCases.push({
        name: 'empty-submission',
        description: 'Form prevents empty submission',
        passed: false,
        details: 'Could not test empty submission',
      });
    }

    // Test 2: Check email field validation
    if (formAnalysis.hasEmailField) {
      try {
        const emailValidationWorks = await page.evaluate(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (form: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const emailInput = form.querySelector('input[type="email"]') as any;
            if (!emailInput) return false;

            // Test invalid email
            emailInput.value = 'invalid-email';
            const isInvalidBlocked = !emailInput.validity.valid;

            // Test valid email
            emailInput.value = 'test@example.com';
            const isValidAccepted = emailInput.validity.valid;

            return isInvalidBlocked && isValidAccepted;
          },
          formElement
        );

        testCases.push({
          name: 'email-validation',
          description: 'Email field validates format',
          passed: emailValidationWorks,
          details: emailValidationWorks
            ? 'Email validation works correctly'
            : 'Email validation missing or broken',
        });
      } catch {
        testCases.push({
          name: 'email-validation',
          description: 'Email field validates format',
          passed: false,
          details: 'Could not test email validation',
        });
      }
    }

    // Test 3: Check required fields
    if (formAnalysis.requiredFieldsCount > 0) {
      testCases.push({
        name: 'required-fields',
        description: 'Form has required fields',
        passed: true,
        details: `${formAnalysis.requiredFieldsCount} required field(s) found`,
      });
    } else {
      testCases.push({
        name: 'required-fields',
        description: 'Form has required fields',
        passed: false,
        details: 'No required fields found',
      });
    }

    // Test 4: Try filling and submitting form (with valid data)
    try {
      const submissionResult = await page.evaluate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (form: any) => {
          const inputs = Array.from(
            form.querySelectorAll('input, textarea')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ) as any[];

          // Fill form with test data
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inputs.forEach((input: any) => {
            const type = input.getAttribute('type') || 'text';
            switch (type) {
              case 'email':
                input.value = 'test@example.com';
                break;
              case 'tel':
                input.value = '+1234567890';
                break;
              case 'number':
                input.value = '42';
                break;
              case 'checkbox':
                input.checked = true;
                break;
              case 'radio':
                input.checked = true;
                break;
              default:
                input.value = 'Test Data';
            }
          });

          // Check if form is now valid
          return form.checkValidity();
        },
        formElement
      );

      testCases.push({
        name: 'valid-submission',
        description: 'Form accepts valid data',
        passed: submissionResult,
        details: submissionResult
          ? 'Form validation passes with valid data'
          : 'Form validation fails with valid data',
      });
    } catch {
      testCases.push({
        name: 'valid-submission',
        description: 'Form accepts valid data',
        passed: false,
        details: 'Could not test form submission',
      });
    }

    return testCases;
  }

  /**
   * Generate issues based on test results
   */
  private generateIssues(
    formAnalysis: { hasEmailField: boolean; emailRequired: boolean; fieldCount: number },
    testCases: TestCase[]
  ): FormIssue[] {
    const issues: FormIssue[] = [];

    // Check for missing email field
    if (!formAnalysis.hasEmailField) {
      issues.push({
        severity: 'warning',
        category: 'missing-fields',
        title: 'Missing Email Field',
        description: 'Form has no email field for user contact',
        recommendation: 'Add an email field to enable follow-up communication',
      });
    }

    // Check for non-required email
    if (formAnalysis.hasEmailField && !formAnalysis.emailRequired) {
      issues.push({
        severity: 'warning',
        category: 'validation',
        title: 'Email Field Not Required',
        description: 'Email field exists but is optional',
        recommendation: 'Make email field required to ensure valid contact information',
      });
    }

    // Check for no validation
    const emptySubmitTest = testCases.find((tc) => tc.name === 'empty-submission');
    if (emptySubmitTest && !emptySubmitTest.passed) {
      issues.push({
        severity: 'critical',
        category: 'validation',
        title: 'No Form Validation',
        description: 'Form can be submitted completely empty',
        recommendation: 'Add required attributes to critical fields',
      });
    }

    // Check email validation
    const emailTest = testCases.find((tc) => tc.name === 'email-validation');
    if (emailTest && !emailTest.passed) {
      issues.push({
        severity: 'warning',
        category: 'validation',
        title: 'Email Validation Not Working',
        description: 'Email field does not validate email format',
        recommendation: 'Ensure email input has type="email" attribute',
      });
    }

    // Check for too few fields
    if (formAnalysis.fieldCount < 2) {
      issues.push({
        severity: 'info',
        category: 'best-practices',
        title: 'Minimal Form',
        description: `Form has only ${formAnalysis.fieldCount} field(s)`,
        recommendation: 'Consider if form collects sufficient information',
      });
    }

    // Check for too many fields
    if (formAnalysis.fieldCount > 10) {
      issues.push({
        severity: 'info',
        category: 'best-practices',
        title: 'Complex Form',
        description: `Form has ${formAnalysis.fieldCount} fields`,
        recommendation:
          'Consider splitting into multiple steps or reducing field count',
      });
    }

    return issues;
  }
}