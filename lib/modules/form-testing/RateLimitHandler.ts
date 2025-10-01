/**
 * Rate Limit Handler for Form Submissions
 * Handles HTTP 429 responses with automatic 60-second pause
 */

import { createLogger } from '../../shared/logger';

const logger = createLogger('rate-limit-handler');

export class RateLimitHandler {
  private static readonly PAUSE_DURATION_MS = 60000; // 60 seconds

  /**
   * Check if response is rate limited (HTTP 429)
   */
  static isRateLimited(statusCode?: number): boolean {
    return statusCode === 429;
  }

  /**
   * Wait for rate limit cooldown period
   */
  static async waitForCooldown(): Promise<void> {
    logger.warn(`Rate limit detected. Pausing for ${this.PAUSE_DURATION_MS / 1000} seconds...`);

    await new Promise((resolve) => setTimeout(resolve, this.PAUSE_DURATION_MS));

    logger.info('Rate limit cooldown completed. Resuming...');
  }

  /**
   * Execute function with automatic rate limit handling
   */
  static async withRateLimitHandling<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const result = await fn();
        return result;
      } catch (error: any) {
        attempt++;

        // Check if error is rate limit
        if (this.isRateLimited(error?.statusCode || error?.status)) {
          if (attempt >= maxRetries) {
            logger.error('Max retries reached for rate-limited request');
            throw error;
          }

          logger.warn(`Rate limit hit. Attempt ${attempt}/${maxRetries}`);
          await this.waitForCooldown();
          continue;
        }

        // If not rate limit error, throw immediately
        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }
}
