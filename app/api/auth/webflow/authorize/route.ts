/**
 * Webflow OAuth Authorization Endpoint
 * Initiates OAuth flow with Webflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { createWebflowOAuthClient, WebflowOAuthClient } from '@/lib/webflow';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Check if user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Generate secure state for CSRF protection
    const state = WebflowOAuthClient.generateState();

    // Store state in session or database for later validation
    // For now, we'll use URL parameter validation
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/webflow/callback`;

    // Create OAuth client
    const oauthClient = createWebflowOAuthClient(redirectUri, state);

    // Generate authorization URL with required scopes
    const authUrl = oauthClient.getAuthorizationUrl([
      'sites:read',
      'forms:read',
      'cms:read'
    ]);

    // Store state in database for validation during callback
    await supabase
      .from('oauth_states')
      .upsert({
        user_id: user.id,
        state,
        provider: 'webflow',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      }, {
        onConflict: 'user_id,provider',
      });

    // Redirect to Webflow authorization
    return NextResponse.redirect(authUrl);

  } catch (error) {
    console.error('Webflow authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate authorization' },
      { status: 500 }
    );
  }
}