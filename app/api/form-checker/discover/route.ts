import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FormDiscovery } from '@/lib/modules/form-checker';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { siteIds, options = {} } = body;

    // Get user's Webflow token
    const { data: tokenData, error: tokenError } = await supabase
      .from('webflow_tokens')
      .select('access_token, expires_at')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Webflow not connected. Please authorize access first.' },
        { status: 403 }
      );
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Webflow token expired. Please reconnect.' },
        { status: 403 }
      );
    }

    // Initialize FormDiscovery with user's access token
    const discovery = new FormDiscovery(tokenData.access_token);

    // Run form discovery
    const report = await discovery.discoverAllForms({
      siteIds,
      ...options
    });

    // Return the discovery report
    return NextResponse.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Form discovery error:', error);
    return NextResponse.json(
      {
        error: 'Form discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check module status
export async function GET() {
  return NextResponse.json({
    module: 'form-checker',
    version: '1.0.0',
    status: 'ready',
    endpoints: {
      discover: {
        method: 'POST',
        path: '/api/form-checker/discover',
        description: 'Discover and analyze forms across Webflow sites',
        body: {
          siteIds: 'string[] (optional) - Specific site IDs to check',
          options: {
            skipValidation: 'boolean (optional)',
            includeRecommendations: 'boolean (optional)',
            checkAccessibility: 'boolean (optional)',
            checkSecurity: 'boolean (optional)'
          }
        }
      }
    }
  });
}