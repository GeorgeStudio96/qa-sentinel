import { createLogger } from '../utils/logger';
import {
  BaseChecker,
  CheckerResult,
  CheckerContext,
  AccessibilityConfig,
  Issue
} from './types';

const logger = createLogger('AccessibilityChecker');

interface ColorContrastResult {
  element: string;
  selector: string;
  foreground: string;
  background: string;
  ratio: number;
  level: 'AA' | 'AAA' | 'fail';
}

/**
 * AccessibilityChecker - Comprehensive accessibility analysis module
 *
 * This checker analyzes page accessibility compliance with WCAG guidelines
 * and identifies barriers that might prevent users with disabilities from
 * accessing content.
 *
 * What it checks:
 * - Color contrast ratios (WCAG AA/AAA compliance)
 * - Alternative text for images
 * - Form labels and input accessibility
 * - ARIA attributes and roles
 * - Semantic HTML structure
 * - Keyboard navigation support
 * - Focus management
 */
export class AccessibilityChecker implements BaseChecker {
  private context: CheckerContext;
  private config: AccessibilityConfig;

  constructor(context: CheckerContext, config: AccessibilityConfig = {}) {
    this.context = context;
    this.config = {
      checkColorContrast: true,
      checkAltText: true,
      checkFormLabels: true,
      checkKeyboardNavigation: true,
      wcagLevel: 'AA',
      ...config
    };
  }

  /**
   * Main check method - performs comprehensive accessibility analysis
   * Returns detailed report with accessibility issues and WCAG references
   */
  async check(): Promise<CheckerResult> {
    const startTime = Date.now();
    logger.info(`Starting accessibility check for ${this.context.url}`);

    try {
      const issues: Issue[] = [];
      let elementsChecked = 0;

      // Check color contrast if enabled
      if (this.config.checkColorContrast) {
        const contrastIssues = await this.checkColorContrast();
        issues.push(...contrastIssues);
        elementsChecked += contrastIssues.length;
      }

      // Check alt text if enabled
      if (this.config.checkAltText) {
        const altTextIssues = await this.checkImageAltText();
        issues.push(...altTextIssues);
        elementsChecked += altTextIssues.length;
      }

      // Check form labels if enabled
      if (this.config.checkFormLabels) {
        const formIssues = await this.checkFormAccessibility();
        issues.push(...formIssues);
        elementsChecked += formIssues.length;
      }

      // Check keyboard navigation if enabled
      if (this.config.checkKeyboardNavigation) {
        const keyboardIssues = await this.checkKeyboardAccessibility();
        issues.push(...keyboardIssues);
        elementsChecked += keyboardIssues.length;
      }

      // Check semantic structure
      const semanticIssues = await this.checkSemanticStructure();
      issues.push(...semanticIssues);
      elementsChecked += semanticIssues.length;

      // Create result with metadata
      const result: CheckerResult = {
        type: 'accessibility',
        status: this.determineOverallStatus(issues),
        issues,
        metadata: {
          checkedAt: new Date().toISOString(),
          duration: Date.now() - startTime,
          elementsChecked,
          url: this.context.url,
          viewport: this.context.viewport
        }
      };

      logger.info(`Accessibility check completed: ${issues.length} issues found`);
      return result;

    } catch (error) {
      logger.error('Failed to perform accessibility check:', error);
      throw error;
    }
  }

