/**
 * Webflow OAuth Disconnect Endpoint
 * Revokes tokens and removes connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createWebflowOAuthClient } from '@/lib/webflow';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
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

    // Get Webflow connection for current user
    const { data: connection, error: connectionError } = await supabase
      .from('webflow_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Webflow connection found' },
        { status: 404 }
      );
    }

    // Create OAuth client for token revocation
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/webflow/callback`;
    const oauthClient = createWebflowOAuthClient(redirectUri);

    try {
      // Revoke access token with Webflow
      await oauthClient.revokeToken(connection.access_token);
    } catch (error) {
      console.warn('Failed to revoke token with Webflow:', error);
      // Continue with local cleanup even if Webflow revocation fails
    }

    // Remove connection from database
    const { error: deleteError } = await supabase
      .from('webflow_connections')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Database error removing Webflow connection:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove connection' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Webflow connection removed successfully'
    });

  } catch (error) {
    console.error('Webflow disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Webflow' },
      { status: 500 }
    );
  }
}