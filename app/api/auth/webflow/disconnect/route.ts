import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Delete user's Webflow token
    const { error: tokenError } = await supabase
      .from('webflow_tokens')
      .delete()
      .eq('user_id', user.id);

    if (tokenError) {
      console.error('Failed to delete token:', tokenError);
    }

    // Delete user's Webflow sites
    const { error: sitesError } = await supabase
      .from('webflow_sites')
      .delete()
      .eq('user_id', user.id);

    if (sitesError) {
      console.error('Failed to delete sites:', sitesError);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}