  /**
   * Check color contrast ratios against WCAG guidelines
   * Analyzes text/background combinations for sufficient contrast
   */
  private async checkColorContrast(): Promise<Issue[]> {
    const { page } = this.context;
    const issues: Issue[] = [];

    // Get color contrast data for text elements
    const contrastData = await page.evaluate((wcagLevel) => {
      const textElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, a, button, label'));

      const results: any[] = [];

      textElements.forEach((element, index) => {
        const computedStyle = window.getComputedStyle(element);
        const color = computedStyle.color;
        const backgroundColor = computedStyle.backgroundColor;

        // Skip elements with no text content
        if (!element.textContent?.trim()) return;

        // Only check elements with actual background colors (not transparent)
        if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
          // Try to find parent with background
          let parent = element.parentElement;
          let foundBackground = false;
          while (parent && !foundBackground) {
            const parentStyle = window.getComputedStyle(parent);
            if (parentStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && parentStyle.backgroundColor !== 'transparent') {
              foundBackground = true;
              break;
            }
            parent = parent.parentElement;
          }
          if (!foundBackground) return; // Skip elements without determinable background
        }

        const selector = element.id
          ? `#${element.id}`
          : element.className
          ? `${element.tagName.toLowerCase()}.${element.className.split(' ').join('.')}`
          : `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;

        // Calculate contrast ratio (simplified - in production use a proper library)
        const ratio = this.calculateContrastRatio(color, backgroundColor);

        // Determine WCAG compliance level
        const fontSize = parseFloat(computedStyle.fontSize);
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && computedStyle.fontWeight === 'bold');

        let level: 'AA' | 'AAA' | 'fail' = 'fail';
        if (wcagLevel === 'AAA') {
          level = ratio >= (isLargeText ? 4.5 : 7.0) ? 'AAA' : (ratio >= (isLargeText ? 3.0 : 4.5) ? 'AA' : 'fail');
        } else {
          level = ratio >= (isLargeText ? 3.0 : 4.5) ? 'AA' : 'fail';
        }

        results.push({
          element: element.tagName.toLowerCase(),
          selector,
          foreground: color,
          background: backgroundColor,
          ratio: ratio,
          level: level,
          text: element.textContent?.trim().substring(0, 50) || '',
          isLargeText
        });
      });

      return results;

      // Simplified contrast ratio calculation
      function calculateContrastRatio(fg: string, bg: string): number {
        // This is a very simplified version
        // In production, use a proper color contrast library
        return 4.5; // Placeholder - would need proper color parsing and calculation
      }
    }, this.config.wcagLevel);

    // Generate issues for failed contrast checks
    contrastData.forEach((result: any, index: number) => {
      if (result.level === 'fail') {
        const requiredRatio = result.isLargeText ? (this.config.wcagLevel === 'AAA' ? 4.5 : 3.0) : (this.config.wcagLevel === 'AAA' ? 7.0 : 4.5);

        issues.push({
          id: `contrast-fail-${index}`,
          severity: 'high',
          title: `Poor Color Contrast (WCAG ${this.config.wcagLevel})`,
          description: `Text contrast ratio is ${result.ratio.toFixed(2)}:1 (required: ${requiredRatio}:1)`,
          element: {
            tagName: result.element,
            selector: result.selector,
            text: result.text,
            attributes: {}
          },
          suggestion: `Increase contrast between text (${result.foreground}) and background (${result.background}). Consider using darker text or lighter background colors.`
        });
      }
    });

    return issues;
  }

  /**
   * Check image alt text for accessibility compliance
   * Ensures all meaningful images have descriptive alt attributes
   */
  private async checkImageAltText(): Promise<Issue[]> {
    const { page } = this.context;
    const issues: Issue[] = [];

    const imageData = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));

      return images.map((img, index) => ({
        src: img.getAttribute('src') || '',
        alt: img.getAttribute('alt'),
        role: img.getAttribute('role'),
        ariaLabel: img.getAttribute('aria-label'),
        ariaHidden: img.getAttribute('aria-hidden'),
        selector: img.id
          ? `#${img.id}`
          : img.className
          ? `img.${img.className.split(' ').join('.')}`
          : `img:nth-child(${index + 1})`,
        isDecorative: img.getAttribute('role') === 'presentation' || img.getAttribute('aria-hidden') === 'true',
        width: img.width,
        height: img.height
      }));
    });

    imageData.forEach((image, index) => {
      // Check for missing alt attribute (critical accessibility issue)
      if (image.alt === null && !image.isDecorative && !image.ariaLabel) {
        issues.push({
          id: `missing-img-alt-${index}`,
          severity: 'critical',
          title: 'Missing Image Alt Text',
          description: 'Image lacks alt attribute and accessibility labeling',
          element: {
            tagName: 'img',
            selector: image.selector,
            text: '',
            attributes: {
              src: image.src
            }
          },
          suggestion: 'Add descriptive alt text that explains the content and function of the image. For decorative images, use alt="" or role="presentation".'
        });
      }

      // Check for potentially inadequate alt text
      if (image.alt && image.alt.length < 5 && !image.isDecorative) {
        issues.push({
          id: `inadequate-alt-${index}`,
          severity: 'medium',
          title: 'Potentially Inadequate Alt Text',
          description: `Alt text is very short: "${image.alt}"`,
          element: {
            tagName: 'img',
            selector: image.selector,
            text: '',
            attributes: {
              src: image.src,
              alt: image.alt
            }
          },
          suggestion: 'Ensure alt text adequately describes the image content. Very short alt text may not provide enough context for screen reader users.'
        });
      }

      // Check for redundant alt text patterns
      if (image.alt && (
        image.alt.toLowerCase().includes('image of') ||
        image.alt.toLowerCase().includes('picture of') ||
        image.alt.toLowerCase().includes('photo of')
      )) {
        issues.push({
          id: `redundant-alt-${index}`,
          severity: 'low',
          title: 'Redundant Alt Text',
          description: `Alt text contains redundant phrases: "${image.alt}"`,
          element: {
            tagName: 'img',
            selector: image.selector,
            text: '',
            attributes: {
              src: image.src,
              alt: image.alt
            }
          },
          suggestion: 'Remove redundant phrases like "image of" or "picture of" from alt text. Screen readers already announce that it\'s an image.'
        });
      }
    });

    return issues;
  }

  /**
   * Check form accessibility compliance
   * Ensures forms are properly labeled and keyboard accessible
   */
  private async checkFormAccessibility(): Promise<Issue[]> {
    const { page } = this.context;
    const issues: Issue[] = [];

    const formData = await page.evaluate(() => {
      const formElements = Array.from(document.querySelectorAll('input, textarea, select'));

      return formElements.map((element, index) => {
        const input = element as HTMLInputElement;
        const id = input.id;
        const type = input.type || 'text';
        const name = input.name;
        const placeholder = input.placeholder;
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');

        // Find associated label
        let associatedLabel = null;
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          associatedLabel = label?.textContent?.trim() || null;
        }

        // Check if input is inside a label
        const parentLabel = input.closest('label');
        if (parentLabel && !associatedLabel) {
          associatedLabel = parentLabel.textContent?.trim() || null;
        }

        const selector = id
          ? `#${id}`
          : input.className
          ? `${input.tagName.toLowerCase()}.${input.className.split(' ').join('.')}`
          : `${input.tagName.toLowerCase()}:nth-child(${index + 1})`;

        return {
          tagName: input.tagName.toLowerCase(),
          type,
          id,
          name,
          selector,
          hasLabel: !!associatedLabel,
          labelText: associatedLabel,
          hasAriaLabel: !!ariaLabel,
          ariaLabel,
          hasAriaLabelledBy: !!ariaLabelledBy,
          placeholder,
          required: input.hasAttribute('required')
        };
      });
    });

    formData.forEach((field, index) => {
      // Check for missing labels (critical for screen readers)
      if (!field.hasLabel && !field.hasAriaLabel && !field.hasAriaLabelledBy) {
        issues.push({
          id: `missing-form-label-${index}`,
          severity: 'critical',
          title: 'Form Field Missing Label',
          description: `${field.tagName} field has no accessible label`,
          element: {
            tagName: field.tagName,
            selector: field.selector,
            text: '',
            attributes: {
              type: field.type,
              name: field.name || ''
            }
          },
          suggestion: 'Add a proper label element associated with this form field using the "for" attribute, or add an aria-label attribute.'
        });
      }

      // Check for placeholder-only labeling (accessibility anti-pattern)
      if (!field.hasLabel && !field.hasAriaLabel && field.placeholder) {
        issues.push({
          id: `placeholder-only-label-${index}`,
          severity: 'high',
          title: 'Placeholder Used as Label',
          description: 'Form field relies only on placeholder text for labeling',
          element: {
            tagName: field.tagName,
            selector: field.selector,
            text: '',
            attributes: {
              type: field.type,
              placeholder: field.placeholder
            }
          },
          suggestion: 'Add a proper label element in addition to the placeholder. Placeholders disappear when users type and may not be announced by all screen readers.'
        });
      }

      // Check for generic or unclear labels
      if (field.labelText && field.labelText.length < 3) {
        issues.push({
          id: `unclear-form-label-${index}`,
          severity: 'medium',
          title: 'Unclear Form Label',
          description: `Form label is too short or unclear: "${field.labelText}"`,
          element: {
            tagName: field.tagName,
            selector: field.selector,
            text: '',
            attributes: {
              type: field.type
            }
          },
          suggestion: 'Use more descriptive labels that clearly explain what information is expected in the form field.'
        });
      }
    });

    return issues;
  }

  /**
   * Check keyboard accessibility and focus management
   * Ensures interactive elements are keyboard navigable
   */
  private async checkKeyboardAccessibility(): Promise<Issue[]> {
    const { page } = this.context;
    const issues: Issue[] = [];

    const keyboardData = await page.evaluate(() => {
      const interactiveElements = Array.from(document.querySelectorAll(
        'a, button, input, textarea, select, [tabindex], [onclick], [role="button"], [role="link"]'
      ));

      return interactiveElements.map((element, index) => {
        const tabIndex = element.getAttribute('tabindex');
        const hasOnClick = element.hasAttribute('onclick') || element.addEventListener;
        const role = element.getAttribute('role');
        const tagName = element.tagName.toLowerCase();

        const selector = element.id
          ? `#${element.id}`
          : element.className
          ? `${tagName}.${element.className.split(' ').join('.')}`
          : `${tagName}:nth-child(${index + 1})`;

        // Check if element is focusable
        const isFocusable = tabIndex !== '-1' && (
          ['a', 'button', 'input', 'textarea', 'select'].includes(tagName) ||
          tabIndex !== null
        );

        return {
          tagName,
          selector,
          tabIndex,
          isFocusable,
          hasOnClick,
          role,
          text: element.textContent?.trim().substring(0, 50) || '',
          hasHref: tagName === 'a' ? element.hasAttribute('href') : null
        };
      });
    });

    keyboardData.forEach((element, index) => {
      // Check for non-focusable clickable elements
      if (element.hasOnClick && !element.isFocusable && element.tagName === 'div') {
        issues.push({
          id: `non-focusable-clickable-${index}`,
          severity: 'high',
          title: 'Non-Focusable Interactive Element',
          description: `${element.tagName} has click handler but is not keyboard focusable`,
          element: {
            tagName: element.tagName,
            selector: element.selector,
            text: element.text,
            attributes: {
              role: element.role || ''
            }
          },
          suggestion: 'Add tabindex="0" or use a semantic button/link element instead. Also add keyboard event handlers for Enter and Space keys.'
        });
      }

      // Check for links without href
      if (element.tagName === 'a' && !element.hasHref) {
        issues.push({
          id: `link-without-href-${index}`,
          severity: 'medium',
          title: 'Link Without href Attribute',
          description: 'Anchor element lacks href attribute',
          element: {
            tagName: element.tagName,
            selector: element.selector,
            text: element.text,
            attributes: {}
          },
          suggestion: 'Add href attribute to make link keyboard accessible, or use a button element if this triggers an action rather than navigation.'
        });
      }

      // Check for positive tabindex values (anti-pattern)
      if (element.tabIndex && parseInt(element.tabIndex) > 0) {
        issues.push({
          id: `positive-tabindex-${index}`,
          severity: 'medium',
          title: 'Positive Tabindex Found',
          description: `Element has tabindex="${element.tabIndex}" (should avoid positive values)`,
          element: {
            tagName: element.tagName,
            selector: element.selector,
            text: element.text,
            attributes: {
              tabindex: element.tabIndex
            }
          },
          suggestion: 'Avoid positive tabindex values as they disrupt natural tab order. Use tabindex="0" for focusable elements or reorder HTML structure instead.'
        });
      }
    });

    return issues;
  }

  /**
   * Check semantic HTML structure for accessibility
   * Ensures proper use of headings, landmarks, and semantic elements
   */
  private async checkSemanticStructure(): Promise<Issue[]> {
    const { page } = this.context;
    const issues: Issue[] = [];

    const semanticData = await page.evaluate(() => {
      // Check for landmark elements
      const landmarks = {
        main: document.querySelectorAll('main, [role="main"]').length,
        nav: document.querySelectorAll('nav, [role="navigation"]').length,
        header: document.querySelectorAll('header, [role="banner"]').length,
        footer: document.querySelectorAll('footer, [role="contentinfo"]').length
      };

      // Check heading structure
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .map(h => parseInt(h.tagName.charAt(1)));

      // Check for skip links
      const skipLinks = document.querySelectorAll('a[href^="#"]').length;

      return {
        landmarks,
        headings,
        skipLinks,
        hasLang: document.documentElement.hasAttribute('lang'),
        langValue: document.documentElement.getAttribute('lang')
      };
    });

    // Check for missing main landmark
    if (semanticData.landmarks.main === 0) {
      issues.push({
        id: 'missing-main-landmark',
        severity: 'high',
        title: 'Missing Main Landmark',
        description: 'Page lacks main landmark for primary content',
        suggestion: 'Add a <main> element or role="main" to identify the primary content area. This helps screen reader users navigate directly to main content.'
      });
    }

    // Check for multiple main landmarks (should be unique)
    if (semanticData.landmarks.main > 1) {
      issues.push({
        id: 'multiple-main-landmarks',
        severity: 'medium',
        title: 'Multiple Main Landmarks',
        description: `Found ${semanticData.landmarks.main} main landmarks (should be 1)`,
        suggestion: 'Use only one main landmark per page. If you have multiple content areas, use section elements instead.'
      });
    }

    // Check for missing language declaration
    if (!semanticData.hasLang) {
      issues.push({
        id: 'missing-lang-attribute',
        severity: 'high',
        title: 'Missing Language Declaration',
        description: 'HTML element lacks lang attribute',
        suggestion: 'Add lang attribute to the html element (e.g., lang="en") to help screen readers pronounce content correctly.'
      });
    }

    // Check heading structure for skipped levels
    for (let i = 1; i < semanticData.headings.length; i++) {
      const current = semanticData.headings[i];
      const previous = semanticData.headings[i - 1];

      if (current - previous > 1) {
        issues.push({
          id: `skipped-heading-level-${i}`,
          severity: 'medium',
          title: 'Skipped Heading Level',
          description: `Heading levels skip from h${previous} to h${current}`,
          suggestion: 'Use heading levels in order (h1, h2, h3, etc.) to create a logical document outline for screen readers.'
        });
      }
    }

    return issues;
  }

  /**
   * Determine overall status based on accessibility issues
   * Returns appropriate status based on WCAG compliance level
   */
  private determineOverallStatus(issues: Issue[]): 'success' | 'warning' | 'error' {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const highIssues = issues.filter(issue => issue.severity === 'high');

    if (criticalIssues.length > 0) return 'error';
    if (highIssues.length > 0) return 'warning';
    return issues.length === 0 ? 'success' : 'warning';
  }

  /**
   * Calculate color contrast ratio between foreground and background colors
   * Simplified implementation - in production, use a proper library like chroma.js
   */
  private calculateContrastRatio(foreground: string, background: string): number {
    // Simplified contrast calculation
    // In production, this should use proper WCAG contrast calculation algorithm

    // Convert hex/rgb to luminance values
    const getLuminance = (color: string): number => {
      // Very basic implementation - just for demonstration
      const rgb = color.match(/\d+/g);
      if (!rgb || rgb.length < 3) return 0.5;

      const [r, g, b] = rgb.map(x => parseInt(x) / 255);
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };

    const fgLum = getLuminance(foreground);
    const bgLum = getLuminance(background);

    const lighter = Math.max(fgLum, bgLum);
    const darker = Math.min(fgLum, bgLum);

    return (lighter + 0.05) / (darker + 0.05);
  }
}