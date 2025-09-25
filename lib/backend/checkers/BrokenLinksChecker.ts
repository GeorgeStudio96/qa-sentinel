import { createLogger } from '../utils/logger';
import {
  BaseChecker,
  CheckerResult,
  CheckerContext,
  BrokenLinksConfig,
  LinkCheckResult,
  LinkContext,
  ElementInfo,
  Issue
} from './types';

const logger = createLogger('BrokenLinksChecker');

/**
 * BrokenLinksChecker - Comprehensive link analysis module
 *
 * This checker analyzes ALL links on a page (no limits) and provides
 * detailed reports about broken, empty, and problematic links.
 *
 * Features:
 * - Checks every link found on the page
 * - Detects empty href attributes
 * - Identifies link context (navigation, content, footer)
 * - Uses efficient HTTP requests instead of full page loads
 * - Provides actionable suggestions for fixes
 */
export class BrokenLinksChecker implements BaseChecker {
  private context: CheckerContext;
  private config: BrokenLinksConfig;

  constructor(context: CheckerContext, config: BrokenLinksConfig = {}) {
    this.context = context;
    this.config = {
      timeout: 10000,
      followRedirects: true,
      checkExternalLinks: true,
      ignoreFragments: true,
      ...config
    };
  }

  /**
   * Main check method - analyzes all links on the page
   * Returns detailed report with issues and metadata
   */
  async check(): Promise<CheckerResult> {
    const startTime = Date.now();
    logger.info(`Starting broken links check for ${this.context.url}`);

    try {
      // Step 1: Extract all links from the page
      const allLinks = await this.extractAllLinks();
      logger.info(`Found ${allLinks.length} links to analyze`);

      // Step 2: Check each link's validity
      const linkResults = await this.checkAllLinks(allLinks);

      // Step 3: Generate issues from results
      const issues = this.generateIssues(linkResults);

      // Step 4: Create result with metadata
      const result: CheckerResult = {
        type: 'broken-links',
        status: issues.length === 0 ? 'success' : 'warning',
        issues,
        metadata: {
          checkedAt: new Date().toISOString(),
          duration: Date.now() - startTime,
          elementsChecked: allLinks.length,
          url: this.context.url,
          viewport: this.context.viewport
        }
      };

      logger.info(`Links check completed: ${issues.length} issues found`);
      return result;

    } catch (error) {
      logger.error('Failed to check links:', error);
      throw error;
    }
  }

  /**
   * Extract all links from the current page
   * Gets href, text, position, and context for each link
   */
  private async extractAllLinks(): Promise<Array<{
    url: string;
    element: ElementInfo;
    context: LinkContext;
  }>> {
    const { page } = this.context;

    return await page.evaluate(() => {
      // Find all anchor elements with or without href
      const anchors = Array.from(document.querySelectorAll('a'));

      return anchors.map((anchor, index) => {
        const href = anchor.getAttribute('href') || '';
        const text = anchor.textContent?.trim() || '';
        const ariaLabel = anchor.getAttribute('aria-label') || undefined;

        // Determine element selector for debugging
        const selector = anchor.id
          ? `#${anchor.id}`
          : anchor.className
          ? `a.${anchor.className.split(' ').join('.')}`
          : `a:nth-child(${index + 1})`;

        // Get element position
        const rect = anchor.getBoundingClientRect();

        // Determine link context (what section it's in)
        const section = this.determineLinkSection(anchor);

        // Classify link type
        const linkType = this.classifyLinkType(href);

        return {
          url: href,
          element: {
            tagName: 'a',
            selector,
            text,
            attributes: {
              href: href,
              'aria-label': ariaLabel || '',
              target: anchor.getAttribute('target') || ''
            },
            position: {
              x: rect.left,
              y: rect.top
            }
          },
          context: {
            section,
            linkType,
            isEmpty: !href || href.trim() === '',
            text,
            ariaLabel
          }
        };
      });

      // Helper function to determine which section the link is in
      function determineLinkSection(element: HTMLAnchorElement): string {
        let current = element.parentElement;

        while (current) {
          const tagName = current.tagName.toLowerCase();
          const className = current.className.toLowerCase();
          const id = current.id.toLowerCase();

          // Check for semantic HTML5 elements
          if (['nav', 'header', 'footer', 'main', 'aside'].includes(tagName)) {
            return tagName;
          }

          // Check for common CSS classes
          if (className.includes('nav') || className.includes('menu')) {
            return 'navigation';
          }
          if (className.includes('header')) {
            return 'header';
          }
          if (className.includes('footer')) {
            return 'footer';
          }
          if (className.includes('sidebar') || className.includes('aside')) {
            return 'sidebar';
          }

          // Check for common IDs
          if (id.includes('nav') || id.includes('menu')) {
            return 'navigation';
          }
          if (id.includes('header')) {
            return 'header';
          }
          if (id.includes('footer')) {
            return 'footer';
          }

          current = current.parentElement;
        }

        return 'content'; // Default section
      }

      // Helper function to classify link type
      function classifyLinkType(href: string): 'internal' | 'external' | 'email' | 'tel' | 'fragment' {
        if (!href) return 'internal';

        if (href.startsWith('mailto:')) return 'email';
        if (href.startsWith('tel:')) return 'tel';
        if (href.startsWith('#')) return 'fragment';
        if (href.startsWith('http') && !href.includes(window.location.hostname)) {
          return 'external';
        }

        return 'internal';
      }
    });
  }

