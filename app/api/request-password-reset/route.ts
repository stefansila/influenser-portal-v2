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
              
              <div id="m_-7673566046026793084m_-7748363817843247096Signature">
                <div style="font-family:&quot;Segoe UI&quot;,&quot;Segoe UI Web (West European)&quot;,&quot;Helvetica Neue&quot;,sans-serif;font-size:12pt;color:rgb(0,0,0)">
                  <br>
                </div>
                <div style="font-family:&quot;Segoe UI&quot;,&quot;Segoe UI Web (West European)&quot;,&quot;Helvetica Neue&quot;,sans-serif;font-size:12pt;color:rgb(0,0,0)">
                  <br>
                </div>
                <table style="margin:0px;box-sizing:border-box;border-collapse:collapse;border-spacing:0px">
                  <tbody>
                    <tr>
                      <td style="padding-right:1px">
                        <table style="margin:0px;box-sizing:border-box;border-collapse:collapse;border-spacing:0px">
                          <tbody>
                            <tr>
                              <td align="center" style="padding-right:10px;vertical-align:top">
                                <table style="margin:0px;box-sizing:border-box;border-collapse:collapse;border-spacing:0px">
                                  <tbody>
                                    <tr>
                                      <td style="padding-right:1px">
                                        <p style="margin:1px"><span style="font-family:&quot;Segoe UI&quot;,&quot;Segoe UI Web (West European)&quot;,&quot;Helvetica Neue&quot;,sans-serif;font-size:12pt;color:rgb(0,0,0)"><img title="Profile Picture" width="82" height="82" style="width:82px;height:82px;max-width:82px;margin-top:0px;margin-bottom:0px;display:block" src="https://ci3.googleusercontent.com/meips/ADKq_NY4gRRXNR6NH3jphoki8KrBZIlD3Ld9RKJ_bWfsypzIbN7D5MDMb3X2ITjB_nlK8t7VHqEeEDt9jhA8o2qYXmApi_I-LF6RtoZX=s0-d-e1-ft#https://signaturehound.com/api/v1/file/eis7klr7cccl4" class="CToWUd" data-bit="iit"></span></p>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                              <td style="padding-right:12px;padding-left:1px;vertical-align:top">
                                <table style="margin:0px;box-sizing:border-box;border-collapse:collapse;border-spacing:0px">
                                  <tbody>
                                    <tr>
                                      <td style="line-height:14px;white-space:nowrap;padding-right:1px">
                                        <p style="line-height:14px;white-space:nowrap;margin:1px;font-family:Tahoma,sans-serif;font-size:11px;font-weight:700;color:rgb(0,0,0)">
                                          Aleem Fidai</p>
                                        <p style="line-height:15px;white-space:nowrap;margin:1px;font-family:Tahoma,sans-serif;font-size:11px;color:rgb(0,0,0)">
                                          Founder &amp; CEO</p>
                                        <p style="line-height:15px;white-space:nowrap;margin:1px;font-family:Tahoma,sans-serif;font-size:11px;color:rgb(0,0,0)">
                                          Senergy Communications Capital Inc.</p>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                              <td style="border-right:2px solid rgb(0,0,0);padding-top:1px"></td>
                              <td style="padding-right:1px;padding-left:12px;vertical-align:top">
                                <table style="margin:0px;box-sizing:border-box;border-collapse:collapse;border-spacing:0px">
                                  <tbody>
                                    <tr>
                                      <td style="padding-right:1px">
                                        <table style="margin:0px;box-sizing:border-box;border-collapse:collapse;border-spacing:0px">
                                          <tbody>
                                            <tr>
                                              <td style="line-height:14px;white-space:nowrap;padding-right:1px;color:rgb(0,0,1)">
                                                <p style="line-height:14px;white-space:nowrap;margin:1px"><span style="font-family:Tahoma,sans-serif;font-size:11px;color:rgb(0,0,0);line-height:14px"><a href="mailto:aleem@senergy.capital" style="color:rgb(0,0,0);text-decoration:none;margin-top:0px;margin-bottom:0px" target="_blank">aleem@senergy.capital</a></span></p>
                                              </td>
                                            </tr>
                                            <tr>
                                              <td style="line-height:14px;white-space:nowrap;padding-right:1px;color:rgb(0,0,1)">
                                                <p style="line-height:14px;white-space:nowrap;margin:1px"><span style="font-family:Tahoma,sans-serif;font-size:11px;color:rgb(0,0,0);line-height:14px">+1 778-772-6740</span></p>
                                              </td>
                                            </tr>
                                            <tr>
                                              <td style="line-height:14px;white-space:nowrap;padding-right:1px;color:rgb(0,0,1)">
                                                <p style="line-height:14px;white-space:nowrap;margin:1px"><span style="font-family:Tahoma,sans-serif;font-size:11px;color:rgb(0,0,0);line-height:14px">228-1122 Mainland Street</span></p>
                                              </td>
                                            </tr>
                                            <tr>
                                              <td style="line-height:14px;white-space:nowrap;padding-right:1px;color:rgb(0,0,1)">
                                                <p style="line-height:14px;white-space:nowrap;margin:1px"><span style="font-family:Tahoma,sans-serif;font-size:11px;color:rgb(0,0,0);line-height:14px">Vancouver, BC, V6B 5L1</span></p>
                                              </td>
                                            </tr>
                                            <tr>
                                              <td style="line-height:14px;white-space:nowrap;padding-top:6px;padding-right:3px;color:rgb(0,0,1)">
                                                <p style="line-height:14px;white-space:nowrap;margin:1px"><span style="font-family:Tahoma,sans-serif;font-size:11px;color:rgb(0,0,0);line-height:14px;font-weight:700"><a href="https://www.senergy.capital/" style="color:rgb(0,0,0);text-decoration:none;margin-top:0px;margin-bottom:0px" target="_blank">senergy.capital</a></span></p>
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                            <tr>
                              <td colspan="4" style="border-bottom:2px solid rgb(0,0,0);padding-right:1px;padding-bottom:10px">
                              </td>
                            </tr>
                            <tr>
                              <td colspan="4" style="padding-top:10px;padding-right:1px;vertical-align:middle">
                                <table style="margin:0px;box-sizing:border-box;border-collapse:collapse;border-spacing:0px">
                                  <tbody>
                                    <tr>
                                      <td style="line-height:0px;padding-right:1px;width:24px">
                                        <p style="line-height:0px;margin:1px"><span style="font-family:&quot;Segoe UI&quot;,&quot;Segoe UI Web (West European)&quot;,&quot;Helvetica Neue&quot;,sans-serif;font-size:0px;color:rgb(0,0,0)"><a href="https://x.com/SenergyCapital" style="text-decoration:none;margin-top:0px;margin-bottom:0px" target="_blank"><img width="24" height="24" style="width:24px;height:24px;margin-top:0px;margin-bottom:0px;display:block" src="https://ci3.googleusercontent.com/meips/ADKq_NZYOvBhG-wcQ9mvA_Hfz5EA_LuU0Kp7lS-25T8cBhVoiDo3IsaLRA8qMJ0fyZxnq4E9taQEEhKafEev4SVqFM-vjSOebWsVnpZ4MIv6D7k=s0-d-e1-ft#https://signaturehound.com/api/v1/png/x/square/000000.png" class="CToWUd" data-bit="iit"></a></span></p>
                                      </td>
                                      <td style="padding-bottom:1px;width:2px"></td>
                                      <td style="line-height:0px;padding-right:1px;width:24px">
                                        <p style="line-height:0px;margin:1px"><span style="font-family:&quot;Segoe UI&quot;,&quot;Segoe UI Web (West European)&quot;,&quot;Helvetica Neue&quot;,sans-serif;font-size:0px;color:rgb(0,0,0)"><a href="https://www.instagram.com/senergycapital" style="text-decoration:none;margin-top:0px;margin-bottom:0px" target="_blank"><img width="24" height="24" style="width:24px;height:24px;margin-top:0px;margin-bottom:0px;display:block" src="https://ci3.googleusercontent.com/meips/ADKq_NbfCTbDilMo0ShN9kkGPE3559gfEgP6yDAktNlLhomDg0Uji6BE_cv8tDT5G9dqdQDuNx1NFoC1vu6XueY-m3gjed07MbCh0ePTAMkMuUFOYkO5AnZ9JQ=s0-d-e1-ft#https://signaturehound.com/api/v1/png/instagram/square/000000.png" class="CToWUd" data-bit="iit"></a></span></p>
                                      </td>
                                      <td style="padding-bottom:1px;width:2px"></td>
                                      <td style="line-height:0px;padding-right:1px;width:24px">
                                        <p style="line-height:0px;margin:1px"><span style="font-family:&quot;Segoe UI&quot;,&quot;Segoe UI Web (West European)&quot;,&quot;Helvetica Neue&quot;,sans-serif;font-size:0px;color:rgb(0,0,0)"><a href="https://www.linkedin.com/company/senergy-communications-inc." style="text-decoration:none;margin-top:0px;margin-bottom:0px" target="_blank"><img width="24" height="24" style="width:24px;height:24px;margin-top:0px;margin-bottom:0px;display:block" src="https://ci3.googleusercontent.com/meips/ADKq_NbApnuw23QKJxHbUFZq81fZyke_5a0Xibs2bC2dW78Rp1sVzRIetkC1AWi4CBqQj93ZJAJUfYn1onxLB3kOdB-rdqwEaLsyyw4e0FITTRnT7QT1lXWp=s0-d-e1-ft#https://signaturehound.com/api/v1/png/linkedin/square/000000.png" class="CToWUd" data-bit="iit"></a></span></p>
                                      </td>
                                      <td style="padding-bottom:1px;width:2px"></td>
                                      <td style="line-height:0px;padding-right:1px;width:24px">
                                        <p style="line-height:0px;margin:1px"><span style="font-family:&quot;Segoe UI&quot;,&quot;Segoe UI Web (West European)&quot;,&quot;Helvetica Neue&quot;,sans-serif;font-size:0px;color:rgb(0,0,0)"><a href="https://www.youtube.com/channel/UC4ct0weO1n5cZbLMLisg5zg" style="text-decoration:none;margin-top:0px;margin-bottom:0px" target="_blank"><img width="24" height="24" style="width:24px;height:24px;margin-top:0px;margin-bottom:0px;display:block" src="https://ci3.googleusercontent.com/meips/ADKq_NbP_Xme7t3sMHMD7Sl4TXd4NuxzcY_Q9OodL1EIhsE91yTSDkx47PeTBsHD_ng2drJg4_PCf-68HyYpfkc7ZJ5hfQwb6FUnrLacL1iGHDHBKSKvnq8=s0-d-e1-ft#https://signaturehound.com/api/v1/png/youtube/square/000000.png" class="CToWUd" data-bit="iit"></a></span></p>
                                      </td>
                                      <td style="padding-bottom:1px;width:2px"></td>
                                      <td style="line-height:0px;padding-right:1px;width:24px">
                                        <p style="line-height:0px;margin:1px"><span style="font-family:&quot;Segoe UI&quot;,&quot;Segoe UI Web (West European)&quot;,&quot;Helvetica Neue&quot;,sans-serif;font-size:0px;color:rgb(0,0,0)"><a href="https://rss.com/podcasts/senergy" style="text-decoration:none;margin-top:0px;margin-bottom:0px" target="_blank"><img width="24" height="24" style="width:24px;height:24px;margin-top:0px;margin-bottom:0px;display:block" src="https://ci3.googleusercontent.com/meips/ADKq_NaaLXveRHKP7oFzgOmnqomMsitUHbUN-FW2OmcazgTlAcWhs7uKj_a8GfnqvDRb-cy4ApyWkyURpCQtuwq0ldaJWASkwdnR5Bv7jVcjp-7NhbnuQwY=s0-d-e1-ft#https://signaturehound.com/api/v1/png/podcast/square/000000.png" class="CToWUd" data-bit="iit"></a></span></p>
                                      </td>
                                      <td style="padding-bottom:1px;width:2px"></td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-top:12px;padding-right:1px">
                        <table style="margin:0px;box-sizing:border-box;border-collapse:collapse;border-spacing:0px">
                          <tbody>
                            <tr>
                              <td style="padding-right:1px">
                                <table style="margin:0px;box-sizing:border-box;border-collapse:collapse;border-spacing:0px">
                                  <tbody>
                                    <tr>
                                      <td style="padding-right:1px">
                                        <p style="margin:1px"><span style="font-family:&quot;Segoe UI&quot;,&quot;Segoe UI Web (West European)&quot;,&quot;Helvetica Neue&quot;,sans-serif;font-size:12pt;color:rgb(0,0,0)"><a href="https://signaturehound.com/signature/cta/eis7klr79k6mt" style="text-decoration:none;margin-top:0px;margin-bottom:0px" target="_blank"><img title="Call To Action" width="230" height="115" style="width:230px;height:115px;max-width:230px;margin-top:0px;margin-bottom:0px;display:block" src="https://ci3.googleusercontent.com/meips/ADKq_NaR8l9owyKgOzTzubBp30Ivac8r7-DkfpQFXBxfZiCGajLa4Xfk_QfRLn0Z3uw4fgNO7nx4rRfi-ougThM8UzXuE5SpgNgRySuy9O8=s0-d-e1-ft#https://signaturehound.com/api/v1/file/bwqk0pklr7cqamu" class="CToWUd" data-bit="iit"></a></span></p>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style="font-family:&quot;Segoe UI&quot;,&quot;Segoe UI Web (West European)&quot;,&quot;Helvetica Neue&quot;,sans-serif;font-size:12pt;color:rgb(0,0,0)">
                  <br>
                </div>
              </div>
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