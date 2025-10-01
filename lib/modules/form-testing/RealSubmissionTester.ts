/**
 * Real Submission Tester
 * Handles actual form submissions with realistic data using stealth + human behavior
 */

import type { Page } from 'playwright';
import { createLogger } from '../../shared/logger';
import { RateLimitHandler } from './RateLimitHandler';
import { HumanBehavior } from './HumanBehavior';
// import { TurnstileSolver } from './TurnstileSolver'; // Uncomment when 2Captcha API key is added
import type { PresetData, SubmissionResult } from './types';

const logger = createLogger('real-submission-tester');

export class RealSubmissionTester {
  private humanBehavior: HumanBehavior;
  // private turnstileSolver?: TurnstileSolver; // Uncomment when 2Captcha API key is added

  constructor() {
    this.humanBehavior = new HumanBehavior();

    // Initialize 2Captcha solver if API key is provided
    // const apiKey = process.env.TWOCAPTCHA_API_KEY;
    // if (apiKey) {
    //   this.turnstileSolver = new TurnstileSolver(apiKey);
    //   logger.info('✅ 2Captcha solver initialized');
    // } else {
    //   logger.info('ℹ️ 2Captcha not configured (stealth-only mode)');
    // }
  }
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
        await this.fillField(page, field, value, fieldType);
        filledCount++;

