import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

// Environment variables
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || '';

// Initialize SendGrid if key is present
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export async function GET(request: NextRequest) {
  try {
    // Check if environment variables are set
    if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
      return NextResponse.json(
        { 
          error: 'SendGrid not configured',
          details: {
            hasApiKey: !!SENDGRID_API_KEY,
            hasFromEmail: !!SENDGRID_FROM_EMAIL,
            apiKeyLength: SENDGRID_API_KEY ? SENDGRID_API_KEY.length : 0,
            fromEmail: SENDGRID_FROM_EMAIL ? SENDGRID_FROM_EMAIL : 'Not set'
          }
        },
        { status: 500 }
      );
    }

    // Send a test email
    const testEmail = {
      to: SENDGRID_FROM_EMAIL, // Send to the same email to avoid spam
      from: SENDGRID_FROM_EMAIL,
      subject: 'SendGrid Test Email',
      text: 'This is a test email to verify SendGrid configuration.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>SendGrid Test Successful</h2>
          <p>Your SendGrid configuration is working correctly!</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
      `
    };

    console.log('Testing SendGrid with:', {
      to: testEmail.to,
      from: testEmail.from,
      subject: testEmail.subject
    });

    const result = await sgMail.send(testEmail);
    
    return NextResponse.json(
      {
        success: true,
        message: 'SendGrid test email sent successfully',
        details: {
          statusCode: result[0].statusCode,
          messageId: result[0].headers['x-message-id'],
          apiKeyLength: SENDGRID_API_KEY.length,
          fromEmail: SENDGRID_FROM_EMAIL
        }
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('SendGrid test error:', error);
    console.error('Error details:', error.response?.body || error.message);
    
    return NextResponse.json(
      {
        success: false,
        error: 'SendGrid test failed',
        details: {
          message: error.message,
          code: error.code,
          statusCode: error.response?.status,
          body: error.response?.body
        }
      },
      { status: 500 }
    );
  }
} 