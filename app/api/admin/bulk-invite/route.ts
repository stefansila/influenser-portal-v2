import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || '';

// Initialize SendGrid
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// Create admin Supabase client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

type RequestData = {
  emails: string[];
  tagId: string;
};

type InviteResult = {
  email: string;
  success: boolean;
  error?: string;
  registration_url?: string;
  email_sent?: boolean;
  email_error?: string;
  token?: string;
};

// Email template
const createEmailTemplate = (email: string, registrationUrl: string, tagName: string) => {
  return {
    to: email,
    from: SENDGRID_FROM_EMAIL,
    subject: 'Join Our New Influencer Platform',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Join Our New Influencer Platform</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            border: 1px solid #eaeaea;
            border-radius: 5px;
          }
          .header {
            background-color: #FFB900;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            padding: 20px;
          }
          .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #FFB900;
            color: black;
            text-decoration: none;
            font-weight: bold;
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #777;
            font-size: 12px;
          }
          .feature-list {
            padding-left: 20px;
          }
          .feature-list li {
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: black; margin: 0;">Join Our New Influencer Platform</h1>
          </div>
          <div class="content">
            <p>Hi,</p>
            
            <p>I'm excited to share something we've been working on - a brand-new platform built specifically to make our influencer campaigns smoother, faster, and more organized for both of us.</p>
            
            <p>No more messy email chains or lost messages.</p>
            
            <p>With this platform, you can:</p>
            <ul class="feature-list">
              <li>Get campaign offers directly from me and my team</li>
              <li>Accept, decline, or request changes to offers</li>
              <li>Get access to more advertising opportunities through our new bidding process (more deals for you on a monthly basis)</li>
              <li>Submit quotes and request payment</li>
              <li>Upload drafts or scripts for review</li>
              <li>Get approvals, feedback, and final go-aheads – all in one place</li>
            </ul>
            
            <p>It's simple and streamlined - designed to save us both time.</p>
            
            <p>From now on, all campaign opportunities and communication will go through this platform. You'll still get email notifications when there's a new offer, but everything will be handled inside the platform - not through direct emails like before.</p>
            
            <p>Sign up below to get started 👇</p>
            
            <div style="text-align: center;">
              <a href="${registrationUrl}" class="button">Create Your Account</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 3px; font-size: 13px;">
              ${registrationUrl}
            </p>
            
            <p>It only takes a minute - you'll be all set to receive campaign invites after you're onboarded to the platform.</p>
            
            <p>Looking forward to working with you through the platform. If you have any questions, don't hesitate to reach out or call me.</p>
            
            <p>Best,<br>Aleem</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Allem. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Join Our New Influencer Platform
      
      Hi,
      
      I'm excited to share something we've been working on - a brand-new platform built specifically to make our influencer campaigns smoother, faster, and more organized for both of us.
      
      No more messy email chains or lost messages.
      
      With this platform, you can:
      • Get campaign offers directly from me and my team
      • Accept, decline, or request changes to offers
      • Get access to more advertising opportunities through our new bidding process (more deals for you on a monthly basis)
      • Submit quotes and request payment
      • Upload drafts or scripts for review
      • Get approvals, feedback, and final go-aheads – all in one place
      
      It's simple and streamlined - designed to save us both time.
      
      From now on, all campaign opportunities and communication will go through this platform. You'll still get email notifications when there's a new offer, but everything will be handled inside the platform - not through direct emails like before.
      
      Sign up below to get started:
      ${registrationUrl}
      
      It only takes a minute - you'll be all set to receive campaign invites after you're onboarded to the platform.
      
      Looking forward to working with you through the platform. If you have any questions, don't hesitate to reach out or call me.
      
      Best,
      Aleem
      
      © 2025 Allem. All rights reserved.
    `
  };
};

async function processInvitation(email: string, tagId: string, tagName: string, clientUrl: string): Promise<InviteResult> {
  try {
    // Generate token for invitation
    const token = crypto.randomBytes(4).toString('hex'); // 8 characters
    
    // Check if invitation already exists
    const { data: existingInvitation } = await supabaseAdmin
      .from('invitations')
      .select('id, status')
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();
      
    let invitationId;
    
    if (existingInvitation) {
      // Update existing invitation
      const { data: updatedInvite, error: updateError } = await supabaseAdmin
        .from('invitations')
        .update({
          token,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingInvitation.id)
        .select()
        .single();
        
      if (updateError) {
        return {
          email,
          success: false,
          error: `Failed to update invitation: ${updateError.message}`
        };
      }
      
      invitationId = existingInvitation.id;
    } else {
      // Create new invitation
      const invitationData = {
        email,
        status: 'pending',
        token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: newInvite, error: inviteError } = await supabaseAdmin
        .from('invitations')
        .insert(invitationData)
        .select()
        .single();
        
      if (inviteError) {
        return {
          email,
          success: false,
          error: `Failed to create invitation: ${inviteError.message}`
        };
      }
      
      invitationId = newInvite.id;
    }
    
    // Generate registration URL
    const registrationUrl = `${clientUrl}/signup?email=${encodeURIComponent(email)}&token=${token}&tag=${tagId}`;
    
    // Send email using SendGrid
    let emailSent = false;
    let emailError = null;
    
    console.log(`Attempting to send email to ${email}`);
    console.log(`SENDGRID_API_KEY exists: ${!!SENDGRID_API_KEY}`);
    console.log(`SENDGRID_FROM_EMAIL: ${SENDGRID_FROM_EMAIL}`);
    
    if (SENDGRID_API_KEY && SENDGRID_FROM_EMAIL) {
      try {
        const emailData = createEmailTemplate(email, registrationUrl, tagName);
        console.log(`Sending email with data:`, {
          to: emailData.to,
          from: emailData.from,
          subject: emailData.subject
        });
        
        const result = await sgMail.send(emailData);
        console.log(`Email sent successfully to ${email}:`, result[0].statusCode);
        emailSent = true;
      } catch (error: any) {
        console.error(`Failed to send email to ${email}:`, error);
        console.error(`SendGrid error details:`, error.response?.body || error.message);
        emailError = error.message || 'Unknown email error';
        // Don't fail the entire process if email fails
      }
    } else {
      console.log(`Email not sent - missing configuration. API Key: ${!!SENDGRID_API_KEY}, From Email: ${!!SENDGRID_FROM_EMAIL}`);
      emailError = 'SendGrid not configured';
    }
    
    return {
      email,
      success: true,
      registration_url: registrationUrl,
      email_sent: emailSent,
      email_error: emailError,
      token
    };
    
  } catch (error: any) {
    return {
      email,
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestData;
    const { emails, tagId } = body;

    // Validation
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'Emails array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!tagId) {
      return NextResponse.json(
        { error: 'Tag ID is required' },
        { status: 400 }
      );
    }

    // Check environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing Supabase credentials' },
        { status: 500 }
      );
    }

    // Fetch tag information
    const { data: tag, error: tagError } = await supabaseAdmin
      .from('tags')
      .select('id, name')
      .eq('id', tagId)
      .single();

    if (tagError || !tag) {
      return NextResponse.json(
        { error: 'Invalid tag ID' },
        { status: 400 }
      );
    }

    const clientUrl = request.headers.get('origin') || 'http://localhost:3000';
    
    console.log(`Processing bulk invitations for ${emails.length} emails with tag: ${tag.name}`);

    // Process all invitations
    const results: InviteResult[] = [];
    
    for (const email of emails) {
      const result = await processInvitation(email, tagId, tag.name, clientUrl);
      results.push(result);
      
      // Small delay to avoid overwhelming the email service
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Bulk invitation completed: ${successful} successful, ${failed} failed`);

    return NextResponse.json(
      { 
        success: true, 
        message: `Processed ${emails.length} invitations: ${successful} successful, ${failed} failed`,
        results,
        summary: {
          total: emails.length,
          successful,
          failed
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Unexpected error in bulk-invite API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 