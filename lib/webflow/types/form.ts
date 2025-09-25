/**
 * Webflow Form Types
 * Based on real API response from Webflow API v2.0.0
 */

/**
 * Webflow Form Field interface based on real API response structure
 */
export interface WebflowFormField {
  displayName: string;
  type: 'Plain' | 'Email' | 'Phone' | 'Number' | 'TextArea' | 'Checkbox' | 'Radio' | 'Select' | 'MultiSelect' | 'FileUpload' | 'Date' | 'DateTime';
  userVisible: boolean;
  // Other properties may exist but not visible in our sample
  slug?: string;
  isRequired?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
}

/**
 * Webflow Form interface based on real API testing
 * Represents a form from the Webflow API with all its properties
 */
export interface WebflowForm {
  id: string;
  siteId: string;
  siteDomainId: string;
  pageId: string;
  formElementId: string;
  pageName: string;
  workspaceId: string;
  componentId: string | null;
  displayName: string;
  createdOn: string; // ISO date string
  lastUpdated: string; // ISO date string
  // Fields structure is different in real API - it's an object with field IDs as keys
  fields: Record<string, WebflowFormField>;
  responseSettings: {
    redirectMethod: string;
    sendEmailConfirmation: boolean;
  };
}