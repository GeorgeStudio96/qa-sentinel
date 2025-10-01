/**
 * Turnstile Solver - 2Captcha Integration
 *
 * This file contains the complete implementation for solving Cloudflare Turnstile
 * CAPTCHAs using the 2Captcha service. The entire implementation is commented out
 * until you add your TWOCAPTCHA_API_KEY to .env.local
 *
 * To activate:
 * 1. Sign up at https://2captcha.com
 * 2. Add at least $3 to your balance
 * 3. Get your API key
 * 4. Uncomment all code in this file
 * 5. Add TWOCAPTCHA_API_KEY=your_key to .env.local
 *
 * Cost: ~$3 per 1000 Turnstile solves = $0.003 per form submission
 */

// import axios from 'axios';
// import type { Page } from 'playwright';
// import { createLogger } from '../../shared/logger';

// const logger = createLogger('turnstile-solver');

// /**
//  * 2Captcha API endpoints
//  */
// const TWOCAPTCHA_IN_URL = 'https://2captcha.com/in.php';
// const TWOCAPTCHA_RES_URL = 'https://2captcha.com/res.php';

// /**
//  * Turnstile Solver using 2Captcha service
//  */
// export class TurnstileSolver {
//   private apiKey: string;

//   constructor(apiKey: string) {
//     this.apiKey = apiKey;
//   }

//   /**
//    * Solve Cloudflare Turnstile CAPTCHA
//    *
//    * @param sitekey - Turnstile sitekey from the page
//    * @param pageUrl - URL of the page with Turnstile
//    * @returns Promise<string> - Solved token to inject into form
//    */
//   async solve(sitekey: string, pageUrl: string): Promise<string> {
//     logger.info(`Solving Turnstile for sitekey: ${sitekey.substring(0, 20)}...`);

//     try {
//       // Step 1: Submit task to 2Captcha
//       const taskId = await this.submitTask(sitekey, pageUrl);
//       logger.info(`Task submitted to 2Captcha, ID: ${taskId}`);

//       // Step 2: Poll for result (usually takes 10-30 seconds)
//       const token = await this.pollResult(taskId);
//       logger.info('✅ Turnstile solved successfully');

//       return token;
//     } catch (error) {
//       logger.error('Failed to solve Turnstile:', error);
//       throw error;
//     }
//   }

//   /**
//    * Submit Turnstile solving task to 2Captcha
//    */
//   private async submitTask(sitekey: string, pageUrl: string): Promise<string> {
//     try {
//       const response = await axios.post(
//         TWOCAPTCHA_IN_URL,
//         null,
//         {
//           params: {
//             key: this.apiKey,
//             method: 'turnstile',
//             sitekey,
//             pageurl: pageUrl,
//             json: 1,
//           },
//           timeout: 10000,
//         }
//       );

//       if (response.data.status !== 1) {
//         throw new Error(`2Captcha task submission failed: ${response.data.request}`);
//       }

//       return response.data.request;
//     } catch (error: any) {
//       if (error.response?.data) {
//         throw new Error(`2Captcha API error: ${JSON.stringify(error.response.data)}`);
//       }
//       throw error;
//     }
//   }

//   /**
//    * Poll 2Captcha for result
//    * Retries every 3 seconds for up to 60 seconds
//    */
//   private async pollResult(taskId: string): Promise<string> {
//     const maxAttempts = 20; // 20 * 3 sec = 60 seconds max
//     const pollInterval = 3000; // 3 seconds

//     for (let attempt = 1; attempt <= maxAttempts; attempt++) {
//       // Wait before polling (2Captcha recommends waiting before first request)
//       await new Promise((resolve) => setTimeout(resolve, pollInterval));

//       try {
//         const response = await axios.get(TWOCAPTCHA_RES_URL, {
//           params: {
//             key: this.apiKey,
//             action: 'get',
//             id: taskId,
//             json: 1,
//           },
//           timeout: 10000,
//         });

//         // Success - got the token
//         if (response.data.status === 1) {
//           return response.data.request;
//         }