  /**
   * Check validity of all extracted links
   * Uses efficient HTTP requests instead of full page loads
   */
  private async checkAllLinks(links: Array<{
    url: string;
    element: ElementInfo;
    context: LinkContext;
  }>): Promise<LinkCheckResult[]> {
    const results: LinkCheckResult[] = [];

    // Filter links based on configuration
    const linksToCheck = links.filter(link => {
      // Skip fragment links if configured
      if (this.config.ignoreFragments && link.context.linkType === 'fragment') {
        return false;
      }

      // Skip external links if configured
      if (!this.config.checkExternalLinks && link.context.linkType === 'external') {
        return false;
      }

      return true;
    });

    logger.info(`Checking ${linksToCheck.length} links (${links.length - linksToCheck.length} skipped by config)`);

    // Check links in parallel batches to avoid overwhelming the server
    const batchSize = 10;
    for (let i = 0; i < linksToCheck.length; i += batchSize) {
      const batch = linksToCheck.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(link => this.checkSingleLink(link))
      );
      results.push(...batchResults);

      // Small delay between batches to be respectful
      if (i + batchSize < linksToCheck.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Check a single link's validity
   * Handles different link types appropriately
   */
  private async checkSingleLink(link: {
    url: string;
    element: ElementInfo;
    context: LinkContext;
  }): Promise<LinkCheckResult> {
    const startTime = Date.now();

    try {
      // Handle empty links
      if (link.context.isEmpty) {
        return {
          url: link.url,
          status: 'empty',
          element: link.element,
          context: link.context,
          responseTime: Date.now() - startTime
        };
      }

      // Handle special link types that don't need HTTP checks
      if (['email', 'tel', 'fragment'].includes(link.context.linkType)) {
        return {
          url: link.url,
          status: 'ok',
          element: link.element,
          context: link.context,
          responseTime: Date.now() - startTime
        };
      }

      // For HTTP(S) links, make actual request
      const response = await this.makeHttpRequest(link.url);

      return {
        url: link.url,
        status: response.status >= 400 ? 'broken' : 'ok',
        httpStatus: response.status,
        responseTime: Date.now() - startTime,
        redirectUrl: response.redirected ? response.url : undefined,
        element: link.element,
        context: link.context
      };

    } catch (error) {
      return {
        url: link.url,
        status: 'broken',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime,
        element: link.element,
        context: link.context
      };
    }
  }

  /**
   * Make HTTP request to check link validity
   * Uses fetch with proper timeout and redirect handling
   */
  private async makeHttpRequest(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'HEAD', // Use HEAD to avoid downloading full content
        signal: controller.signal,
        redirect: this.config.followRedirects ? 'follow' : 'manual'
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Generate actionable issues from link check results
   * Creates detailed reports with suggestions for fixes
   */
  private generateIssues(results: LinkCheckResult[]): Issue[] {
    const issues: Issue[] = [];
    let issueCounter = 1;

    for (const result of results) {
      if (result.status === 'broken') {
        issues.push({
          id: `broken-link-${issueCounter++}`,
          severity: result.httpStatus === 404 ? 'high' : 'medium',
          title: `Broken Link Detected`,
          description: `Link "${result.url}" is not accessible (${result.httpStatus || 'connection failed'})`,
          element: result.element,
          url: result.url,
          suggestion: result.httpStatus === 404
            ? 'Update or remove this link. Check if the target page has moved.'
            : 'Check if the target server is accessible and the URL is correct.'
        });
      }

      if (result.status === 'empty') {
        issues.push({
          id: `empty-link-${issueCounter++}`,
          severity: 'medium',
          title: 'Empty Link Found',
          description: `Link element has empty or missing href attribute`,
          element: result.element,
          suggestion: `Add a valid href attribute or remove the link element if not needed. Found in ${result.context.section} section.`
        });
      }
    }

    // Generate summary statistics
    const stats = this.generateStatistics(results);
    if (stats.emptyLinksCount > 0 || stats.brokenLinksCount > 0) {
      issues.unshift({
        id: 'links-summary',
        severity: 'low',
        title: 'Links Analysis Summary',
        description: `Found ${stats.totalLinks} links: ${stats.brokenLinksCount} broken, ${stats.emptyLinksCount} empty, ${stats.workingLinksCount} working`,
        suggestion: 'Review all broken and empty links below for specific fix suggestions.'
      });
    }

    return issues;
  }

  /**
   * Generate statistics about checked links
   * Provides overview of link health on the page
   */
  private generateStatistics(results: LinkCheckResult[]) {
    return {
      totalLinks: results.length,
      workingLinksCount: results.filter(r => r.status === 'ok').length,
      brokenLinksCount: results.filter(r => r.status === 'broken').length,
      emptyLinksCount: results.filter(r => r.status === 'empty').length,
      externalLinksCount: results.filter(r => r.context.linkType === 'external').length,
      internalLinksCount: results.filter(r => r.context.linkType === 'internal').length
    };
  }

  /**
   * Determine which section of the page a link belongs to
   * Helps classify the importance and context of the link
   */
  private determineLinkSection(element: Element): string {
    let current = element.parentElement;

    while (current) {
      const className = current.className?.toLowerCase() || '';
      const tagName = current.tagName?.toLowerCase() || '';

      // Check for common section identifiers
      if (tagName === 'nav' || className.includes('nav')) return 'navigation';
      if (tagName === 'header' || className.includes('header')) return 'header';
      if (tagName === 'footer' || className.includes('footer')) return 'footer';
      if (tagName === 'aside' || className.includes('sidebar')) return 'sidebar';
      if (className.includes('menu')) return 'menu';
      if (className.includes('breadcrumb')) return 'breadcrumb';

      current = current.parentElement;
    }

    return 'content';
  }

  /**
   * Classify the type of link (internal, external, email, etc.)
   * Helps determine appropriate checking strategies
   */
  private classifyLinkType(href: string): string {
    if (!href) return 'empty';

    const url = href.toLowerCase().trim();

    if (url.startsWith('mailto:')) return 'email';
    if (url.startsWith('tel:')) return 'phone';
    if (url.startsWith('#')) return 'anchor';
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return 'internal';

    // Check if it's the same domain
    try {
      const linkUrl = new URL(href, window.location.origin);
      return linkUrl.hostname === window.location.hostname ? 'internal' : 'external';
    } catch {
      return 'unknown';
    }
  }
}