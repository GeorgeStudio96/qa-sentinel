/**
 * Webflow API Client for Fastify Backend
 * Simplified Site Token-based integration
 */

import { WebflowClient } from 'webflow-api';

export interface WebflowSiteInfo {
  id: string;
  displayName: string;
  shortName: string;
  domain: string;
  workspaceId: string;
  createdOn: string;
  lastUpdated: string;
  publishedOn?: string;
  customDomains: string[];
  previewUrl: string;
  timezone: string;
  locales: {
    primary: string;
    secondary: string[];
  };
}

export interface WebflowPageInfo {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  parentId?: string;
  localeId: string;
  createdOn: string;
  lastUpdated: string;
  lastPublished?: string;
  canBranch: boolean;
  seo: {
    title?: string;
    description?: string;
  };
  openGraph: {
    title?: string;
    titleCopied?: boolean;
    description?: string;
    descriptionCopied?: boolean;
  };
}

export interface SiteAnalysisRequest {
  siteToken: string;
  siteId?: string; // Optional if token is site-specific
  analysisOptions: {
    includePages: boolean;
    includeForms: boolean;
    includeCollections: boolean;
    performanceChecks: boolean;
    accessibilityChecks: boolean;
    seoChecks: boolean;
  };
}

export interface SiteAnalysisResult {
  siteInfo: WebflowSiteInfo;
  pages: WebflowPageInfo[];
  totalPages: number;
  analysisStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  issues: {
    performance: any[];
    accessibility: any[];
    seo: any[];
    broken_links: any[];
  };
  metadata: {
    analyzedAt: string;
    duration: number;
    tokensUsed: number;
  };
}

/**
 * Fastify-optimized Webflow API Client
 */
export class WebflowApiClient {
  private webflow: WebflowClient;
  private siteToken: string;

  constructor(siteToken: string) {
    this.siteToken = siteToken;
    this.webflow = new WebflowClient({
      accessToken: siteToken
    });
  }

  /**
   * Test Site Token validity and get site info
   */
  async validateSiteToken(): Promise<{
    valid: boolean;
    siteInfo?: WebflowSiteInfo;
    error?: string;
  }> {
    try {
      // Site tokens should give access to specific site
      // Try to get sites list to validate token
      const response = await this.webflow.sites.list();
      const sites = (response.sites || []);

      if (sites.length === 0) {
        return {
          valid: false,
          error: 'No sites accessible with this token'
        };
      }

      // Site token usually gives access to one site
      const site: any = sites[0];
      const siteInfo: WebflowSiteInfo = {
        id: site.id,
        displayName: site.displayName,
        shortName: site.shortName,
        domain: site.defaultDomain || site.domain,
        workspaceId: site.workspaceId,
        createdOn: site.createdOn,
        lastUpdated: site.lastUpdated,
        publishedOn: site.lastPublished,
        customDomains: site.customDomains || [],
        previewUrl: site.previewUrl || `https://${site.shortName}.webflow.io`,
        timezone: site.timeZone || 'UTC',
        locales: {
          primary: site.locales?.primary?.id || 'en',
          secondary: site.locales?.secondary?.map((l: any) => l.id) || []
        }
      };

      return {
        valid: true,
        siteInfo
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
  async getSiteInfo(siteId?: string): Promise<WebflowSiteInfo> {
    try {
      if (siteId) {
        const site: any = await this.webflow.sites.get(siteId);
        return {
          id: site.id,
          displayName: site.displayName,
          shortName: site.shortName,
          domain: site.defaultDomain || site.domain,
          workspaceId: site.workspaceId,
          createdOn: site.createdOn,
          lastUpdated: site.lastUpdated,
          publishedOn: site.lastPublished,
          customDomains: site.customDomains || [],
          previewUrl: site.previewUrl || `https://${site.shortName}.webflow.io`,
          timezone: site.timeZone || 'UTC',
          locales: {
            primary: site.locales?.primary?.id || 'en',
            secondary: site.locales?.secondary?.map((l: any) => l.id) || []
          }
        };
      } else {
        // Get first available site for site token
        const response = await this.webflow.sites.list();
        const sites = (response.sites || []);
        if (sites.length === 0) {
          throw new Error('No sites accessible with this token');
        }
        const site: any = sites[0];
        return {
          id: site.id,
          displayName: site.displayName,
          shortName: site.shortName,
          domain: site.defaultDomain || site.domain,
          workspaceId: site.workspaceId,
          createdOn: site.createdOn,
          lastUpdated: site.lastUpdated,
          publishedOn: site.lastPublished,
          customDomains: site.customDomains || [],
          previewUrl: site.previewUrl || `https://${site.shortName}.webflow.io`,
          timezone: site.timeZone || 'UTC',
          locales: {
            primary: site.locales?.primary?.id || 'en',
            secondary: site.locales?.secondary?.map((l: any) => l.id) || []
          }
        };
      }
    } catch (error) {
      throw new Error(`Failed to get site info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all pages for the site
   */
  async getSitePages(siteId: string): Promise<WebflowPageInfo[]> {
    try {
      const response = await this.webflow.pages.list(siteId);
      return (response.pages || []).map((page: any) => ({
        id: page.id,
        siteId: page.siteId,
        title: page.title,
        slug: page.slug,
        parentId: page.parentId || undefined,
        localeId: page.localeId,
        createdOn: page.createdOn,
        lastUpdated: page.lastUpdated,
        lastPublished: page.lastPublished,
        canBranch: page.canBranch,
        seo: {
          title: page.seo?.title,
          description: page.seo?.description
        },
        openGraph: {
          title: page.openGraph?.title,
          titleCopied: page.openGraph?.titleCopied,
          description: page.openGraph?.description,
          descriptionCopied: page.openGraph?.descriptionCopied
        }
      }));
    } catch (error) {
      throw new Error(`Failed to get site pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get page URLs for QA scanning
   */
  async getPageUrls(siteId: string): Promise<string[]> {
    try {
      const siteInfo = await this.getSiteInfo(siteId);
      const pages = await this.getSitePages(siteId);

      const baseUrl = siteInfo.domain.startsWith('http')
        ? siteInfo.domain
        : `https://${siteInfo.domain}`;

      return pages.map(page => {
        const slug = page.slug === 'index' ? '' : page.slug;
        return `${baseUrl}/${slug}`.replace(/\/+$/, '') || baseUrl;
      });
    } catch (error) {
      throw new Error(`Failed to get page URLs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Factory function to create API client with Site Token
 */
export function createWebflowClient(siteToken: string): WebflowApiClient {
  if (!siteToken) {
    throw new Error('Site token is required');
  }

  return new WebflowApiClient(siteToken);
}

/**
 * Validate Site Token format
 */
export function validateSiteTokenFormat(token: string): boolean {
  // Webflow site tokens are typically 64+ character alphanumeric strings
  return /^[a-zA-Z0-9]{40,}$/.test(token);
}