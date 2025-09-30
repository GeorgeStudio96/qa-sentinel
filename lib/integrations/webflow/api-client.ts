/**
 * Webflow API Client using official Webflow SDK
 * Handles authenticated requests to Webflow API v2.0.0
 *
 * NOTE: ESLint no-explicit-any rule is disabled for this file because
 * official Webflow SDK TypeScript types don't match the real API responses:
 * - SDK types use Date objects, real API returns ISO strings
 * - SDK types use complex Domain objects, real API returns simple strings
 * - Our interfaces are based on actual API testing and are more accurate
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { WebflowClient } from 'webflow-api';
import type {
  WebflowSite,
  WebflowPage,
  WebflowForm,
  WebflowFormField,
  WebflowCollection,
  WebflowCollectionField,
} from './types';

/**
 * Enhanced Webflow API Client using official SDK
 */
export class WebflowApiClient {
  private webflow: WebflowClient;

  constructor(accessToken: string) {
    this.webflow = new WebflowClient({
      accessToken: accessToken
    });
  }

  /**
   * Get all sites accessible to the user
   */
  async getSites(): Promise<WebflowSite[]> {
    try {
      const response = await this.webflow.sites.list();
      return (response.sites || []).map((site: any /* Official SDK types don't match real API responses */) => ({
        // Direct mapping from real API response
        id: site.id,
        workspaceId: site.workspaceId,
        displayName: site.displayName,
        shortName: site.shortName,
        previewUrl: site.previewUrl,
        timeZone: site.timeZone,
        createdOn: site.createdOn,
        lastUpdated: site.lastUpdated,
        lastPublished: site.lastPublished,
        parentFolderId: site.parentFolderId,
        customDomains: site.customDomains || [],
        dataCollectionEnabled: site.dataCollectionEnabled,
        dataCollectionType: site.dataCollectionType,
        // Computed fields for our app
        domain: site.customDomains?.length > 0 ? site.customDomains[0] : `${site.shortName}.webflow.io`,
        locales: {
          primary: 'en', // Default since not in basic API response
          secondary: []
        }
      } as WebflowSite));
    } catch (error) {
      throw new Error(`Failed to fetch sites: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get specific site by ID
   */
  async getSite(siteId: string): Promise<WebflowSite> {
    try {
      const site: any /* Official SDK types don't match real API responses */ = await this.webflow.sites.get(siteId);
      return {
        // Direct mapping from real API response
        id: site.id,
        workspaceId: site.workspaceId,
        displayName: site.displayName,
        shortName: site.shortName,
        previewUrl: site.previewUrl,
        timeZone: site.timeZone,
        createdOn: site.createdOn,
        lastUpdated: site.lastUpdated,
        lastPublished: site.lastPublished,
        parentFolderId: site.parentFolderId,
        customDomains: site.customDomains || [],
        dataCollectionEnabled: site.dataCollectionEnabled,
        dataCollectionType: site.dataCollectionType,
        // Computed fields for our app
        domain: site.customDomains?.length > 0 ? site.customDomains[0] : `${site.shortName}.webflow.io`,
        locales: {
          primary: 'en',
          secondary: []
        }
      } as WebflowSite;
    } catch (error) {
      throw new Error(`Failed to fetch site ${siteId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all pages for a site
   */
  async getPages(siteId: string): Promise<WebflowPage[]> {
    try {
      const response = await this.webflow.pages.list(siteId);
      return (response.pages || []).map((page: any /* Official SDK types don't match real API responses */) => ({
        // Direct mapping from real API response
        id: page.id,
        siteId: page.siteId,
        title: page.title,
        slug: page.slug,
        createdOn: page.createdOn,
        lastUpdated: page.lastUpdated,
        archived: page.archived,
        draft: page.draft,
        canBranch: page.canBranch,
        isBranch: page.isBranch,
        publishedPath: page.publishedPath,
        seo: {
          title: page.seo?.title
        },
        openGraph: {
          title: page.openGraph?.title,
          titleCopied: page.openGraph?.titleCopied,
          description: page.openGraph?.description,
          descriptionCopied: page.openGraph?.descriptionCopied
        },
        // Optional fields
        parentId: page.parentId,
        localeId: page.localeId,
        lastPublished: page.lastPublished
      } as WebflowPage));
    } catch (error) {
      throw new Error(`Failed to fetch pages for site ${siteId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get specific page by ID (finds it in the pages list)
   */
  async getPage(pageId: string, siteId?: string): Promise<WebflowPage | null> {
    try {
      if (!siteId) {
        // If no siteId provided, we need to find the site first
        const sites = await this.getSites();

        for (const site of sites) {
          const pages = await this.getPages(site.id);
          const page = pages.find(p => p.id === pageId);
          if (page) {
            return page;
          }
        }
        return null;
      } else {
        const pages = await this.getPages(siteId);
        return pages.find(p => p.id === pageId) || null;
      }
    } catch (error) {
      throw new Error(`Failed to fetch page ${pageId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all forms for a site
   */
  async getForms(siteId: string): Promise<WebflowForm[]> {
    try {
      const response = await this.webflow.forms.list(siteId);
      return (response.forms || []).map((form: any /* SDK doesn't export compatible response types */) => ({
        // Direct mapping from real API response
        id: form.id,
        siteId: form.siteId,
        siteDomainId: form.siteDomainId,
        pageId: form.pageId,
        formElementId: form.formElementId,
        pageName: form.pageName,
        workspaceId: form.workspaceId,
        componentId: form.componentId,
        displayName: form.displayName,
        createdOn: form.createdOn,
        lastUpdated: form.lastUpdated,
        // Convert fields object to the expected structure
        fields: form.fields || {},
        responseSettings: form.responseSettings || {
          redirectMethod: 'GET',
          sendEmailConfirmation: false
        }
      } as WebflowForm));
    } catch (error) {
      throw new Error(`Failed to fetch forms for site ${siteId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get specific form by ID
   */
  async getForm(formId: string): Promise<WebflowForm> {
    try {
      const form: any /* SDK doesn't export compatible response types */ = await this.webflow.forms.get(formId);
      return {
        // Direct mapping from real API response
        id: form.id,
        siteId: form.siteId,
        siteDomainId: form.siteDomainId,
        pageId: form.pageId,
        formElementId: form.formElementId,
        pageName: form.pageName,
        workspaceId: form.workspaceId,
        componentId: form.componentId,
        displayName: form.displayName,
        createdOn: form.createdOn,
        lastUpdated: form.lastUpdated,
        fields: form.fields || {},
        responseSettings: form.responseSettings || {
          redirectMethod: 'GET',
          sendEmailConfirmation: false
        }
      } as WebflowForm;
    } catch (error) {
      throw new Error(`Failed to fetch form ${formId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all collections for a site
   */
  async getCollections(siteId: string): Promise<WebflowCollection[]> {
    try {
      const response = await this.webflow.collections.list(siteId);
      return (response.collections || []).map((collection: any /* SDK doesn't export compatible response types */) => ({
        id: collection.id,
        displayName: collection.displayName,
        slug: collection.slug,
        singularName: collection.singularName,
        fields: collection.fields?.map((field: any /* SDK field structure varies */) => ({
          id: field.id,
          displayName: field.displayName,
          slug: field.slug,
          type: field.type,
          isRequired: field.isRequired || false,
          editable: field.editable || false
        })) || []
      }));
    } catch (error) {
      throw new Error(`Failed to fetch collections for site ${siteId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test API connection and permissions
   */
  async testConnection(): Promise<{
    success: boolean;
    user?: { id: string; email: string; };
    sitesCount?: number;
    error?: string
  }> {
    try {
      // Test by getting user info and site count
      const sites = await this.getSites();

      return {
        success: true,
        sitesCount: sites.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}