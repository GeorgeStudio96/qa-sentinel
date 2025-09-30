/**
 * Webflow Site Types
 * Based on real API response from Webflow API v2.0.0
 */

/**
 * Webflow Site interface based on real API testing
 * Represents a site from the Webflow API with all its properties
 */
export interface WebflowSite {
  id: string;
  workspaceId: string;
  displayName: string;
  shortName: string;
  previewUrl: string;
  timeZone: string;
  createdOn: string; // ISO date string
  lastUpdated: string; // ISO date string
  lastPublished?: string; // ISO date string
  parentFolderId?: string;
  customDomains: string[]; // Array of custom domain strings
  dataCollectionEnabled: boolean;
  dataCollectionType: string;
  // Computed fields for our app
  domain?: string; // We'll derive this from customDomains or shortName
  locales?: {
    primary: string;
    secondary: string[];
  };
}