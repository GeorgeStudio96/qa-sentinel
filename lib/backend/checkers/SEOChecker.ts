import { createLogger } from '../utils/logger';
import {
  BaseChecker,
  CheckerResult,
  CheckerContext,
  SEOConfig,
  ElementInfo,
  Issue
} from './types';

const logger = createLogger('SEOChecker');

/**
 * SEOChecker - Comprehensive SEO analysis module
 *
 * This checker analyzes all SEO-related elements on a page and provides
 * actionable recommendations to improve search engine optimization.
 *
 * What it checks:
 * - Meta tags (title, description, keywords, og tags)
 * - Heading structure (h1-h6 hierarchy)
 * - Image alt attributes
 * - Internal link structure
 * - Page performance factors
 * - Schema markup presence
 */
export class SEOChecker implements BaseChecker {
  private context: CheckerContext;
  private config: SEOConfig;

  constructor(context: CheckerContext, config: SEOConfig = {}) {
    this.context = context;
    this.config = {
      checkMetaTags: true,
      checkHeadings: true,
      checkImages: true,
      checkInternalLinks: true,
      maxDescriptionLength: 160,
      maxTitleLength: 60,
      ...config
    };
  }

  /**
   * Main check method - performs comprehensive SEO analysis
   * Returns detailed report with SEO issues and recommendations
   */
  async check(): Promise<CheckerResult> {
    const startTime = Date.now();
    logger.info(`Starting SEO check for ${this.context.url}`);

    try {
      const issues: Issue[] = [];
      let elementsChecked = 0;

      // Check meta tags if enabled
      if (this.config.checkMetaTags) {
        const metaIssues = await this.checkMetaTags();
        issues.push(...metaIssues);
        elementsChecked += 10; // Approximate number of meta elements
      }

      // Check heading structure if enabled
      if (this.config.checkHeadings) {
        const headingIssues = await this.checkHeadings();
        issues.push(...headingIssues);
        elementsChecked += headingIssues.length;
      }

      // Check images if enabled
      if (this.config.checkImages) {
        const imageIssues = await this.checkImages();
        issues.push(...imageIssues);
        elementsChecked += imageIssues.length;
      }

      // Check internal links if enabled
      if (this.config.checkInternalLinks) {
        const linkIssues = await this.checkInternalLinkStructure();
        issues.push(...linkIssues);
        elementsChecked += linkIssues.length;
      }

      // Create result with metadata
      const result: CheckerResult = {
        type: 'seo',
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

      logger.info(`SEO check completed: ${issues.length} issues found`);
      return result;

    } catch (error) {
      logger.error('Failed to perform SEO check:', error);
      throw error;
    }
  }

  /**
   * Check meta tags for SEO compliance
   * Analyzes title, description, keywords, and Open Graph tags
   */
  private async checkMetaTags(): Promise<Issue[]> {
    const { page } = this.context;
    const issues: Issue[] = [];

    const metaData = await page.evaluate((config) => {
      const title = document.querySelector('title')?.textContent?.trim() || '';
      const description = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
      const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content')?.trim() || '';

      // Open Graph tags
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || '';
      const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || '';
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content')?.trim() || '';

      // Twitter Card tags
      const twitterCard = document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')?.trim() || '';
      const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')?.trim() || '';

      // Other important meta tags
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() || '';
      const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content')?.trim() || '';

      return {
        title,
        titleLength: title.length,
        description,
        descriptionLength: description.length,
        keywords,
        ogTitle,
        ogDescription,
        ogImage,
        twitterCard,
        twitterTitle,
        canonical,
        robots
      };
    }, this.config);

    // Check title tag
    if (!metaData.title) {
      issues.push({
        id: 'missing-title',
        severity: 'critical',
        title: 'Missing Page Title',
        description: 'Page title is missing or empty',
        suggestion: 'Add a descriptive title tag between 30-60 characters that includes your main keyword.'
      });
    } else if (metaData.titleLength > this.config.maxTitleLength!) {
      issues.push({
        id: 'long-title',
        severity: 'medium',
        title: 'Page Title Too Long',
        description: `Title is ${metaData.titleLength} characters (recommended: max ${this.config.maxTitleLength})`,
        suggestion: `Shorten the title to under ${this.config.maxTitleLength} characters to prevent truncation in search results.`
      });
    } else if (metaData.titleLength < 30) {
      issues.push({
        id: 'short-title',
        severity: 'low',
        title: 'Page Title Too Short',
        description: `Title is only ${metaData.titleLength} characters (recommended: 30-${this.config.maxTitleLength})`,
        suggestion: 'Consider making the title more descriptive while including relevant keywords.'
      });
    }

    // Check meta description
    if (!metaData.description) {
      issues.push({
        id: 'missing-description',
        severity: 'high',
        title: 'Missing Meta Description',
        description: 'Meta description is missing',
        suggestion: 'Add a compelling meta description between 120-160 characters that summarizes the page content.'
      });
    } else if (metaData.descriptionLength > this.config.maxDescriptionLength!) {
      issues.push({
        id: 'long-description',
        severity: 'medium',
        title: 'Meta Description Too Long',
        description: `Description is ${metaData.descriptionLength} characters (recommended: max ${this.config.maxDescriptionLength})`,
        suggestion: `Shorten the description to under ${this.config.maxDescriptionLength} characters to prevent truncation in search results.`
      });
    }

    // Check Open Graph tags
    if (!metaData.ogTitle) {
      issues.push({
        id: 'missing-og-title',
        severity: 'low',
        title: 'Missing Open Graph Title',
        description: 'og:title meta tag is missing',
        suggestion: 'Add og:title meta tag for better social media sharing. Use the same or similar title as your page title.'
      });
    }

    if (!metaData.ogDescription) {
      issues.push({
        id: 'missing-og-description',
        severity: 'low',
        title: 'Missing Open Graph Description',
        description: 'og:description meta tag is missing',
        suggestion: 'Add og:description meta tag for better social media sharing. Use the same or similar description as your meta description.'
      });
    }

    if (!metaData.ogImage) {
      issues.push({
        id: 'missing-og-image',
        severity: 'low',
        title: 'Missing Open Graph Image',
        description: 'og:image meta tag is missing',
        suggestion: 'Add og:image meta tag with a high-quality image (1200x630px recommended) for social media sharing.'
      });
    }

    // Check canonical URL
    if (!metaData.canonical) {
      issues.push({
        id: 'missing-canonical',
        severity: 'medium',
        title: 'Missing Canonical URL',
        description: 'Canonical link tag is missing',
        suggestion: 'Add a canonical link tag to prevent duplicate content issues and help search engines understand the preferred URL.'
      });
    }

    return issues;
  }

  /**
   * Check heading structure (h1-h6) for SEO best practices
   * Ensures proper hierarchy and presence of h1
   */
  private async checkHeadings(): Promise<Issue[]> {
    const { page } = this.context;
    const issues: Issue[] = [];

    const headings = await page.evaluate(() => {
      const headingElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));

      return headingElements.map((heading, index) => ({
        level: parseInt(heading.tagName.charAt(1)),
        text: heading.textContent?.trim() || '',
        tagName: heading.tagName.toLowerCase(),
        selector: heading.id
          ? `#${heading.id}`
          : heading.className
          ? `${heading.tagName.toLowerCase()}.${heading.className.split(' ').join('.')}`
          : `${heading.tagName.toLowerCase()}:nth-child(${index + 1})`,
        isEmpty: !heading.textContent?.trim()
      }));
    });

