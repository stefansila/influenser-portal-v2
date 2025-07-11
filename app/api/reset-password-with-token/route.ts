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
  newPassword: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestData;
    const { email, token, newPassword } = body;

    // Validation
    if (!email || !token || !newPassword) {
      return NextResponse.json(
        { error: 'Email, token, and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Validate password reset token first
    const { data: resetToken, error: tokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('id, email, token, status, expires_at')
      .eq('email', email)
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (tokenError || !resetToken) {
      return NextResponse.json(
        { error: 'Invalid password reset token' },
        { status: 400 }
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
        { error: 'Password reset token has expired' },
        { status: 400 }
      );
    }

    // Get user by email to update password
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 400 }
      );
    }

    // Update user password
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (passwordError) {
      console.error('Error updating user password:', passwordError);
      return NextResponse.json(
        { error: `Failed to update password: ${passwordError.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Mark password reset token as used
    const { error: updateTokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', resetToken.id);

    if (updateTokenError) {
      console.error('Error updating password reset token status:', updateTokenError);
      // Don't fail completely, password was already updated
    }

    console.log(`Password successfully reset for user ${email}`);

    return NextResponse.json(
      { 
        success: true,
        message: 'Password has been reset successfully',
        user: {
          id: user.id,
          email: user.email
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Unexpected error in reset-password-with-token API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 