/**
 * Fastify Webflow Integration Client
 * Lightweight wrapper around main WebflowApiClient with Site Token validation
 */

import { WebflowApiClient } from '../../webflow/api-client';
import type {
  WebflowSite,
  WebflowPage,
  SiteTokenValidationResult,
} from '../../webflow/types';

/**
 * Factory function to create WebflowApiClient with Site Token
 */
export function createWebflowClient(siteToken: string): WebflowApiClient {
  if (!siteToken) {
    throw new Error('Site token is required');
  }

  return new WebflowApiClient(siteToken);
}

/**
 * Validate Site Token format (basic format check)
 */
export function validateSiteTokenFormat(token: string): boolean {
  // Basic validation - check it's a reasonable length hex string
  return typeof token === 'string' && token.length > 32 && /^[a-f0-9]+$/.test(token);
}

/**
 * Enhanced wrapper for Fastify-specific operations
 */
export class FastifyWebflowClient {
  private apiClient: WebflowApiClient;

  constructor(siteToken: string) {
    this.apiClient = new WebflowApiClient(siteToken);
  }

  /**
   * Validate Site Token and get site info
   */
  async validateSiteToken(): Promise<SiteTokenValidationResult> {
    try {
      const connectionTest = await this.apiClient.testConnection();

      if (!connectionTest.success) {
        return {
          valid: false,
          error: connectionTest.error || 'Connection test failed'
        };
      }

      // Get the first site as siteInfo
      const sites = await this.apiClient.getSites();
      if (sites.length === 0) {
        return {
          valid: false,
          error: 'No sites accessible with this token'
        };
      }

      return {
        valid: true,
        siteInfo: sites[0]
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get site information
   */
  async getSiteInfo(siteId?: string): Promise<WebflowSite> {
    if (siteId) {
      return this.apiClient.getSite(siteId);
    } else {
      // Get first available site for site token
      const sites = await this.apiClient.getSites();
      if (sites.length === 0) {
        throw new Error('No sites accessible with this token');
      }
      return sites[0];
    }
  }

  /**
   * Get all pages for the site
   */
  async getSitePages(siteId: string): Promise<WebflowPage[]> {
    return this.apiClient.getPages(siteId);
  }

  /**
   * Get page URLs for QA scanning
   */
  async getPageUrls(siteId: string): Promise<string[]> {
    try {
      const siteInfo = await this.getSiteInfo(siteId);
      const pages = await this.getSitePages(siteId);

      // Use computed domain from WebflowSite
      const baseUrl = siteInfo.domain || `${siteInfo.shortName}.webflow.io`;
      const protocol = baseUrl.includes('webflow.io') ? 'https://' : 'https://';

      return pages
        .filter(page => !page.archived && !page.draft) // Only include published pages
        .map(page => {
          const slug = page.slug === 'index' ? '' : page.slug;
          const url = `${protocol}${baseUrl}/${slug}`.replace(/\/+$/, '');
          return url || `${protocol}${baseUrl}`;
        });
    } catch (error) {
      throw new Error(`Failed to get page URLs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}