/**
 * Webflow API Client using official Webflow SDK
 * Handles authenticated requests to Webflow API v2.0.0
 */

import { WebflowClient } from 'webflow-api';

export interface WebflowSite {
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

export interface WebflowPage {
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

export interface WebflowForm {
  id: string;
  siteId: string;
  name: string;
  pageId?: string;
  workspaceId: string;
  fields: WebflowFormField[];
}

export interface WebflowFormField {
  id: string;
  displayName: string;
  slug: string;
  type: 'PlainText' | 'Email' | 'Phone' | 'Number' | 'TextArea' | 'Checkbox' | 'Radio' | 'Select' | 'MultiSelect' | 'FileUpload' | 'Date' | 'DateTime';
  isRequired: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
}

export interface WebflowCollection {
  id: string;
  displayName: string;
  slug: string;
  singularName: string;
  fields: WebflowCollectionField[];
}

export interface WebflowCollectionField {
  id: string;
  displayName: string;
  slug: string;
  type: string;
  isRequired: boolean;
  editable: boolean;
}

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
      return (response.sites || []).map((site: any) => ({
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
      }));
    } catch (error) {
      throw new Error(`Failed to fetch sites: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get specific site by ID
   */
  async getSite(siteId: string): Promise<WebflowSite> {
    try {
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
      return (response.forms || []).map((form: any) => ({
        id: form.id,
        siteId: form.siteId,
        name: form.name,
        pageId: form.pageId || undefined,
        workspaceId: form.workspaceId,
        fields: form.fields?.map((field: any) => ({
          id: field.id,
          displayName: field.displayName,
          slug: field.slug,
          type: field.type as WebflowFormField['type'],
          isRequired: field.isRequired,
          placeholder: field.placeholder,
          helpText: field.helpText,
          options: field.options
        })) || []
      }));
    } catch (error) {
      throw new Error(`Failed to fetch forms for site ${siteId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get specific form by ID
   */
  async getForm(formId: string): Promise<WebflowForm> {
    try {
      const form: any = await this.webflow.forms.get(formId);
      return {
        id: form.id,
        siteId: form.siteId,
        name: form.name,
        pageId: form.pageId || undefined,
        workspaceId: form.workspaceId,
        fields: form.fields?.map((field: any) => ({
          id: field.id,
          displayName: field.displayName,
          slug: field.slug,
          type: field.type as WebflowFormField['type'],
          isRequired: field.isRequired,
          placeholder: field.placeholder,
          helpText: field.helpText,
          options: field.options
        })) || []
      };
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
      return (response.collections || []).map((collection: any) => ({
        id: collection.id,
        displayName: collection.displayName,
        slug: collection.slug,
        singularName: collection.singularName,
        fields: collection.fields?.map((field: any) => ({
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
    user?: any;
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