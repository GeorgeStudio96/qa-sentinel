/**
 * Webflow API Client for v2.0.0
 * Handles authenticated requests to Webflow API
 */

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
  pageId: string;
  workflowId?: string;
  createdOn: string;
  fields: WebflowFormField[];
}

export interface WebflowFormField {
  id: string;
  name: string;
  type: string;
  slug: string;
  required: boolean;
  editable: boolean;
}

export interface WebflowCollection {
  id: string;
  displayName: string;
  singularName: string;
  slug: string;
  siteId: string;
  lastUpdated: string;
  createdOn: string;
  fields: WebflowCollectionField[];
}

export interface WebflowCollectionField {
  id: string;
  displayName: string;
  slug: string;
  type: string;
  required: boolean;
  editable: boolean;
  isMultiReference?: boolean;
}

export class WebflowApiClient {
  private accessToken: string;
  private baseUrl = 'https://api.webflow.com/v2';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Make authenticated request to Webflow API
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Webflow API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Get all sites accessible to the user
   */
  async getSites(): Promise<WebflowSite[]> {
    const response = await this.makeRequest<{ sites: WebflowSite[] }>('/sites');
    return response.sites;
  }

  /**
   * Get specific site by ID
   */
  async getSite(siteId: string): Promise<WebflowSite> {
    return this.makeRequest<WebflowSite>(`/sites/${siteId}`);
  }

  /**
   * Get all pages for a site
   */
  async getPages(siteId: string): Promise<WebflowPage[]> {
    const response = await this.makeRequest<{ pages: WebflowPage[] }>(`/sites/${siteId}/pages`);
    return response.pages;
  }

  /**
   * Get specific page by ID
   */
  async getPage(pageId: string): Promise<WebflowPage> {
    return this.makeRequest<WebflowPage>(`/pages/${pageId}`);
  }

  /**
   * Get all forms for a site
   */
  async getForms(siteId: string): Promise<WebflowForm[]> {
    const response = await this.makeRequest<{ forms: WebflowForm[] }>(`/sites/${siteId}/forms`);
    return response.forms;
  }

  /**
   * Get specific form by ID
   */
  async getForm(formId: string): Promise<WebflowForm> {
    return this.makeRequest<WebflowForm>(`/forms/${formId}`);
  }

  /**
   * Get all collections for a site
   */
  async getCollections(siteId: string): Promise<WebflowCollection[]> {
    const response = await this.makeRequest<{ collections: WebflowCollection[] }>(`/sites/${siteId}/collections`);
    return response.collections;
  }

  /**
   * Get specific collection by ID
   */
  async getCollection(collectionId: string): Promise<WebflowCollection> {
    return this.makeRequest<WebflowCollection>(`/collections/${collectionId}`);
  }

  /**
   * Get items from a collection with pagination
   */
  async getCollectionItems(collectionId: string, offset = 0, limit = 100): Promise<Record<string, unknown>[]> {
    const response = await this.makeRequest<{ items: Record<string, unknown>[] }>(
      `/collections/${collectionId}/items?offset=${offset}&limit=${limit}`
    );
    return response.items;
  }

  /**
   * Get current user information
   */
  async getUser(): Promise<Record<string, unknown>> {
    return this.makeRequest<Record<string, unknown>>('/user');
  }

  /**
   * Test API connection and validate token
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getUser();
      return true;
    } catch (error) {
      console.error('Webflow API connection test failed:', error);
      return false;
    }
  }

  /**
   * Get site domain URLs for scanning
   */
  async getSiteDomains(siteId: string): Promise<string[]> {
    const site = await this.getSite(siteId);
    const domains = [site.domain, ...site.customDomains];

    // Add preview URL for staging testing
    if (site.previewUrl) {
      domains.push(site.previewUrl);
    }

    return domains.filter(Boolean);
  }

  /**
   * Get all page URLs for a site for comprehensive scanning
   */
  async getSitePageUrls(siteId: string): Promise<string[]> {
    const [site, pages] = await Promise.all([
      this.getSite(siteId),
      this.getPages(siteId)
    ]);

    const baseUrl = `https://${site.domain}`;

    return pages.map(page => {
      // Handle root page
      if (page.slug === 'index' || page.slug === '') {
        return baseUrl;
      }

      // Handle nested pages
      return `${baseUrl}/${page.slug}`;
    });
  }

  /**
   * Get form testing data for automated form submissions
   */
  async getFormTestingData(siteId: string): Promise<Array<{
    formId: string;
    name: string;
    pageUrl: string;
    fields: WebflowFormField[];
  }>> {
    const [forms, pages] = await Promise.all([
      this.getForms(siteId),
      this.getPages(siteId)
    ]);

    const site = await this.getSite(siteId);
    const baseUrl = `https://${site.domain}`;

    return forms.map(form => {
      const page = pages.find(p => p.id === form.pageId);
      const pageUrl = page ? `${baseUrl}/${page.slug}` : baseUrl;

      return {
        formId: form.id,
        name: form.name,
        pageUrl,
        fields: form.fields,
      };
    });
  }
}