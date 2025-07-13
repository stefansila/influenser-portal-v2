import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';

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
  proposalId: string;
  userIds?: string[]; // Optional: if not provided, will send to all users with access
  forceResend?: boolean; // Optional: if true, will send emails even if already sent
};

type EmailResult = {
  userId: string;
  email: string;
  success: boolean;
  error?: string;
  alreadySent?: boolean;
};

// Create the advertising opportunity email template
const createAdvertisingEmailTemplate = (
  firstName: string,
  email: string,
  proposalTitle: string,
  companyName: string,
  emailTemplateBody: string,
  confirmationUrl: string
) => {
  return {
    to: email,
    from: SENDGRID_FROM_EMAIL,
    subject: 'Advertising Opportunity from Senergy Capital',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Advertising Opportunity from Senergy Capital</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
                     .header {
             background-color: #FFB900;
             padding: 20px;
             text-align: center;
             border-radius: 8px 8px 0 0;
             margin: -30px -30px 15px -30px;
           }
          .header h1 {
            color: #000;
            margin: 0;
            font-size: 24px;
          }
          .content {
            padding-top: 10px;
          }
          .greeting {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 20px;
          }
          .intro {
            font-size: 16px;
            margin-bottom: 20px;
            color: #333;
          }
          .details-section {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #FFB900;
          }
          .details-section h3 {
            color: #FFB900;
            margin-top: 0;
            margin-bottom: 15px;
          }
          .cta-section {
            text-align: center;
            margin: 30px 0;
          }
          .cta-button {
            display: inline-block;
            padding: 15px 30px;
            background-color: #FFB900;
            color: #000;
            text-decoration: none;
            font-weight: bold;
            border-radius: 6px;
            font-size: 16px;
            transition: background-color 0.3s;
          }
          .cta-button:hover {
            background-color: #e6a600;
          }
          .urgency {
            font-style: italic;
            color: #666;
            font-size: 14px;
            margin-top: 20px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #777;
            font-size: 12px;
            border-top: 1px solid #eee;
            padding-top: 20px;
          }
          .company-info {
            margin-bottom: 20px;
            font-size: 14px;
            color: #555;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Advertising Opportunity</h1>
          </div>
          
          <div class="content">
            <div class="greeting">Hey ${firstName},</div>
            
            <div class="intro">
              We've got a new paid advertising opportunity we think you'll want in on. One of our clients is launching a campaign and is looking for creators like you to help spread the story.
            </div>
            
                         <div class="details-section">
               <h3>Campaign Details:</h3>
               <div>${emailTemplateBody}</div>
             </div>
            
            <div class="intro">
              If you're interested, hit the link below to confirm your participation in this campaign
            </div>
            
            <div class="cta-section">
              <a href="${confirmationUrl}" class="cta-button">👉 Confirm Participation</a>
            </div>
            
            <div class="urgency">
              <strong>FYI</strong> - spots are limited and we usually fill them fast
            </div>
            
            <div class="intro" style="margin-top: 30px;">
              Let us know if you have questions. Otherwise, we'll see you on the list.
            </div>
          </div>
          
          <div class="footer">
            <div class="company-info">
              <strong>Senergy Capital</strong><br>
              228-1122 Mainland Street<br>
              Vancouver, BC, V6B 5L1<br>
              <a href="mailto:aleem@senergy.capital">aleem@senergy.capital</a>
            </div>
            <p>&copy; 2025 Senergy Capital. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Advertising Opportunity from Senergy Capital
      
      Hey ${firstName},
      
      We've got a new paid advertising opportunity we think you'll want in on. One of our clients is launching a campaign and is looking for creators like you to help spread the story.
      
      Campaign Details:
      ${emailTemplateBody.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')}
      
      If you're interested, hit the link below to confirm your participation in this campaign:
      ${confirmationUrl}
      
      FYI - spots are limited and we usually fill them fast
      
      Let us know if you have questions. Otherwise, we'll see you on the list.
      
      ---
      Senergy Capital
      228-1122 Mainland Street
      Vancouver, BC, V6B 5L1
      aleem@senergy.capital
      
      © 2025 Senergy Capital. All rights reserved.
    `
  };
};

async function sendEmailToUser(
  userId: string,
  proposalId: string,
  proposalTitle: string,
  companyName: string,
  emailTemplateBody: string,
  clientUrl: string,
  forceResend: boolean = false
): Promise<EmailResult> {
  try {
    // Get user information
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return {
        userId,
        email: 'unknown',
        success: false,
        error: `User not found: ${userError?.message || 'Unknown error'}`
      };
    }

    // Check if email was already sent to this user for this proposal (unless force resend)
    if (!forceResend) {
      const { data: existingEmail, error: checkError } = await supabaseAdmin
        .from('proposal_email_sends')
        .select('id')
        .eq('proposal_id', proposalId)
        .eq('user_id', userId)
        .eq('email_type', 'advertising_opportunity')
        .maybeSingle();

      if (checkError) {
        return {
          userId,
          email: userData.email,
          success: false,
          error: `Error checking email history: ${checkError.message}`
        };
      }

      if (existingEmail) {
        return {
          userId,
          email: userData.email,
          success: true,
          alreadySent: true
        };
      }
    }

    // Generate confirmation URL
    const confirmationUrl = `${clientUrl}/dashboard/proposals/${proposalId}`;

    // Extract first name from full name
    const firstName = userData.full_name ? userData.full_name.split(' ')[0] : 'there';

    // Send email using SendGrid
    let emailSent = false;
    let emailError = null;

    if (SENDGRID_API_KEY && SENDGRID_FROM_EMAIL) {
      try {
        const emailData = createAdvertisingEmailTemplate(
          firstName,
          userData.email,
          proposalTitle,
          companyName,
          emailTemplateBody,
          confirmationUrl
        );

        const result = await sgMail.send(emailData);
        console.log(`Advertising email sent successfully to ${userData.email}:`, result[0].statusCode);
        emailSent = true;
      } catch (error: any) {
        console.error(`Failed to send advertising email to ${userData.email}:`, error);
        emailError = error.message || 'Email sending failed';
        emailSent = false;
      }
    } else {
      emailError = 'SendGrid not configured';
      emailSent = false;
    }

    // Record the email send attempt
    if (emailSent) {
      const { error: recordError } = await supabaseAdmin
        .from('proposal_email_sends')
        .insert({
          proposal_id: proposalId,
          user_id: userId,
          email_type: 'advertising_opportunity',
          email_sent_at: new Date().toISOString()
        });

      if (recordError) {
        console.error('Error recording email send:', recordError);
        // Don't fail the whole operation for this
      }
    }

    return {
      userId,
      email: userData.email,
      success: emailSent,
      error: emailError
    };

  } catch (error: any) {
    return {
      userId,
      email: 'unknown',
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestData;
    const { proposalId, userIds, forceResend = false } = body;

    // Validation
    if (!proposalId) {
      return NextResponse.json(
        { error: 'Proposal ID is required' },
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

    // Get proposal information
    const { data: proposal, error: proposalError } = await supabaseAdmin
      .from('proposals')
      .select('title, company_name, email_template_body')
      .eq('id', proposalId)
      .single();

    if (proposalError || !proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Check if email template body is provided
    if (!proposal.email_template_body) {
      return NextResponse.json(
        { error: 'Email template body is required for this proposal' },
        { status: 400 }
      );
    }

    // Get target users (either specified userIds or all users with access to the proposal)
    let targetUserIds: string[] = [];

    if (userIds && userIds.length > 0) {
      targetUserIds = userIds;
    } else {
      // Get all users who have access to this proposal
      const { data: visibilityData, error: visibilityError } = await supabaseAdmin
        .from('proposal_visibility')
        .select('user_id')
        .eq('proposal_id', proposalId);

      if (visibilityError) {
        return NextResponse.json(
          { error: 'Failed to get proposal visibility data' },
          { status: 500 }
        );
      }

      targetUserIds = visibilityData?.map(v => v.user_id) || [];
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json(
        { error: 'No users found to send emails to' },
        { status: 400 }
      );
    }

    const clientUrl = request.headers.get('origin') || 'http://localhost:3000';

    console.log(`Sending advertising opportunity emails for proposal ${proposalId} to ${targetUserIds.length} users${forceResend ? ' (force resend)' : ''}`);

    // Send emails to all target users
    const results: EmailResult[] = [];

    for (const userId of targetUserIds) {
      const result = await sendEmailToUser(
        userId,
        proposalId,
        proposal.title,
        proposal.company_name,
        proposal.email_template_body,
        clientUrl,
        forceResend
      );
      results.push(result);

      // Small delay to avoid overwhelming the email service
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const successful = results.filter(r => r.success && !r.alreadySent).length;
    const failed = results.filter(r => !r.success).length;
    const alreadySent = results.filter(r => r.alreadySent).length;

    console.log(`Advertising email sending completed: ${successful} sent, ${failed} failed, ${alreadySent} already sent`);

    return NextResponse.json(
      {
        success: true,
        message: `Email sending completed`,
        results: {
          sent: successful,
          failed: failed,
          alreadySent: alreadySent,
          total: results.length
        },
        details: results
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Unexpected error in send-advertising-email API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 