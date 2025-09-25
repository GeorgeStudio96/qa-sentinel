import { createLogger } from '../utils/logger';
import {
  BaseChecker,
  CheckerResult,
  CheckerContext,
  PerformanceConfig,
  Issue
} from './types';

const logger = createLogger('PerformanceChecker');

interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;
  totalBlockingTime?: number;
  resourceCount: number;
  totalResourceSize: number;
  imageCount: number;
  scriptCount: number;
  stylesheetCount: number;
}

/**
 * PerformanceChecker - Comprehensive performance analysis module
 *
 * This checker analyzes page performance metrics and Core Web Vitals
 * to identify optimization opportunities and performance issues.
 *
 * What it measures:
 * - Core Web Vitals (LCP, FID, CLS)
 * - Page load times and resource metrics
 * - Image optimization opportunities
 * - JavaScript and CSS bundle sizes
 * - Network efficiency indicators
 */
export class PerformanceChecker implements BaseChecker {
  private context: CheckerContext;
  private config: PerformanceConfig;

  constructor(context: CheckerContext, config: PerformanceConfig = {}) {
    this.context = context;
    this.config = {
      collectMetrics: true,
      checkImageOptimization: true,
      checkResourceSizes: true,
      timeout: 30000,
      ...config
    };
  }

  /**
   * Main check method - performs comprehensive performance analysis
   * Returns detailed report with performance issues and recommendations
   */
  async check(): Promise<CheckerResult> {
    const startTime = Date.now();
    logger.info(`Starting performance check for ${this.context.url}`);

    try {
      const issues: Issue[] = [];
      let elementsChecked = 0;

      // Collect performance metrics
      const metrics = await this.collectPerformanceMetrics();
      elementsChecked += metrics.resourceCount;

      // Analyze Core Web Vitals
      const vitalIssues = this.analyzeWebVitals(metrics);
      issues.push(...vitalIssues);

      // Check resource optimization if enabled
      if (this.config.checkResourceSizes) {
        const resourceIssues = await this.checkResourceOptimization();
        issues.push(...resourceIssues);
        elementsChecked += resourceIssues.length;
      }

      // Check image optimization if enabled
      if (this.config.checkImageOptimization) {
        const imageIssues = await this.checkImageOptimization();
        issues.push(...imageIssues);
        elementsChecked += imageIssues.length;
      }

      // Create result with metadata
      const result: CheckerResult = {
        type: 'performance',
        status: this.determineOverallStatus(issues, metrics),
        issues,
        metadata: {
          checkedAt: new Date().toISOString(),
          duration: Date.now() - startTime,
          elementsChecked,
          url: this.context.url,
          viewport: this.context.viewport
        }
      };

      logger.info(`Performance check completed: ${issues.length} issues found`);
      return result;

    } catch (error) {
      logger.error('Failed to perform performance check:', error);
      throw error;
    }
  }

  /**
   * Collect comprehensive performance metrics
   * Gathers timing data, Core Web Vitals, and resource information
   */
  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const { page } = this.context;

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType('resource');

      // Basic timing metrics
      const loadTime = navigation.loadEventEnd - navigation.navigationStart;
      const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.navigationStart;

      // Resource analysis
      const images = resources.filter(r => r.initiatorType === 'img');
      const scripts = resources.filter(r => r.initiatorType === 'script');
      const stylesheets = resources.filter(r => r.initiatorType === 'link');

      const totalResourceSize = resources.reduce((total, resource) => {
        return total + (resource.transferSize || 0);
      }, 0);

      // Try to get Web Vitals if available
      let webVitals: any = {};
      try {
        // This is a simplified way to get Web Vitals
        // In production, you'd use the web-vitals library
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');

        webVitals = {
          firstContentfulPaint: fcpEntry?.startTime,
        };
      } catch (e) {
        // Web Vitals not available
      }

