import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Konstante iz .env ili supabase konfiguracije za admin pristup
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Kreiramo admin klijenta sa service_role ključem
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

type RequestData = {
  email: string;
  handleName?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestData;
    const { email, handleName = '' } = body;

    // Validacija ulaznih podataka
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Provera da li su env varijable postavljene
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
      return NextResponse.json(
        { error: 'Server configuration error: Missing Supabase credentials' },
        { status: 500 }
      );
    }

    console.log('Processing invitation for email:', email, 'handle:', handleName || 'not provided');

    // Generišemo token za pozivnicu (6 karaktera, lakše za kucanje)
    const token = crypto.randomBytes(3).toString('hex');
    
    // Koristimo direktan pristup za kreiranje korisnika
    console.log('Creating or updating user account');
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: token,
      email_confirm: false
    });
    
    // Ignorišemo grešku ako korisnik već postoji
    if (createError && !createError.message.includes('already registered') && 
        !createError.message.includes('already exists')) {
      console.error('Error creating user:', createError);
      return NextResponse.json(
        { error: `Failed to create user: ${createError.message}` },
        { status: 500 }
      );
    }
    
    // Proverimo da li postoji pozivnica za ovaj email
    const { data: existingInvitation } = await supabaseAdmin
      .from('invitations')
      .select('id, status')
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();
      
    let invitationId;
    
    if (existingInvitation) {
      // Ažuriramo postojeću pozivnicu
      console.log('Updating existing invitation with new token');
      const { data: updatedInvite, error: updateError } = await supabaseAdmin
        .from('invitations')
        .update({
          token,
          handle_name: handleName || null,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingInvitation.id)
        .select()
        .single();
        
      if (updateError) {
        console.error('Error updating invitation:', updateError);
        return NextResponse.json(
          { error: `Failed to update invitation: ${updateError.message}` },
          { status: 500 }
        );
      }
      
      invitationId = existingInvitation.id;
    } else {
      // Kreiramo novu pozivnicu
      console.log('Creating new invitation record');
      const invitationData = {
        email,
        handle_name: handleName || null,
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
        console.error('Error saving invitation:', inviteError);
        return NextResponse.json(
          { error: `Failed to save invitation: ${inviteError.message}` },
          { status: 500 }
        );
      }
      
      invitationId = newInvite.id;
    }
    
    // Generišemo registracioni URL sa tokenom
    const clientUrl = request.headers.get('origin') || 'http://localhost:3000';
    const registrationUrl = `${clientUrl}/complete-registration?email=${encodeURIComponent(email)}&token=${token}`;
    
    // Pošaljemo email koristeći direktno Supabase inviteUserByEmail
    // ALI postavimo URL koji ćemo koristiti mi
    let emailSent = false;
    try {
      console.log('Sending invitation email via Supabase Auth');
      
      // Prvo pokušamo sa inviteUserByEmail - koja samo šalje mejl, ne pravi automatski korisnika
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        // Postavljamo redirekciju i dodatne metapodatke koji će biti dostupni u šablonu
        redirectTo: registrationUrl,
        data: {
          handle_name: handleName || 'Influencer',
        }
      });
      
      if (inviteError) {
        console.error('Error sending invitation email:', inviteError);
      } else {
        emailSent = true;
        console.log('Invitation email sent successfully to:', email);
      }
    } catch (err) {
      console.error('Error in email sending process:', err);
    }
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Invitation created successfully',
        data: { 
          invitation_id: invitationId,
          registration_url: registrationUrl,
          email,
          handle_name: handleName,
          token,
          email_sent: emailSent
        } 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Unexpected error in invite-user API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 