        // Human-like delay between fields
        if (filledCount < fields.length) {
          await this.humanBehavior.fieldDelay();
        }
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
   * Fill individual field with human-like behavior
   */
  private async fillField(
    page: Page,
    field: any,
    value: string,
    fieldType?: string | null
  ): Promise<void> {
    try {
      if (fieldType === 'checkbox' || fieldType === 'radio') {
        // Human-like click for checkbox/radio
        await this.humanBehavior.humanClick(page, field);
      } else {
        // Clear field first
        await field.clear();
        // Type with human-like behavior (random delays, occasional typos)
        await this.humanBehavior.humanType(page, field, value);
      }
    } catch (error) {
      logger.warn('Failed to fill field:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Perform actual form submission with stealth + 2Captcha fallback
   */
  private async performSubmission(page: Page): Promise<Partial<SubmissionResult>> {
    // Attempt #1: Try stealth submission with human behavior
    const stealthResult = await this.tryStealthSubmission(page);

    if (stealthResult.success) {
      logger.info('✅ Form submitted successfully via STEALTH (FREE)');
      return stealthResult.data;
    }

    // If stealth failed, try 2Captcha fallback (if configured)
    // if (this.turnstileSolver) {
    //   logger.warn('⚠️ Stealth submission failed, trying 2Captcha fallback...');
    //   try {
    //     const captchaResult = await this.try2CaptchaSubmission(page);
    //     logger.info('✅ Form submitted successfully via 2CAPTCHA ($0.003)');
    //     return captchaResult;
    //   } catch (captchaError) {
    //     logger.error('❌ 2Captcha fallback also failed:', captchaError);
    //     throw captchaError;
    //   }
    // }

    // No 2Captcha configured and stealth failed
    logger.error('❌ Stealth submission failed and 2Captcha is not configured');
    logger.error('💡 To enable 2Captcha fallback: Add TWOCAPTCHA_API_KEY to .env.local');
    throw new Error(
      'Cloudflare Turnstile blocked submission. Enable 2Captcha to bypass (uncomment code in RealSubmissionTester.ts)'
    );
  }

  /**
   * Try submitting form with stealth + human behavior
   */
  private async tryStealthSubmission(page: Page): Promise<{
    success: boolean;
    data?: Partial<SubmissionResult>;
  }> {
    try {
      // Find submit button
      const submitButton = await this.findSubmitButton(page);

      if (!submitButton) {
        throw new Error('Submit button not found');
      }

      logger.info('Clicking submit button with human-like behavior...');

      // Human-like click on submit button
      await this.humanBehavior.humanClick(page, submitButton);

      // Wait for response
      let postUrl: string | undefined;
      let postStatus: number | undefined;

      try {
        const response = await page.waitForResponse(
          (res) => res.request().method() === 'POST',
          { timeout: 10000 }
        );

        postStatus = response.status();
        postUrl = response.url();
        logger.info(`POST request sent to: ${postUrl}, status: ${postStatus}`);

        if (RateLimitHandler.isRateLimited(postStatus)) {
          throw { statusCode: postStatus, message: 'Rate limited' };
        }
      } catch (error) {
        logger.warn('No POST response detected, checking for Webflow messages...');
      }

      // Wait for Webflow form response messages
      await page.waitForTimeout(3000);

      const successMessage = await page
        .locator('.w-form-done')
        .isVisible()
        .catch(() => false);
      const errorMessage = await page
        .locator('.w-form-fail')
        .isVisible()
        .catch(() => false);

      // Check if POST went to Cloudflare challenges (blocked)
      const isCloudflareBlocked = postUrl?.includes('challenges.cloudflare.com');

      if (isCloudflareBlocked) {
        logger.warn('🚫 Cloudflare Turnstile detected - submission blocked');
        return { success: false };
      }

      if (successMessage) {
        const successText = await page
          .locator('.w-form-done')
          .textContent()
          .catch(() => 'Success');
        logger.info(`✅ Webflow success message: "${successText}"`);
        return {
          success: true,
          data: {
            responseStatus: postStatus || 200,
            rateLimited: false,
            webflowSuccess: true,
          },
        };
      }

      if (errorMessage) {
        const errorText = await page
          .locator('.w-form-fail')
          .textContent()
          .catch(() => 'Unknown error');
        logger.error(`❌ Webflow error message: "${errorText}"`);
        throw new Error(`Form submission failed: ${errorText}`);
      }

      // No clear success/failure indicator
      logger.warn(
        '⚠️ No Webflow success/error message found. Assuming Cloudflare blocked.'
      );
      return { success: false };
    } catch (error: any) {
      logger.error('Stealth submission error:', error);
      return { success: false };
    }
  }

  /**
   * Try submitting form with 2Captcha solver
   * This entire method is commented out until 2Captcha API key is provided
   */
  // private async try2CaptchaSubmission(page: Page): Promise<Partial<SubmissionResult>> {
  //   try {
  //     // Step 1: Detect Turnstile on the page
  //     const turnstileInfo = await TurnstileSolver.detectTurnstile(page);
  //
  //     if (!turnstileInfo.present) {
  //       throw new Error('Turnstile not detected on page');
  //     }
  //
  //     if (!turnstileInfo.sitekey) {
  //       throw new Error('Could not extract Turnstile sitekey');
  //     }
  //
  //     logger.info(`Detected Turnstile with sitekey: ${turnstileInfo.sitekey.substring(0, 20)}...`);
  //
  //     // Step 2: Solve Turnstile using 2Captcha
  //     const token = await this.turnstileSolver!.solve(
  //       turnstileInfo.sitekey,
  //       page.url()
  //     );
  //
  //     // Step 3: Inject solved token into form
  //     await TurnstileSolver.injectToken(page, token);
  //     logger.info('Token injected, submitting form...');
  //
  //     // Step 4: Submit form normally
  //     const submitButton = await this.findSubmitButton(page);
  //     if (!submitButton) {
  //       throw new Error('Submit button not found after solving captcha');
  //     }
  //
  //     await submitButton.click();
  //
  //     // Step 5: Wait for success message
  //     await page.waitForTimeout(3000);
  //
  //     const successMessage = await page
  //       .locator('.w-form-done')
  //       .isVisible()
  //       .catch(() => false);
  //
  //     if (successMessage) {
  //       const successText = await page
  //         .locator('.w-form-done')
  //         .textContent()
  //         .catch(() => 'Success');
  //       logger.info(`✅ Success after 2Captcha: "${successText}"`);
  //       return {
  //         responseStatus: 200,
  //         rateLimited: false,
  //         webflowSuccess: true,
  //       };
  //     }
  //
  //     throw new Error('No success message after 2Captcha submission');
  //   } catch (error: any) {
  //     logger.error('2Captcha submission failed:', error);
  //     throw error;
  //   }
  // }

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
