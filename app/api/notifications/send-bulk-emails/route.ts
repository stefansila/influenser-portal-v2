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

type BulkEmailResult = {
  notification_id: string;
  user_email: string;
  success: boolean;
  error?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { limit = 50, process_unprocessed = true } = body;

    // Get unprocessed notifications that need email sending
    let query = supabaseAdmin
      .from('notifications')
      .select(`
        *,
        users:recipient_id (
          id,
          email,
          full_name
        )
      `)
      .eq('should_send_email', true)
      .eq('email_processed', false)
      .order('created_at', { ascending: true })
      .limit(limit);

    const { data: notifications, error: notificationsError } = await query;

    if (notificationsError) {
      return NextResponse.json(
        { error: 'Failed to fetch notifications', details: notificationsError.message },
        { status: 500 }
      );
    }

    if (!notifications || notifications.length === 0) {
      return NextResponse.json(
        { 
          success: true, 
          message: 'No notifications to process',
          processed: 0,
          results: []
        },
        { status: 200 }
      );
    }

    console.log(`Processing ${notifications.length} notifications for email sending`);

    const results: BulkEmailResult[] = [];
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Process notifications in parallel with limited concurrency
    const concurrency = 5;
    for (let i = 0; i < notifications.length; i += concurrency) {
      const batch = notifications.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (notification) => {
        const result: BulkEmailResult = {
          notification_id: notification.id,
          user_email: notification.users.email,
          success: false,
        };

        try {
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

          // Check if SendGrid is configured
          if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
            result.error = 'SendGrid not configured';
            return result;
          }

          // Create email template (reusing logic from single email API)
          const emailData = createNotificationEmailTemplate({
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
          }, baseUrl);

          // Send email
          await sgMail.send(emailData);
          
          result.success = true;
          console.log(`Bulk email sent successfully to ${notification.users.email} for: ${notification.title}`);

          // Record the email send in the tracking table
          await supabaseAdmin
            .from('notification_email_sends')
            .insert({
              notification_id: notification.id,
              user_id: notification.users.id,
              email_sent: true,
              sent_at: new Date().toISOString()
            });

          // Mark notification as email processed
          await supabaseAdmin
            .from('notifications')
            .update({ email_processed: true })
            .eq('id', notification.id);

        } catch (error: any) {
          console.error(`Failed to send bulk email to ${notification.users.email}:`, error);
          result.error = error.message || 'Email sending failed';
          
          // Record the failed email send
          await supabaseAdmin
            .from('notification_email_sends')
            .insert({
              notification_id: notification.id,
              user_id: notification.users.id,
              email_sent: false,
              email_error: result.error,
              sent_at: new Date().toISOString()
            });

          // Still mark as processed to avoid retrying indefinitely
          await supabaseAdmin
            .from('notifications')
            .update({ email_processed: true })
            .eq('id', notification.id);
        }

        return result;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to avoid overwhelming SendGrid
      if (i + concurrency < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Bulk email processing completed: ${successful} sent, ${failed} failed`);

    return NextResponse.json(
      {
        success: true,
        message: `Bulk email processing completed`,
        processed: results.length,
        successful,
        failed,
        results
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Unexpected error in bulk email API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function for creating email templates (copied from single email API)
function createNotificationEmailTemplate(data: any, baseUrl: string) {
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

  const actionUrl = link_url ? `${baseUrl}${link_url}` : `${baseUrl}/dashboard`;
  const primaryColor = notification_type === 'action' ? '#FF6B6B' : 
                      notification_type === 'popup' ? '#4ECDC4' : '#FFB900';
  const firstName = user_name ? user_name.split(' ')[0] : 'there';
  
  let contextualContent = '';
  let buttonText = 'View Details';
  
  if (notification_title.includes('New Proposal Available')) {
    contextualContent = `
      <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
        A new advertising opportunity has been made available to you${proposal_title ? ` for <strong>${proposal_title}</strong>` : ''}${company_name ? ` from <strong>${company_name}</strong>` : ''}.
      </p>
    `;
    buttonText = 'View Proposal';
  } else if (notification_title.includes('Proposal Updated')) {
    contextualContent = `
      <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
        A proposal${proposal_title ? ` for <strong>${proposal_title}</strong>` : ''} has been updated with new information.
      </p>
    `;
    buttonText = 'View Updated Proposal';
  } else if (notification_title.includes('New Response Submitted') || notification_title.includes('Response Updated')) {
    contextualContent = `
      <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
        A user has ${notification_title.includes('Updated') ? 'updated their' : 'submitted a new'} response to one of your proposals${proposal_title ? ` for <strong>${proposal_title}</strong>` : ''}.
      </p>
    `;
    buttonText = 'Review Response';
  } else if (notification_title.includes('Admin responded to your reply')) {
    contextualContent = `
      <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
        An admin has reviewed your response${proposal_title ? ` for <strong>${proposal_title}</strong>` : ''} and provided feedback.
      </p>
    `;
    buttonText = 'View Admin Response';
  } else {
    contextualContent = `
      <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
        ${notification_message}
      </p>
    `;
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
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #777;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
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
            <div class="cta-section">
              <a href="${actionUrl}" class="cta-button">${buttonText}</a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              You received this notification because you have an active account in our Influencer Portal.
            </p>
          </div>
          
          <div class="footer">
            <div style="margin-bottom: 20px; font-size: 14px; color: #555;">
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
      ${notification_title}
      
      Hi ${firstName},
      
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
} 