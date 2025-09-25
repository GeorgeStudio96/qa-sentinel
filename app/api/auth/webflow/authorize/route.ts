import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Webflow OAuth credentials from your app
const WEBFLOW_CLIENT_ID = process.env.WEBFLOW_CLIENT_ID || '';
const WEBFLOW_AUTH_URL = process.env.WEBFLOW_AUTH_URL || '';

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Redirect to login if not authenticated
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Generate state parameter for CSRF protection
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(7)
    })).toString('base64');

    // Store state in cookie for verification later
    const response = NextResponse.redirect(
      `${WEBFLOW_AUTH_URL}?` +
      `response_type=code&` +
      `client_id=${WEBFLOW_CLIENT_ID}&` +
      `scope=sites:read+pages:read+forms:read+assets:read&` +
      `state=${state}&` +
      `redirect_uri=${encodeURIComponent(getRedirectUri(request))}`
    );

    // Set state cookie for verification in callback
    response.cookies.set('webflow_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('OAuth authorization error:', error);
    return NextResponse.redirect(
      new URL('/dashboard?error=oauth_init_failed', request.url)
    );
  }
}

// Helper function to get correct redirect URI based on environment
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