import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Webflow OAuth credentials
const WEBFLOW_CLIENT_ID = '0a5d4e7bf6fe3425a3a2a99b94df3e0d9e9e966be3d62e3ab50ab47c6121e265';
// TODO: Move to environment variable for security
const WEBFLOW_CLIENT_SECRET = process.env.WEBFLOW_CLIENT_SECRET || '';
const WEBFLOW_TOKEN_URL = 'https://api.webflow.com/oauth/access_token';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/dashboard?error=${error}`, request.url)
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?error=missing_parameters', request.url)
    );
  }

  try {
    // Verify state parameter for CSRF protection
    const storedState = request.cookies.get('webflow_oauth_state')?.value;

    if (!storedState || storedState !== state) {
      console.error('State mismatch - possible CSRF attack');
      return NextResponse.redirect(
        new URL('/dashboard?error=state_mismatch', request.url)
      );
    }

    // Parse state to get user ID
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());

    // Get current user from Supabase
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.id !== stateData.userId) {
      return NextResponse.redirect(
        new URL('/dashboard?error=unauthorized', request.url)
      );
    }

    // Check if client secret is configured
    if (!WEBFLOW_CLIENT_SECRET) {
      console.error('WEBFLOW_CLIENT_SECRET is not configured');
      // For now, redirect with a specific error
      return NextResponse.redirect(
        new URL('/dashboard?error=configuration_missing&details=client_secret_required', request.url)
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(WEBFLOW_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: WEBFLOW_CLIENT_ID,
        client_secret: WEBFLOW_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri(request)
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/dashboard?error=token_exchange_failed', request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('Token data received:', JSON.stringify(tokenData, null, 2));

    // Calculate expiration time (default to 7 days if not provided)
    const expiresIn = tokenData.expires_in || 604800; // 7 days in seconds
    const expiresAt = new Date(Date.now() + (expiresIn * 1000));

    // Store token in database
    const { error: dbError } = await supabase
      .from('webflow_tokens')
      .upsert({
        user_id: user.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        expires_at: expiresAt.toISOString(),
        scope: tokenData.scope || '',
        token_type: tokenData.token_type || 'Bearer',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (dbError) {
      console.error('Database error storing token:', dbError);
      // Try to create the table if it doesn't exist
      if (dbError.code === '42P01') {
        // Table doesn't exist
        return NextResponse.redirect(
          new URL('/dashboard?error=database_setup_needed', request.url)
        );
      }
      return NextResponse.redirect(
        new URL('/dashboard?error=database_error', request.url)
      );
    }

    // Get user's authorized sites
    const connectedSites: string[] = [];
    try {
      console.log('Fetching authorized Webflow sites...');
      const sitesResponse = await fetch('https://api.webflow.com/v2/sites', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (sitesResponse.ok) {
        const sitesData = await sitesResponse.json();
        console.log(`Found ${sitesData.sites?.length || 0} authorized sites`);

        // Store sites information
        if (sitesData.sites && sitesData.sites.length > 0) {
          // Log each site
          sitesData.sites.forEach((site: { displayName?: string; shortName: string; id: string }) => {
            console.log(`- Site: ${site.displayName || site.shortName} (${site.id})`);
            connectedSites.push(site.displayName || site.shortName);
          });

          await supabase
            .from('webflow_sites')
            .upsert(
              sitesData.sites.map((site: { id: string; displayName?: string; shortName: string; customDomains?: string[]; workspaceId: string }) => ({
                user_id: user.id,
                site_id: site.id,
                site_name: site.displayName || site.shortName,
                domain: site.customDomains?.[0] || `${site.shortName}.webflow.io`,
                workspace_id: site.workspaceId,
                last_synced: new Date().toISOString()
              })),
              { onConflict: 'user_id,site_id' }
            );

          console.log('Sites saved to database successfully');
        }
      }
    } catch (sitesError) {
      console.error('Failed to fetch sites:', sitesError);
      // Non-critical error, continue
    }

    // Clear state cookie and redirect with site information
    const successUrl = new URL('/dashboard', request.url);
    successUrl.searchParams.set('success', 'webflow_connected');
    if (connectedSites.length > 0) {
      successUrl.searchParams.set('sites', connectedSites.join(','));
      successUrl.searchParams.set('count', connectedSites.length.toString());
    }

    console.log(`OAuth flow completed successfully for user ${user.email}`);
    console.log(`Connected sites: ${connectedSites.join(', ') || 'none'}`);

    const response = NextResponse.redirect(successUrl);
    response.cookies.delete('webflow_oauth_state');

    return response;

  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/dashboard?error=oauth_callback_failed', request.url)
    );
  }
}

// Helper function to get correct redirect URI
function getRedirectUri(request: NextRequest): string {
  const url = new URL(request.url);

  // Use environment variable if set
  if (process.env.WEBFLOW_REDIRECT_URI) {
    return process.env.WEBFLOW_REDIRECT_URI;
  }

  // Otherwise construct from current URL
  const baseUrl = `${url.protocol}//${url.host}`;
  return `${baseUrl}/api/auth/webflow/callback`;
}