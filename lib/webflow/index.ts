/**
 * Webflow Integration Module
 * Provides OAuth authentication and API client for Webflow
 */

import {
  WebflowOAuthClient,
  createWebflowOAuthClient as _createWebflowOAuthClient,
  type WebflowOAuthConfig,
  type WebflowTokenResponse,
  type WebflowUserInfo,
} from './oauth-client';

import {
  WebflowApiClient,
  type WebflowSite,
  type WebflowPage,
  type WebflowForm,
  type WebflowFormField,
  type WebflowCollection,
  type WebflowCollectionField,
} from './api-client';

// Re-export everything
export {
  WebflowOAuthClient,
  _createWebflowOAuthClient as createWebflowOAuthClient,
  type WebflowOAuthConfig,
  type WebflowTokenResponse,
  type WebflowUserInfo,
  WebflowApiClient,
  type WebflowSite,
  type WebflowPage,
  type WebflowForm,
  type WebflowFormField,
  type WebflowCollection,
  type WebflowCollectionField,
};

/**
 * Enhanced factory function that creates both OAuth and API clients
 */
export function createWebflowClients(redirectUri: string, accessToken?: string) {
  const oauthClient = _createWebflowOAuthClient(redirectUri);

  return {
    oauth: oauthClient,
    api: accessToken ? new WebflowApiClient(accessToken) : null,
  };
}

/**
 * Utility function to validate Webflow credentials
 */
export async function validateWebflowCredentials(): Promise<boolean> {
  const clientId = process.env.WEBFLOW_CLIENT_ID;
  const clientSecret = process.env.WEBFLOW_CLIENT_SECRET;

  return !!(clientId && clientSecret);
}