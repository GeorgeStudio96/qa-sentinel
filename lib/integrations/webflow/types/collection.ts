/**
 * Webflow Collection Types
 * Based on real API response from Webflow API v2.0.0
 */

/**
 * Webflow Collection Field interface
 */
export interface WebflowCollectionField {
  id: string;
  displayName: string;
  slug: string;
  type: string;
  isRequired: boolean;
  editable: boolean;
}

/**
 * Webflow Collection interface
 * Represents a CMS collection from the Webflow API
 */
export interface WebflowCollection {
  id: string;
  displayName: string;
  slug: string;
  singularName: string;
  fields: WebflowCollectionField[];
}