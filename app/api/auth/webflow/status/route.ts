import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ connected: false, error: 'Not authenticated' });
    }

    // Check if user has a Webflow token
    const { data: tokenData, error: tokenError } = await supabase
      .from('webflow_tokens')
      .select('access_token, expires_at, scope')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ connected: false });
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.expires_at);
    const isExpired = expiresAt < new Date();

    if (isExpired) {
      // Token is expired, should refresh it (not implemented yet)
      return NextResponse.json({
        connected: false,
        error: 'Token expired',
        needsRefresh: true
      });
    }

    // Get user's authorized sites
    const { data: sites } = await supabase
      .from('webflow_sites')
      .select('site_id, site_name, domain, workspace_id')
      .eq('user_id', user.id);

    return NextResponse.json({
      connected: true,
      scope: tokenData.scope,
      sites: sites || [],
      expiresAt: tokenData.expires_at,
      accessToken: tokenData.access_token
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({
      connected: false,
      error: 'Failed to check status'
    });
  }
}