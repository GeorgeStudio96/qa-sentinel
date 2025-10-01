/**
 * Real Submission Tester
 * Handles actual form submissions with realistic data
 */

import type { Page } from 'playwright';
import { createLogger } from '../../shared/logger';
import { RateLimitHandler } from './RateLimitHandler';
import type { PresetData, SubmissionResult } from './types';

const logger = createLogger('real-submission-tester');

export class RealSubmissionTester {
  /**
   * Submit form with preset data
   */
  async submitForm(
    page: Page,
    presetData: PresetData,
    presetName: string
  ): Promise<SubmissionResult> {
    const startTime = Date.now();

    try {
      logger.info(`Submitting form with preset: ${presetName}`);

      // Fill form fields
      await this.fillFormFields(page, presetData);

      // Submit the form with rate limit handling
      const submissionResult = await RateLimitHandler.withRateLimitHandling(
        async () => {
          return await this.performSubmission(page);
        },
        3 // max 3 retries
      );

      const duration = Date.now() - startTime;
      logger.info(`Form submitted successfully in ${duration}ms`);

      return {
        submitted: true,
        presetUsed: presetName,
        ...submissionResult,
      };
    } catch (error) {
      logger.error('Form submission failed:', error as Error);

      return {
        submitted: false,
        presetUsed: presetName,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fill form fields with preset data
   */
  private async fillFormFields(
    page: Page,
    presetData: PresetData
  ): Promise<void> {
    // Find all input fields, textareas, and selects
    const fields = await page.locator('input, textarea, select').all();

    logger.info(`Found ${fields.length} total fields on the page`);

    let filledCount = 0;
    let skippedCount = 0;
    let unmatchedCount = 0;

    for (const field of fields) {
      const fieldType = await field.getAttribute('type');
      const fieldName = await field.getAttribute('name');
      const fieldId = await field.getAttribute('id');
      const placeholder = await field.getAttribute('placeholder');

      // Skip hidden, submit, and button fields
      if (
        fieldType === 'hidden' ||
        fieldType === 'submit' ||
        fieldType === 'button'
      ) {
        skippedCount++;
        continue;
      }

      // Log field details
      logger.info(`Field: type="${fieldType}" name="${fieldName}" id="${fieldId}" placeholder="${placeholder}"`);

      // Match field to preset data
      const value = this.matchFieldToData(
        presetData,
        fieldName,
        fieldId,
        placeholder,
        fieldType
      );

      if (value) {
        logger.info(`✅ Matched field to value: "${value.substring(0, 30)}..."`);
        await this.fillField(field, value, fieldType);
        filledCount++;
      } else {
        logger.warn(`❌ No match found for field: name="${fieldName}" id="${fieldId}" placeholder="${placeholder}"`);
        unmatchedCount++;
      }
    }

    logger.info(`Field filling summary: ${filledCount} filled, ${skippedCount} skipped, ${unmatchedCount} unmatched`);
  }

  /**
   * Match field to appropriate preset data
   */
  private matchFieldToData(
    presetData: PresetData,
    name?: string | null,
    id?: string | null,
    placeholder?: string | null,
    type?: string | null
  ): string | undefined {
    const identifiers = [name, id, placeholder]
      .filter(Boolean)
      .map((s) => s?.toLowerCase());

    // Match email fields
    if (
      type === 'email' ||
      identifiers.some((s) => s?.includes('email') || s?.includes('e-mail'))
    ) {
      return presetData.email;
    }

    // Match phone fields
    if (
      type === 'tel' ||
      identifiers.some((s) => s?.includes('phone') || s?.includes('tel'))
    ) {
      return presetData.phone;
    }

    // Match name fields
    if (identifiers.some((s) => s?.includes('name') && !s?.includes('company'))) {
      return presetData.name;
    }

    // Match company fields
    if (identifiers.some((s) => s?.includes('company') || s?.includes('organization'))) {
      return presetData.company;
    }

    // Match message/comment fields
    if (identifiers.some((s) => s?.includes('message') || s?.includes('comment') || s?.includes('description'))) {
      return presetData.message;
    }

    // Try to match with custom fields from preset
    for (const key of Object.keys(presetData)) {
      if (identifiers.some((s) => s?.includes(key.toLowerCase()))) {
        return presetData[key];
      }
    }

    return undefined;
  }

  /**
   * Fill individual field
   */
  private async fillField(
    field: any,
    value: string,
    fieldType?: string | null
  ): Promise<void> {
    try {
      if (fieldType === 'checkbox' || fieldType === 'radio') {
        await field.check();
      } else {
        await field.clear();
        await field.fill(value);
      }
    } catch (error) {
      logger.warn('Failed to fill field:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Perform actual form submission
   */
  private async performSubmission(page: Page): Promise<Partial<SubmissionResult>> {
    // Find submit button
    const submitButton = await this.findSubmitButton(page);

    if (!submitButton) {
      throw new Error('Submit button not found');
    }

    logger.info('Clicking submit button...');

    // Click submit and wait for response
    try {
      const [response] = await Promise.all([
        page.waitForResponse((res) => res.request().method() === 'POST', {
          timeout: 10000,
        }),
        submitButton.click({ force: true }),
      ]);

      // Log response details
      const status = response.status();
      const url = response.url();
      logger.info(`POST request sent to: ${url}, status: ${status}`);

      if (RateLimitHandler.isRateLimited(status)) {
        throw { statusCode: status, message: 'Rate limited' };
      }

      // Wait for Webflow form response messages
      await page.waitForTimeout(2000);

      const successMessage = await page.locator('.w-form-done').isVisible().catch(() => false);
      const errorMessage = await page.locator('.w-form-fail').isVisible().catch(() => false);

      if (successMessage) {
        const successText = await page.locator('.w-form-done').textContent().catch(() => 'Success');
        logger.info(`✅ Webflow success message: "${successText}"`);
        return {
          responseStatus: status,
          rateLimited: false,
          webflowSuccess: true,
        };
      }

      if (errorMessage) {
        const errorText = await page.locator('.w-form-fail').textContent().catch(() => 'Unknown error');
        logger.error(`❌ Webflow error message: "${errorText}"`);
        throw new Error(`Form submission failed: ${errorText}`);
      }

      // No success/error message - log warning
      logger.warn('⚠️ No Webflow success/error message found after submit. Form may not have been submitted to Webflow.');

      return {
        responseStatus: status,
        rateLimited: false,
        webflowSuccess: false,
      };
    } catch (error: any) {
      // If button became disabled during submission, check for messages
      await page.waitForTimeout(2000);

      const successMessage = await page.locator('.w-form-done').isVisible().catch(() => false);
      const errorMessage = await page.locator('.w-form-fail').isVisible().catch(() => false);

      if (successMessage) {
        const successText = await page.locator('.w-form-done').textContent().catch(() => 'Success');
        logger.info(`✅ Webflow success message (fallback): "${successText}"`);
        return {
          responseStatus: 200,
          rateLimited: false,
          webflowSuccess: true,
        };
      }

      if (errorMessage) {
        const errorText = await page.locator('.w-form-fail').textContent().catch(() => 'Unknown error');
        logger.error(`❌ Webflow error message (fallback): "${errorText}"`);
        throw new Error(`Form submission failed: ${errorText}`);
      }

      // Re-throw the original error
      logger.error('Form submission error:', error);
      throw error;
    }
  }

  /**
   * Find submit button in form
   */
  private async findSubmitButton(page: Page): Promise<any> {
    // Try different selectors for submit button
    const selectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Send")',
      'button:has-text("Get Started")',
      'button:has-text("Contact")',
    ];

    for (const selector of selectors) {
      const button = page.locator(selector).first();
      if (await button.isVisible().catch(() => false)) {
        return button;
      }
    }

    return null;
  }
}
