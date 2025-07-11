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

    // Check if password reset token exists and is valid
    const { data: resetToken, error } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('id, email, token, status, expires_at')
      .eq('email', email)
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (error) {
      console.error('Error checking password reset token:', error);
      return NextResponse.json(
        { valid: false, message: 'Error validating password reset token' },
        { status: 500 }
      );
    }

    if (!resetToken) {
      return NextResponse.json(
        { valid: false, message: 'Invalid password reset token or email' },
        { status: 200 }
      );
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);
    
    if (now > expiresAt) {
      // Mark token as expired
      await supabaseAdmin
        .from('password_reset_tokens')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', resetToken.id);

      return NextResponse.json(
        { valid: false, message: 'This password reset token has expired' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { 
        valid: true, 
        message: 'Password reset token is valid',
        token: {
          id: resetToken.id,
          email: resetToken.email
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Unexpected error in validate-password-reset API:', error);
    return NextResponse.json(
      { valid: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
} 