//         // Still processing
//         if (response.data.request === 'CAPCHA_NOT_READY') {
//           logger.debug(`Waiting for solution... (${attempt}/${maxAttempts})`);
//           continue;
//         }

//         // Error from 2Captcha
//         throw new Error(`2Captcha error: ${response.data.request}`);
//       } catch (error: any) {
//         if (error.message?.includes('2Captcha error')) {
//           throw error;
//         }
//         logger.warn(`Polling attempt ${attempt} failed:`, error.message);
//       }
//     }

//     throw new Error('Turnstile solving timeout (60 seconds)');
//   }

//   /**
//    * Detect if page has Cloudflare Turnstile
//    *
//    * @returns Object with `present` boolean and optional `sitekey`
//    */
//   static async detectTurnstile(page: Page): Promise<{
//     present: boolean;
//     sitekey?: string;
//   }> {
//     try {
//       // Method 1: Look for Turnstile iframe
//       const iframe = await page
//         .locator('iframe[src*="challenges.cloudflare.com"]')
//         .first()
//         .isVisible()
//         .catch(() => false);

//       if (iframe) {
//         const sitekey = await this.extractSitekeyFromIframe(page);
//         return { present: true, sitekey };
//       }

//       // Method 2: Look for Turnstile widget div
//       const widget = await page
//         .locator('[data-sitekey]')
//         .first()
//         .isVisible()
//         .catch(() => false);

//       if (widget) {
//         const sitekey = await page
//           .locator('[data-sitekey]')
//           .first()
//           .getAttribute('data-sitekey');
//         return { present: true, sitekey: sitekey || undefined };
//       }

//       return { present: false };
//     } catch (error) {
//       logger.warn('Error detecting Turnstile:', error);
//       return { present: false };
//     }
//   }

//   /**
//    * Extract sitekey from Turnstile iframe
//    */
//   private static async extractSitekeyFromIframe(page: Page): Promise<string | undefined> {
//     try {
//       const iframe = page.locator('iframe[src*="challenges.cloudflare.com"]').first();
//       const src = await iframe.getAttribute('src');

//       if (!src) return undefined;

//       // Extract sitekey from iframe src URL
//       const match = src.match(/sitekey=([a-zA-Z0-9_-]+)/);
//       return match ? match[1] : undefined;
//     } catch (error) {
//       logger.warn('Failed to extract sitekey from iframe:', error);
//       return undefined;
//     }
//   }

//   /**
//    * Inject solved token into Turnstile hidden field
//    *
//    * @param page - Playwright page
//    * @param token - Solved token from 2Captcha
//    */
//   static async injectToken(page: Page, token: string): Promise<void> {
//     try {
//       // Turnstile creates a hidden input field with the token
//       const injected = await page.evaluate((solvedToken) => {
//         // Look for cf-turnstile-response input
//         const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;

//         if (responseInput) {
//           responseInput.value = solvedToken;
//           return true;
//         }

//         // Alternative: look for any hidden input in form with Turnstile
//         const turnstileDiv = document.querySelector('[data-sitekey]');
//         if (turnstileDiv) {
//           const form = turnstileDiv.closest('form');
//           if (form) {
//             const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
//             for (const input of hiddenInputs) {
//               if ((input as HTMLInputElement).name.includes('turnstile') ||
//                   (input as HTMLInputElement).name.includes('cf-')) {
//                 (input as HTMLInputElement).value = solvedToken;
//                 return true;
//               }
//             }
//           }
//         }

//         return false;
//       }, token);

//       if (!injected) {
//         logger.warn('Could not find Turnstile response field to inject token');
//       } else {
//         logger.info('✅ Token injected successfully');
//       }
//     } catch (error) {
//       logger.error('Failed to inject token:', error);
//       throw error;
//     }
//   }

//   /**
//    * Check if 2Captcha solver is configured
//    */
//   static isConfigured(): boolean {
//     return !!process.env.TWOCAPTCHA_API_KEY;
//   }
// }
