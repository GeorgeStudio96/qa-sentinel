/**
 * Human Behavior Emulation
 * Simulates realistic human interactions to bypass bot detection
 */

import type { Page, Locator } from 'playwright';
import { createLogger } from '../../shared/logger';

const logger = createLogger('human-behavior');

/**
 * Configuration for human-like behavior parameters
 */
const HUMAN_CONFIG = {
  // Delay between form fields (ms)
  FIELD_DELAY_MIN: 2000,
  FIELD_DELAY_MAX: 5000,

  // Typing speed (ms per character)
  TYPING_SPEED_MIN: 50,
  TYPING_SPEED_MAX: 150,

  // Probability of making a typo (0-1)
  TYPO_PROBABILITY: 0.05,

  // Mouse movement smoothness
  MOUSE_MOVE_STEPS_MIN: 10,
  MOUSE_MOVE_STEPS_MAX: 20,

  // Pause between words when typing
  WORD_PAUSE_MIN: 200,
  WORD_PAUSE_MAX: 500,

  // Pause before/after clicks
  CLICK_PAUSE_MIN: 200,
  CLICK_PAUSE_MAX: 500,

  // Pause after mouse movement
  MOUSE_MOVE_PAUSE_MIN: 100,
  MOUSE_MOVE_PAUSE_MAX: 300,

  // Pause after clicking into a field
  FIELD_FOCUS_PAUSE_MIN: 300,
  FIELD_FOCUS_PAUSE_MAX: 800,
};

export class HumanBehavior {
  /**
   * Random delay between min and max milliseconds
   */
  async humanDelay(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Type text into a field with human-like characteristics:
   * - Random typing speed per character
   * - Occasional typos followed by backspace
   * - Pauses between words
   */
  async humanType(page: Page, field: Locator, text: string): Promise<void> {
    // Click into the field first
    await field.click();
    await this.humanDelay(
      HUMAN_CONFIG.FIELD_FOCUS_PAUSE_MIN,
      HUMAN_CONFIG.FIELD_FOCUS_PAUSE_MAX
    );

    // Type each character with randomized delays
    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Random chance of making a typo
      if (Math.random() < HUMAN_CONFIG.TYPO_PROBABILITY) {
        // Type wrong character
        const wrongChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        await field.pressSequentially(wrongChar, {
          delay: Math.random() * (HUMAN_CONFIG.TYPING_SPEED_MAX - HUMAN_CONFIG.TYPING_SPEED_MIN) + HUMAN_CONFIG.TYPING_SPEED_MIN,
        });

        // Pause before correcting
        await this.humanDelay(200, 400);

        // Press backspace
        await field.press('Backspace');
        await this.humanDelay(100, 200);
      }

      // Type the actual character
      const typingSpeed =
        Math.random() * (HUMAN_CONFIG.TYPING_SPEED_MAX - HUMAN_CONFIG.TYPING_SPEED_MIN) +
        HUMAN_CONFIG.TYPING_SPEED_MIN;

      await field.pressSequentially(char, { delay: typingSpeed });

      // Add pause after spaces (between words)
      if (char === ' ') {
        await this.humanDelay(HUMAN_CONFIG.WORD_PAUSE_MIN, HUMAN_CONFIG.WORD_PAUSE_MAX);
      }
    }

    logger.debug(`Typed "${text.substring(0, 30)}..." with human-like behavior`);
  }

  /**
   * Move mouse to target element in a human-like way
   * - Moves to random point inside element (not center)
   * - Uses multiple steps for smooth movement
   */
  async humanMouseMove(page: Page, target: Locator): Promise<void> {
    try {
      const box = await target.boundingBox();
      if (!box) {
        logger.warn('Could not get bounding box for mouse movement');
        return;
      }

      // Choose random point inside element (not center!)
      const x = box.x + Math.random() * box.width;
      const y = box.y + Math.random() * box.height;

      // Random number of steps for smooth movement
      const steps =
        Math.floor(Math.random() * (HUMAN_CONFIG.MOUSE_MOVE_STEPS_MAX - HUMAN_CONFIG.MOUSE_MOVE_STEPS_MIN + 1)) +
        HUMAN_CONFIG.MOUSE_MOVE_STEPS_MIN;

      await page.mouse.move(x, y, { steps });

      // Small pause after movement
      await this.humanDelay(
        HUMAN_CONFIG.MOUSE_MOVE_PAUSE_MIN,
        HUMAN_CONFIG.MOUSE_MOVE_PAUSE_MAX
      );

      logger.debug(`Moved mouse to (${Math.round(x)}, ${Math.round(y)}) in ${steps} steps`);
    } catch (error) {
      logger.warn('Error during mouse movement:', error);
    }
  }

  /**
   * Click element with human-like behavior:
   * - Move mouse to element first
   * - Pause before clicking
   * - Pause after clicking
   */
  async humanClick(page: Page, target: Locator): Promise<void> {
    // Move mouse to target
    await this.humanMouseMove(page, target);

    // Pause before click
    await this.humanDelay(HUMAN_CONFIG.CLICK_PAUSE_MIN, HUMAN_CONFIG.CLICK_PAUSE_MAX);

    // Click
    await target.click();

    // Pause after click
    await this.humanDelay(HUMAN_CONFIG.CLICK_PAUSE_MIN, HUMAN_CONFIG.CLICK_PAUSE_MAX);

    logger.debug('Performed human-like click');
  }

  /**
   * Scroll page in human-like way
   * - Smooth scrolling with random amount
   */
  async humanScroll(page: Page, direction: 'down' | 'up' = 'down', amount?: number): Promise<void> {
    const scrollAmount = amount || Math.floor(Math.random() * 300) + 200; // 200-500px
    const delta = direction === 'down' ? scrollAmount : -scrollAmount;

    // Scroll in multiple steps for smoothness
    const steps = 5;
    const stepAmount = delta / steps;

    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, stepAmount);
      await this.humanDelay(50, 100);
    }

    logger.debug(`Scrolled ${direction} by ${scrollAmount}px`);
  }

  /**
   * Random delay between form fields
   */
  async fieldDelay(): Promise<void> {
    await this.humanDelay(HUMAN_CONFIG.FIELD_DELAY_MIN, HUMAN_CONFIG.FIELD_DELAY_MAX);
  }

  /**
   * Get configuration (useful for adjusting behavior)
   */
  static getConfig() {
    return { ...HUMAN_CONFIG };
  }

  /**
   * Update configuration (useful for testing different aggressiveness levels)
   */
  static setConfig(config: Partial<typeof HUMAN_CONFIG>) {
    Object.assign(HUMAN_CONFIG, config);
    logger.info('Human behavior config updated', config);
  }
}
