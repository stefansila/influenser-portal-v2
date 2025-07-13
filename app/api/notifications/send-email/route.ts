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

type NotificationEmailData = {
  notification_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  notification_title: string;
  notification_message: string;
  notification_type: 'info' | 'action' | 'popup';
  link_url?: string;
  related_proposal_id?: string;
  related_response_id?: string;
  proposal_title?: string;
  company_name?: string;
};

// Enhanced email template creator
const createNotificationEmailTemplate = (data: NotificationEmailData, baseUrl: string) => {
  const {
    user_name,
    user_email,
    notification_title,
    notification_message,
    notification_type,
    link_url,
    proposal_title,
    company_name
  } = data;

  // Create the action URL
  const actionUrl = link_url ? `${baseUrl}${link_url}` : `${baseUrl}/dashboard`;
  
  // Determine the primary color based on notification type
  const primaryColor = notification_type === 'action' ? '#FF6B6B' : 
                      notification_type === 'popup' ? '#4ECDC4' : '#FFB900';
  
  // Get the appropriate greeting
  const firstName = user_name ? user_name.split(' ')[0] : 'there';
  
  // Create contextual content based on notification type
  let contextualContent = '';
  let buttonText = 'View Details';
  
  if (notification_title.includes('New Proposal Available')) {
    contextualContent = `
      <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
        A new advertising opportunity has been made available to you${proposal_title ? ` for <strong>${proposal_title}</strong>` : ''}${company_name ? ` from <strong>${company_name}</strong>` : ''}.
      </p>
      <p style="color: #555; font-size: 14px; margin-bottom: 20px;">
        This proposal contains all the details you need to know about the campaign, including requirements, timeline, and compensation.
      </p>
    `;
    buttonText = 'View Proposal';
  } else if (notification_title.includes('Proposal Updated')) {
    contextualContent = `
      <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
        A proposal${proposal_title ? ` for <strong>${proposal_title}</strong>` : ''} has been updated with new information.
      </p>
      <p style="color: #555; font-size: 14px; margin-bottom: 20px;">
        Please review the updated details to ensure you have the latest information about this campaign.
      </p>
    `;
    buttonText = 'View Updated Proposal';
  } else if (notification_title.includes('New Response Submitted')) {
    contextualContent = `
      <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
        A user has submitted a new response to one of your proposals${proposal_title ? ` for <strong>${proposal_title}</strong>` : ''}.
      </p>
      <p style="color: #555; font-size: 14px; margin-bottom: 20px;">
        Please review the response and take appropriate action (approve, reject, or request changes).
      </p>
    `;
    buttonText = 'Review Response';
  } else if (notification_title.includes('Response Updated')) {
    contextualContent = `
      <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
        A user has updated their response to one of your proposals${proposal_title ? ` for <strong>${proposal_title}</strong>` : ''}.
      </p>
      <p style="color: #555; font-size: 14px; margin-bottom: 20px;">
        Please review the updated response and take appropriate action.
      </p>
    `;
    buttonText = 'Review Updated Response';
  } else if (notification_title.includes('Admin responded to your reply')) {
    contextualContent = `
      <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
        An admin has reviewed your response${proposal_title ? ` for <strong>${proposal_title}</strong>` : ''} and provided feedback.
      </p>
      <p style="color: #555; font-size: 14px; margin-bottom: 20px;">
        Please check the admin's response to see if any changes are needed or if your response has been approved.
      </p>
    `;
    buttonText = 'View Admin Response';
  } else if (notification_title.includes('Campaign Completed')) {
    contextualContent = `
      <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
        A campaign${proposal_title ? ` for <strong>${proposal_title}</strong>` : ''} has been marked as completed.
      </p>
      <p style="color: #555; font-size: 14px; margin-bottom: 20px;">
        Thank you for your participation in this campaign. You can review the final details and status.
      </p>
    `;
    buttonText = 'View Campaign';
  } else {
    // Generic content for other notification types
    contextualContent = `
      <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
        ${notification_message}
      </p>
    `;
    buttonText = 'View Details';
  }

  return {
    to: user_email,
    from: SENDGRID_FROM_EMAIL,
    subject: `${notification_title} - Influencer Portal`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification_title}</title>
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
            padding: 0;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background-color: ${primaryColor};
            padding: 30px 20px;
            text-align: center;
            color: #000;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: bold;
          }
          .content {
            padding: 30px;
          }
          .greeting {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 20px;
          }
          .notification-badge {
            display: inline-block;
            background-color: ${primaryColor};
            color: #000;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 20px;
          }
          .cta-section {
            text-align: center;
            margin: 30px 0;
          }
          .cta-button {
            display: inline-block;
            padding: 15px 30px;
            background-color: ${primaryColor};
            color: #000;
            text-decoration: none;
            font-weight: bold;
            border-radius: 6px;
            font-size: 16px;
            transition: opacity 0.3s;
          }
          .cta-button:hover {
            opacity: 0.9;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #777;
            font-size: 12px;
          }
          .company-info {
            margin-bottom: 20px;
            font-size: 14px;
            color: #555;
          }
          .urgent-notice {
            background-color: #FFF3CD;
            border: 1px solid #FFEAA7;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
          }
        </style>
      </head>
      <body>
        <!-- Logo at the top, centered -->
        <div style="text-align: center; margin-bottom: 20px; padding-top: 20px;">
          <img title="Influencer Portal" width="82" height="82" style="width:82px;height:82px;max-width:82px;margin-top:0px;margin-bottom:0px;display:block;margin-left:auto;margin-right:auto;" src="https://ci3.googleusercontent.com/meips/ADKq_NY4gRRXNR6NH3jphoki8KrBZIlD3Ld9RKJ_bWfsypzIbN7D5MDMb3X2ITjB_nlK8t7VHqEeEDt9jhA8o2qYXmApi_I-LF6RtoZX=s0-d-e1-ft#https://signaturehound.com/api/v1/file/eis7klr7cccl4" class="CToWUd" data-bit="iit">
        </div>
        
        <div class="container">
          <div class="header">
            <h1>${notification_title}</h1>
          </div>
          
          <div class="content">
            <div class="greeting">Hi ${firstName},</div>
            
            <div class="notification-badge">${notification_type.toUpperCase()}</div>
            
            ${contextualContent}
            
            ${notification_type === 'action' ? `
              <div class="urgent-notice">
                <strong>Action Required:</strong> This notification requires your attention. Please review and respond as soon as possible.
              </div>
            ` : ''}
            
            <div class="cta-section">
              <a href="${actionUrl}" class="cta-button">${buttonText}</a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              You received this notification because you have an active account in our Influencer Portal. 
              You can manage your notification preferences in your account settings.
            </p>
          </div>
          
          <div class="footer">
            <div class="company-info">
              <strong>Senergy Capital</strong><br>
              228-1122 Mainland Street<br>
              Vancouver, BC, V6B 5L1<br>
              <a href="mailto:aleem@senergy.capital">aleem@senergy.capital</a>
            </div>
            <p>&copy; 2025 Senergy Capital. All rights reserved.</p>
            <p>
              <a href="${actionUrl}" style="color: ${primaryColor};">View in Portal</a> | 
              <a href="${baseUrl}/dashboard/settings" style="color: ${primaryColor};">Notification Settings</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ${notification_title}
      
      Hi ${firstName},
      
      ${notification_message}
      
      ${contextualContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')}
      
      View details: ${actionUrl}
      
      You received this notification because you have an active account in our Influencer Portal.
      
      ---
      Senergy Capital
      228-1122 Mainland Street
      Vancouver, BC, V6B 5L1
      aleem@senergy.capital
      
      © 2025 Senergy Capital. All rights reserved.
    `
  };
};

async function sendNotificationEmail(data: NotificationEmailData): Promise<{success: boolean, error?: string}> {
  try {
    // Check if SendGrid is configured
    if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
      return { success: false, error: 'SendGrid not configured' };
    }

    // Get base URL from environment or use default
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Create email template
    const emailData = createNotificationEmailTemplate(data, baseUrl);

    // Send email
    const result = await sgMail.send(emailData);
    
    console.log(`Notification email sent successfully to ${data.user_email} for: ${data.notification_title}`);
    
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to send notification email to ${data.user_email}:`, error);
    return { 
      success: false, 
      error: error.message || 'Email sending failed' 
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notification_id } = body;

    if (!notification_id) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    // Get notification details with user and related data
    const { data: notification, error: notificationError } = await supabaseAdmin
      .from('notifications')
      .select(`
        *,
        users:recipient_id (
          id,
          email,
          full_name
        )
      `)
      .eq('id', notification_id)
      .single();

    if (notificationError || !notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Get related proposal details if available
    let proposalData = null;
    if (notification.related_proposal_id) {
      const { data: proposal } = await supabaseAdmin
        .from('proposals')
        .select('title, company_name')
        .eq('id', notification.related_proposal_id)
        .single();
      
      proposalData = proposal;
    }

    // Prepare email data
    const emailData: NotificationEmailData = {
      notification_id: notification.id,
      user_id: notification.users.id,
      user_email: notification.users.email,
      user_name: notification.users.full_name || 'User',
      notification_title: notification.title,
      notification_message: notification.message,
      notification_type: notification.type,
      link_url: notification.link_url,
      related_proposal_id: notification.related_proposal_id,
      related_response_id: notification.related_response_id,
      proposal_title: proposalData?.title,
      company_name: proposalData?.company_name
    };

    // Send email
    const emailResult = await sendNotificationEmail(emailData);

    // Record the email send attempt in the database
    const { error: recordError } = await supabaseAdmin
      .from('notification_email_sends')
      .insert({
        notification_id: notification.id,
        user_id: notification.users.id,
        email_sent: emailResult.success,
        email_error: emailResult.error,
        sent_at: new Date().toISOString()
      });

    if (recordError) {
      console.error('Error recording email send:', recordError);
      // Don't fail the whole operation for this
    }

    return NextResponse.json(
      {
        success: emailResult.success,
        message: emailResult.success ? 'Notification email sent successfully' : 'Failed to send email',
        error: emailResult.error
      },
      { status: emailResult.success ? 200 : 500 }
    );

  } catch (error: any) {
    console.error('Unexpected error in notification email API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 