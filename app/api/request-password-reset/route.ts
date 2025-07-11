import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || '';

// Initialize SendGrid
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

type RequestData = {
  email: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestData;
    const { email } = body;

    // Validation
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists by looking in the users table
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();
    
    if (userError || !user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json(
        { 
          success: true, 
          message: 'If an account with this email exists, you will receive a password reset link.' 
        },
        { status: 200 }
      );
    }

    // Generate token for password reset
    const token = crypto.randomBytes(4).toString('hex'); // 8 characters
    
    // Check if there's already a pending password reset for this email
    const { data: existingToken } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('id, status')
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();
      
    let tokenId;
    
    if (existingToken) {
      // Update existing token
      const { data: updatedToken, error: updateError } = await supabaseAdmin
        .from('password_reset_tokens')
        .update({
          token,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour expiry
          updated_at: new Date().toISOString()
        })
        .eq('id', existingToken.id)
        .select()
        .single();
        
      if (updateError) {
        console.error('Error updating password reset token:', updateError);
        return NextResponse.json(
          { error: 'Failed to process password reset request' },
          { status: 500 }
        );
      }
      
      tokenId = existingToken.id;
    } else {
      // Create new password reset token
      const tokenData = {
        email,
        token,
        status: 'pending',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour expiry
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: newToken, error: tokenError } = await supabaseAdmin
        .from('password_reset_tokens')
        .insert(tokenData)
        .select()
        .single();
        
      if (tokenError) {
        console.error('Error creating password reset token:', tokenError);
        return NextResponse.json(
          { error: 'Failed to process password reset request' },
          { status: 500 }
        );
      }
      
      tokenId = newToken.id;
    }
    
    // Generate password reset URL
    const clientUrl = request.headers.get('origin') || 'http://localhost:3000';
    const resetUrl = `${clientUrl}/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
    
    // Send email if SendGrid is configured
    if (SENDGRID_API_KEY && SENDGRID_FROM_EMAIL) {
      try {
        const msg = {
          to: email,
          from: SENDGRID_FROM_EMAIL,
          subject: 'Reset Your Password',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Reset Your Password</h2>
              <p>You requested to reset your password. Click the link below to set a new password:</p>
              <div style="margin: 30px 0;">
                <a href="${resetUrl}" 
                   style="background-color: #F59E0B; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  Reset Password
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">
                This link will expire in 1 hour. If you didn't request this password reset, you can safely ignore this email.
              </p>
              <p style="color: #666; font-size: 14px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #F59E0B;">${resetUrl}</a>
              </p>
            </div>
          `,
        };

        await sgMail.send(msg);
        console.log(`Password reset email sent to ${email}`);
      } catch (emailError) {
        console.error('Error sending password reset email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json(
      { 
        success: true,
        message: 'If an account with this email exists, you will receive a password reset link.',
        resetUrl: resetUrl // Include for development/testing
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Unexpected error in request-password-reset API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 