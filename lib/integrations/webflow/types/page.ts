/**
 * Webflow Page Types
 * Based on real API response from Webflow API v2.0.0
 */

/**
 * Webflow Page interface based on real API testing
 * Represents a page from the Webflow API with all its properties
 */
export interface WebflowPage {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  createdOn: string; // ISO date string
  lastUpdated: string; // ISO date string
  archived: boolean;
  draft: boolean;
  canBranch: boolean;
  isBranch: boolean;
  publishedPath: string;
  seo: {
    title?: string;
    // Note: description not always present in real API
  };
  openGraph: {
    title?: string;
    titleCopied?: boolean;
    description?: string;
    descriptionCopied?: boolean;
  };
  // Optional fields that may appear
  parentId?: string;
  localeId?: string;
  lastPublished?: string;
}