import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  password: string;
  fullName: string;
  token: string;
  phoneNumber?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestData;
    const { email, password, fullName, token, phoneNumber } = body;

    // Validacija ulaznih podataka
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Registration token is required' },
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

    console.log('Validating invitation for:', email, 'with token:', token);

    // Prvo proverimo da li postoji validna pozivnica
    const { data: invitationData, error: invitationError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('email', email)
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (invitationError || !invitationData) {
      console.error('No valid invitation found:', invitationError);
      return NextResponse.json(
        { error: 'Invalid or expired invitation. Please request a new invitation.' },
        { status: 403 }
      );
    }

    console.log('Valid invitation found, processing user account:', email);

    // Prvo pokušamo da nađemo korisnika
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error listing users:', userError);
      return NextResponse.json(
        { error: 'Failed to check if user exists' },
        { status: 500 }
      );
    }
    
    // Pronađi korisnika po email adresi
    const existingUser = userData.users.find(u => u.email === email);
    let userId;
    
    if (existingUser) {
      console.log('Found existing user, updating password and metadata:', existingUser.id);
      
      // Ažuriramo postojećeg korisnika
      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName || existingUser.user_metadata?.full_name }
        }
      );
      
      if (updateError) {
        console.error('Error updating user:', updateError);
        return NextResponse.json(
          { error: `Failed to update user: ${updateError.message}` },
          { status: 500 }
        );
      }
      
      userId = existingUser.id;
      console.log('User updated successfully:', userId);
    } else {
      // Ako korisnik ne postoji, kreiramo ga (ovo ne bi trebalo da se desi, ali za svaki slučaj)
      console.log('User not found, creating new user:', email);
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      });
      
      if (createError) {
        console.error('Error creating user:', createError);
        return NextResponse.json(
          { error: `Failed to create user: ${createError.message}` },
          { status: 500 }
        );
      }
      
      userId = newUser.user.id;
      console.log('User created successfully:', userId);
    }

    // Kreiraj ili ažuriraj profil korisnika u tabeli users
    if (userId) {
      try {
        const { error: upsertError } = await supabaseAdmin
          .from('users')
          .upsert({
            id: userId,
            email,
            full_name: fullName,
            phone_number: phoneNumber || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
          
        if (upsertError) {
          console.error('Error updating user profile:', upsertError);
          // Nastavljamo dalje jer je autentikacija uspešna
        }
      } catch (profileError) {
        console.error('Error upserting user profile:', profileError);
        // Nastavljamo dalje jer je korisnik uspešno kreiran/ažuriran
      }
    }
    
    // Ažuriramo status pozivnice
    const { error: inviteUpdateError } = await supabaseAdmin
      .from('invitations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', invitationData.id);
      
    if (inviteUpdateError) {
      console.error('Error updating invitation status:', inviteUpdateError);
      // Nastavljamo dalje jer je korisnik uspešno ažuriran
    }

    return NextResponse.json(
      { 
        success: true,
        user: { 
          id: userId, 
          email,
          full_name: fullName,
          phone_number: phoneNumber || null
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Unexpected error in create-user API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 