import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

type RequestData = {
  email: string;
  token: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestData;
    const { email, token } = body;

    // Validation
    if (!email || !token) {
      return NextResponse.json(
        { valid: false, message: 'Email and token are required' },
        { status: 400 }
      );
    }

    // Check if invitation exists and is valid
    const { data: invitation, error } = await supabaseAdmin
      .from('invitations')
      .select('id, email, token, status, expires_at')
      .eq('email', email)
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (error) {
      console.error('Error checking invitation:', error);
      return NextResponse.json(
        { valid: false, message: 'Error validating invitation' },
        { status: 500 }
      );
    }

    if (!invitation) {
      return NextResponse.json(
        { valid: false, message: 'Invalid invitation token or email' },
        { status: 200 }
      );
    }

    // Check if invitation has expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    
    if (now > expiresAt) {
      return NextResponse.json(
        { valid: false, message: 'This invitation has expired' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { 
        valid: true, 
        message: 'Invitation is valid',
        invitation: {
          id: invitation.id,
          email: invitation.email
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Unexpected error in validate-invite API:', error);
    return NextResponse.json(
      { valid: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
} 