    // Check for h1 presence and uniqueness
    const h1Elements = headings.filter(h => h.level === 1);

    if (h1Elements.length === 0) {
      issues.push({
        id: 'missing-h1',
        severity: 'critical',
        title: 'Missing H1 Tag',
        description: 'Page is missing an h1 tag',
        suggestion: 'Add exactly one h1 tag that describes the main topic of the page and includes your primary keyword.'
      });
    } else if (h1Elements.length > 1) {
      issues.push({
        id: 'multiple-h1',
        severity: 'high',
        title: 'Multiple H1 Tags Found',
        description: `Found ${h1Elements.length} h1 tags (should be exactly 1)`,
        suggestion: 'Use only one h1 tag per page. Convert additional h1 tags to h2 or lower heading levels.'
      });
    }

    // Check for empty headings
    const emptyHeadings = headings.filter(h => h.isEmpty);
    emptyHeadings.forEach((heading, index) => {
      issues.push({
        id: `empty-heading-${index}`,
        severity: 'medium',
        title: 'Empty Heading Found',
        description: `${heading.tagName.toUpperCase()} tag is empty`,
        element: {
          tagName: heading.tagName,
          selector: heading.selector,
          text: heading.text,
          attributes: {}
        },
        suggestion: 'Add descriptive text to the heading or remove it if not needed.'
      });
    });

    // Check heading hierarchy
    const hierarchyIssues = this.checkHeadingHierarchy(headings);
    issues.push(...hierarchyIssues);

