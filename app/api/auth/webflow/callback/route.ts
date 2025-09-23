/**
 * Webflow OAuth Callback Handler
 * Handles the OAuth callback from Webflow and stores tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { createWebflowOAuthClient } from '@/lib/webflow';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth error
  if (error) {
    console.error('Webflow OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent('Authorization failed')}`, request.url)
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent('Invalid callback parameters')}`, request.url)
    );
  }

  try {
    // Get redirect URI from environment or construct from request
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/webflow/callback`;

    // Create OAuth client
    const oauthClient = createWebflowOAuthClient(redirectUri);

    // Exchange code for token
    const tokenResponse = await oauthClient.exchangeCodeForToken(code);

    // Get user info from Webflow
    const userInfo = await oauthClient.getUserInfo(tokenResponse.access_token);

    // Initialize Supabase client
    const supabase = await createClient();

    // Get current user session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User not authenticated:', userError);
      return NextResponse.redirect(
        new URL(`/dashboard?error=${encodeURIComponent('User not authenticated')}`, request.url)
      );
    }

    // Store Webflow connection in database
    const { error: dbError } = await supabase
      .from('webflow_connections')
      .upsert({
        user_id: user.id,
        webflow_user_id: userInfo.id,
        webflow_user_email: userInfo.email,
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type,
        scope: tokenResponse.scope,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,webflow_user_id',
      });

    if (dbError) {
      console.error('Database error storing Webflow connection:', dbError);
      return NextResponse.redirect(
        new URL(`/dashboard?error=${encodeURIComponent('Failed to save connection')}`, request.url)
      );
    }

    // Redirect to dashboard with success message
    return NextResponse.redirect(
      new URL('/dashboard?connected=webflow', request.url)
    );

  } catch (error) {
    console.error('Webflow OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent('Connection failed')}`, request.url)
    );
  }
}