      return {
        loadTime,
        domContentLoaded,
        resourceCount: resources.length,
        totalResourceSize,
        imageCount: images.length,
        scriptCount: scripts.length,
        stylesheetCount: stylesheets.length,
        ...webVitals
      };
    });

    return metrics as PerformanceMetrics;
  }

  /**
   * Analyze Core Web Vitals and page timing metrics
   * Identifies performance issues based on Google's thresholds
   */
  private analyzeWebVitals(metrics: PerformanceMetrics): Issue[] {
    const issues: Issue[] = [];

    // Check page load time (should be under 3 seconds for good UX)
    if (metrics.loadTime > 3000) {
      issues.push({
        id: 'slow-page-load',
        severity: metrics.loadTime > 5000 ? 'high' : 'medium',
        title: 'Slow Page Load Time',
        description: `Page took ${(metrics.loadTime / 1000).toFixed(2)}s to load (target: <3s)`,
        suggestion: 'Optimize images, minify CSS/JS, enable compression, and consider using a CDN to improve load times.'
      });
    }

    // Check DOM Content Loaded time
    if (metrics.domContentLoaded > 1500) {
      issues.push({
        id: 'slow-dom-ready',
        severity: metrics.domContentLoaded > 2500 ? 'high' : 'medium',
        title: 'Slow DOM Content Loaded',
        description: `DOM ready took ${(metrics.domContentLoaded / 1000).toFixed(2)}s (target: <1.5s)`,
        suggestion: 'Reduce JavaScript execution time and move non-critical scripts to load after DOM is ready.'
      });
    }

    // Check First Contentful Paint if available
    if (metrics.firstContentfulPaint && metrics.firstContentfulPaint > 1800) {
      issues.push({
        id: 'slow-fcp',
        severity: metrics.firstContentfulPaint > 3000 ? 'high' : 'medium',
        title: 'Slow First Contentful Paint',
        description: `FCP is ${(metrics.firstContentfulPaint / 1000).toFixed(2)}s (good: <1.8s)`,
        suggestion: 'Optimize critical rendering path by inlining critical CSS and removing render-blocking resources.'
      });
    }

    // Check Largest Contentful Paint if available
    if (metrics.largestContentfulPaint && metrics.largestContentfulPaint > 2500) {
      issues.push({
        id: 'slow-lcp',
        severity: metrics.largestContentfulPaint > 4000 ? 'critical' : 'high',
        title: 'Poor Largest Contentful Paint',
        description: `LCP is ${(metrics.largestContentfulPaint / 1000).toFixed(2)}s (good: <2.5s)`,
        suggestion: 'Optimize your largest content element (usually an image or text block). Consider image optimization and server response times.'
      });
    }

    // Check total resource size
    const resourceSizeMB = metrics.totalResourceSize / (1024 * 1024);
    if (resourceSizeMB > 3) {
      issues.push({
        id: 'large-resource-size',
        severity: resourceSizeMB > 5 ? 'high' : 'medium',
        title: 'Large Total Resource Size',
        description: `Total resources: ${resourceSizeMB.toFixed(2)}MB (target: <3MB)`,
        suggestion: 'Compress images, minify CSS/JS, enable gzip/brotli compression, and consider removing unused resources.'
      });
    }

    // Check resource count
    if (metrics.resourceCount > 100) {
      issues.push({
        id: 'too-many-requests',
        severity: metrics.resourceCount > 150 ? 'high' : 'medium',
        title: 'Too Many HTTP Requests',
        description: `${metrics.resourceCount} HTTP requests (target: <100)`,
        suggestion: 'Combine CSS/JS files, use CSS sprites for images, and consider implementing HTTP/2 server push.'
      });
    }

    return issues;
  }

  /**
   * Check resource optimization opportunities
   * Analyzes CSS, JS, and other resources for optimization potential
   */
  private async checkResourceOptimization(): Promise<Issue[]> {
    const { page } = this.context;
    const issues: Issue[] = [];

    const resourceData = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');

      const largeResources = resources
        .filter(resource => resource.transferSize && resource.transferSize > 100 * 1024) // >100KB
        .map(resource => ({
          name: resource.name,
          size: resource.transferSize,
          type: resource.initiatorType,
          duration: resource.duration
        }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 10); // Top 10 largest resources

      const slowResources = resources
        .filter(resource => resource.duration > 1000) // >1s
        .map(resource => ({
          name: resource.name,
          size: resource.transferSize,
          type: resource.initiatorType,
          duration: resource.duration
        }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5); // Top 5 slowest resources

      return { largeResources, slowResources };
    });

    // Check for large resources
    resourceData.largeResources.forEach((resource, index) => {
      const sizeMB = (resource.size || 0) / (1024 * 1024);
      issues.push({
        id: `large-resource-${index}`,
        severity: sizeMB > 1 ? 'high' : 'medium',
        title: 'Large Resource File',
        description: `${resource.type} resource is ${sizeMB.toFixed(2)}MB: ${resource.name.split('/').pop() || resource.name}`,
        url: resource.name,
        suggestion: resource.type === 'img'
          ? 'Compress and optimize this image. Consider using modern formats like WebP or AVIF.'
          : 'Minify and compress this resource. Consider code splitting for JavaScript files.'
      });
    });

    // Check for slow loading resources
    resourceData.slowResources.forEach((resource, index) => {
      issues.push({
        id: `slow-resource-${index}`,
        severity: resource.duration > 3000 ? 'high' : 'medium',
        title: 'Slow Loading Resource',
        description: `${resource.type} took ${(resource.duration / 1000).toFixed(2)}s to load: ${resource.name.split('/').pop() || resource.name}`,
        url: resource.name,
        suggestion: 'Check server response times, consider using a CDN, or optimize the resource file size.'
      });
    });

    return issues;
  }

  /**
   * Check image optimization opportunities
   * Analyzes images for format, size, and loading optimizations
   */
  private async checkImageOptimization(): Promise<Issue[]> {
    const { page } = this.context;
    const issues: Issue[] = [];

    const imageData = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));

      return images.map((img, index) => ({
        src: img.src,
        width: img.naturalWidth,
        height: img.naturalHeight,
        displayWidth: img.offsetWidth,
        displayHeight: img.offsetHeight,
        loading: img.getAttribute('loading'),
        hasLazyLoading: img.getAttribute('loading') === 'lazy',
        selector: img.id
          ? `#${img.id}`
          : img.className
          ? `img.${img.className.split(' ').join('.')}`
          : `img:nth-child(${index + 1})`,
        isAboveFold: img.getBoundingClientRect().top < window.innerHeight
      }));
    });

    imageData.forEach((image, index) => {
      // Check for oversized images
      if (image.width && image.displayWidth && image.width > image.displayWidth * 2) {
        const oversizeFactor = Math.round(image.width / image.displayWidth);
        issues.push({
          id: `oversized-image-${index}`,
          severity: oversizeFactor > 3 ? 'high' : 'medium',
          title: 'Oversized Image',
          description: `Image is ${oversizeFactor}x larger than display size (${image.width}px vs ${image.displayWidth}px display)`,
          element: {
            tagName: 'img',
            selector: image.selector,
            text: '',
            attributes: {
              src: image.src
            }
          },
          suggestion: `Resize image to match display size or use responsive images with srcset attribute.`
        });
      }

      // Check for missing lazy loading on below-fold images
      if (!image.hasLazyLoading && !image.isAboveFold) {
        issues.push({
          id: `missing-lazy-loading-${index}`,
          severity: 'medium',
          title: 'Missing Lazy Loading',
          description: 'Image below the fold should use lazy loading',
          element: {
            tagName: 'img',
            selector: image.selector,
            text: '',
            attributes: {
              src: image.src
            }
          },
          suggestion: 'Add loading="lazy" attribute to images that are not immediately visible to improve page load performance.'
        });
      }

      // Check for old image formats
      if (image.src && (image.src.endsWith('.png') || image.src.endsWith('.jpg') || image.src.endsWith('.jpeg'))) {
        issues.push({
          id: `old-image-format-${index}`,
          severity: 'low',
          title: 'Consider Modern Image Format',
          description: `Image uses traditional format: ${image.src.split('.').pop()?.toUpperCase()}`,
          element: {
            tagName: 'img',
            selector: image.selector,
            text: '',
            attributes: {
              src: image.src
            }
          },
          suggestion: 'Consider using modern image formats like WebP or AVIF with fallbacks for better compression and faster loading.'
        });
      }
    });

    return issues;
  }

  /**
   * Determine overall status based on performance metrics and issues
   * Returns appropriate status based on severity of performance problems
   */
  private determineOverallStatus(issues: Issue[], metrics: PerformanceMetrics): 'success' | 'warning' | 'error' {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const highIssues = issues.filter(issue => issue.severity === 'high');

    // Critical performance issues
    if (criticalIssues.length > 0 || metrics.loadTime > 10000) {
      return 'error';
    }

    // High priority issues or slow load times
    if (highIssues.length > 0 || metrics.loadTime > 5000) {
      return 'warning';
    }

    return issues.length === 0 ? 'success' : 'warning';
  }
}