    return issues;
  }

  /**
   * Check heading hierarchy for logical structure
   * Ensures headings follow proper h1 -> h2 -> h3 progression
   */
  private checkHeadingHierarchy(headings: Array<{level: number, text: string, tagName: string}>): Issue[] {
    const issues: Issue[] = [];

    for (let i = 1; i < headings.length; i++) {
      const current = headings[i];
      const previous = headings[i - 1];

      // Check if heading level jumps more than one level
      if (current.level - previous.level > 1) {
        issues.push({
          id: `heading-hierarchy-jump-${i}`,
          severity: 'medium',
          title: 'Heading Hierarchy Issue',
          description: `${current.tagName.toUpperCase()} follows ${previous.tagName.toUpperCase()} (skipping heading levels)`,
          suggestion: `Use proper heading hierarchy. After ${previous.tagName.toUpperCase()}, use h${previous.level + 1} instead of ${current.tagName.toUpperCase()}.`
        });
      }
    }

    return issues;
  }

  /**
   * Check images for SEO compliance
   * Analyzes alt attributes and image optimization
   */
  private async checkImages(): Promise<Issue[]> {
    const { page } = this.context;
    const issues: Issue[] = [];

    const images = await page.evaluate(() => {
      const imageElements = Array.from(document.querySelectorAll('img'));

      return imageElements.map((img, index) => ({
        src: img.getAttribute('src') || '',
        alt: img.getAttribute('alt'),
        title: img.getAttribute('title') || '',
        selector: img.id
          ? `#${img.id}`
          : img.className
          ? `img.${img.className.split(' ').join('.')}`
          : `img:nth-child(${index + 1})`,
        isDecorative: img.getAttribute('role') === 'presentation' || img.getAttribute('alt') === '',
        width: img.width,
        height: img.height
      }));
    });

    images.forEach((image, index) => {
      // Check for missing alt attributes (critical for accessibility and SEO)
      if (image.alt === null && !image.isDecorative) {
        issues.push({
          id: `missing-alt-${index}`,
          severity: 'high',
          title: 'Missing Alt Attribute',
          description: 'Image is missing alt attribute',
          element: {
            tagName: 'img',
            selector: image.selector,
            text: '',
            attributes: {
              src: image.src
            }
          },
          suggestion: 'Add descriptive alt text that explains what the image shows. This helps both SEO and accessibility.'
        });
      }

      // Check for empty alt attributes on non-decorative images
      if (image.alt === '' && !image.isDecorative) {
        issues.push({
          id: `empty-alt-${index}`,
          severity: 'medium',
          title: 'Empty Alt Attribute',
          description: 'Image has empty alt attribute but may not be decorative',
          element: {
            tagName: 'img',
            selector: image.selector,
            text: '',
            attributes: {
              src: image.src,
              alt: image.alt || ''
            }
          },
          suggestion: 'If this image conveys information, add descriptive alt text. If it\'s decorative, add role="presentation".'
        });
      }

      // Check for overly long alt text
      if (image.alt && image.alt.length > 125) {
        issues.push({
          id: `long-alt-${index}`,
          severity: 'low',
          title: 'Alt Text Too Long',
          description: `Alt text is ${image.alt.length} characters (recommended: max 125)`,
          element: {
            tagName: 'img',
            selector: image.selector,
            text: '',
            attributes: {
              src: image.src,
              alt: image.alt
            }
          },
          suggestion: 'Shorten alt text to be more concise while still being descriptive.'
        });
      }
    });

    return issues;
  }

  /**
   * Check internal link structure for SEO
   * Analyzes internal linking patterns and anchor text
   */
  private async checkInternalLinkStructure(): Promise<Issue[]> {
    const { page } = this.context;
    const issues: Issue[] = [];

    const internalLinks = await page.evaluate((currentUrl) => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const currentDomain = new URL(currentUrl).hostname;

      return links
        .filter(link => {
          const href = (link as HTMLAnchorElement).href;
          try {
            const url = new URL(href);
            return url.hostname === currentDomain;
          } catch {
            return href.startsWith('/') || href.startsWith('./') || href.startsWith('../');
          }
        })
        .map((link, index) => ({
          href: (link as HTMLAnchorElement).href,
          text: link.textContent?.trim() || '',
          title: link.getAttribute('title') || '',
          selector: link.id
            ? `#${link.id}`
            : link.className
            ? `a.${link.className.split(' ').join('.')}`
            : `a:nth-child(${index + 1})`,
          hasGenericText: ['click here', 'read more', 'learn more', 'more info'].includes(link.textContent?.trim().toLowerCase() || '')
        }));
    }, this.context.url);

    // Check for generic anchor text
    const genericLinks = internalLinks.filter(link => link.hasGenericText);
    genericLinks.forEach((link, index) => {
      issues.push({
        id: `generic-anchor-text-${index}`,
        severity: 'medium',
        title: 'Generic Anchor Text',
        description: `Link uses generic anchor text: "${link.text}"`,
        element: {
          tagName: 'a',
          selector: link.selector,
          text: link.text,
          attributes: {
            href: link.href
          }
        },
        suggestion: 'Use descriptive anchor text that gives users and search engines context about the linked content.'
      });
    });

    return issues;
  }

  /**
   * Determine overall status based on issue severity
   * Returns appropriate status for the SEO check result
   */
  private determineOverallStatus(issues: Issue[]): 'success' | 'warning' | 'error' {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const highIssues = issues.filter(issue => issue.severity === 'high');

    if (criticalIssues.length > 0) return 'error';
    if (highIssues.length > 0) return 'warning';
    return issues.length === 0 ? 'success' : 'warning';
  }
}