import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Konstante iz .env ili supabase konfiguracije za admin pristup
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Kreiramo admin klijenta sa service_role ključem
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET(request: NextRequest) {
  try {
    // Izvučemo parametre iz URL-a
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const token = url.searchParams.get('token');

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and token parameters are required' },
        { status: 400 }
      );
    }

    // Provera da li su env varijable postavljene
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    console.log('Verifying invitation with admin API:', email, token);

    // Proveri da li postoji pozivnica
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('email', email)
      .eq('token', token)
      .maybeSingle();

    if (invitationError) {
      console.error('Error checking invitation:', invitationError);
      return NextResponse.json(
        { error: 'Error checking invitation', details: invitationError.message },
        { status: 500 }
      );
    }

    if (!invitation) {
      return NextResponse.json(
        { valid: false, message: 'No matching invitation found' },
        { status: 404 }
      );
    }

    // Proverimo status i datum isteka
    const now = new Date();
    const expiresAt = invitation.expires_at ? new Date(invitation.expires_at) : null;
    
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { 
          valid: false, 
          message: 'Invitation is no longer valid', 
          status: invitation.status 
        },
        { status: 400 }
      );
    }

    if (expiresAt && expiresAt < now) {
      return NextResponse.json(
        { valid: false, message: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Pozivnica je validna
    return NextResponse.json(
      { 
        valid: true, 
        invitation: {
          id: invitation.id,
          email: invitation.email,
          status: invitation.status,
          created_at: invitation.created_at
        } 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Unexpected error in verify-invitation API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 