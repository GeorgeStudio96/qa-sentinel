/**
 * Webflow OAuth 2.0 Client
 * Handles authentication flow with Webflow API
 */

export interface WebflowOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  state?: string;
}

export interface WebflowTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  scope: string;
  user_id: string;
  user_email: string;
}

export interface WebflowUserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export class WebflowOAuthClient {
  private config: WebflowOAuthConfig;

  // Webflow OAuth endpoints
  private static readonly AUTHORIZATION_URL = 'https://webflow.com/oauth/authorize';
  private static readonly TOKEN_URL = 'https://api.webflow.com/oauth/access_token';
  private static readonly REVOKE_URL = 'https://webflow.com/oauth/revoke_authorization';
  private static readonly USER_INFO_URL = 'https://api.webflow.com/v2/token/authorized-by';

  // Required scopes for site access
  private static readonly DEFAULT_SCOPES = [
    'sites:read',
    'forms:read',
    'cms:read'
  ];

  constructor(config: WebflowOAuthConfig) {
    this.config = config;
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  getAuthorizationUrl(scopes?: string[]): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: (scopes || WebflowOAuthClient.DEFAULT_SCOPES).join(' '),
      ...(this.config.state && { state: this.config.state })
    });

    return `${WebflowOAuthClient.AUTHORIZATION_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<WebflowTokenResponse> {
    const response = await fetch(WebflowOAuthClient.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for token: ${error}`);
    }

    return response.json();
  }

  /**
   * Get user information using access token
   */
  async getUserInfo(accessToken: string): Promise<WebflowUserInfo> {
    const response = await fetch(WebflowOAuthClient.USER_INFO_URL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get user info: ${error}`);
    }

    return response.json();
  }

  /**
   * Revoke access token
   */
  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch(WebflowOAuthClient.REVOKE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        token: accessToken,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to revoke token: ${error}`);
    }
  }

  /**
   * Validate state parameter to prevent CSRF attacks
   */
  static validateState(receivedState: string, expectedState: string): boolean {
    return receivedState === expectedState;
  }

  /**
   * Generate secure random state for CSRF protection
   */
  static generateState(): string {
    return crypto.randomUUID();
  }
}

/**
 * Factory function to create OAuth client from environment variables
 */
export function createWebflowOAuthClient(redirectUri: string, state?: string): WebflowOAuthClient {
  const clientId = process.env.WEBFLOW_CLIENT_ID;
  const clientSecret = process.env.WEBFLOW_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('WEBFLOW_CLIENT_ID and WEBFLOW_CLIENT_SECRET must be set in environment variables');
  }

  return new WebflowOAuthClient({
    clientId,
    clientSecret,
    redirectUri,
    state,
  });
}