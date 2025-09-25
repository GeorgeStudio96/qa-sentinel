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

import { WebflowApiClient } from './api-client';

// Import unified types from types directory
import type {
  WebflowSite,
  WebflowPage,
  WebflowForm,
  WebflowFormField,
  WebflowCollection,
  WebflowCollectionField,
  SiteAnalysisRequest,
  SiteAnalysisResult,
  SiteTokenValidationResult,
} from './types';

// Re-export everything
export {
  // OAuth client
  WebflowOAuthClient,
  _createWebflowOAuthClient as createWebflowOAuthClient,
  type WebflowOAuthConfig,
  type WebflowTokenResponse,
  type WebflowUserInfo,
  // API client
  WebflowApiClient,
  // Unified types
  type WebflowSite,
  type WebflowPage,
  type WebflowForm,
  type WebflowFormField,
  type WebflowCollection,
  type WebflowCollectionField,
  // API types
  type SiteAnalysisRequest,
  type SiteAnalysisResult,
  type SiteTokenValidationResult,
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