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
  password: string;
  fullName: string;
  inviteToken: string;
  tagId: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestData;
    const { email, password, fullName, inviteToken, tagId } = body;

    // Validation
    if (!email || !password || !fullName || !inviteToken || !tagId) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate invitation first
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('id, email, token, status, expires_at')
      .eq('email', email)
      .eq('token', inviteToken)
      .eq('status', 'pending')
      .maybeSingle();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation' },
        { status: 400 }
      );
    }

    // Check if invitation has expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    
    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Validate tag exists
    const { data: tag, error: tagError } = await supabaseAdmin
      .from('tags')
      .select('id, name')
      .eq('id', tagId)
      .single();

    if (tagError || !tag) {
      return NextResponse.json(
        { error: 'Invalid tag' },
        { status: 400 }
      );
    }

    // Create user account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since they have a valid invitation
      user_metadata: {
        full_name: fullName
      }
    });

    if (authError || !authData.user) {
      console.error('Error creating user:', authError);
      return NextResponse.json(
        { error: `Failed to create user account: ${authError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Create user profile
    const { data: userData, error: profileError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email: authData.user.email,
          full_name: fullName,
          avatar_url: '/default-avatar.svg',
          role: 'user'
        }
      ])
      .select('role, full_name, avatar_url')
      .single();

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      // Don't fail completely, profile can be created later
    }

    // Assign tag to user
    const { error: tagAssignError } = await supabaseAdmin
      .from('user_tags')
      .insert([
        {
          user_id: authData.user.id,
          tag_id: tagId
        }
      ]);

    if (tagAssignError) {
      console.error('Error assigning tag to user:', tagAssignError);
      // Don't fail completely, tag can be assigned later
    }

    // Mark invitation as completed
    const { error: updateInviteError } = await supabaseAdmin
      .from('invitations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', invitation.id);

    if (updateInviteError) {
      console.error('Error updating invitation status:', updateInviteError);
      // Don't fail completely
    }

    console.log(`User ${email} successfully registered with invitation and assigned tag: ${tag.name}`);

    return NextResponse.json(
      { 
        success: true,
        message: 'Account created successfully',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          full_name: fullName
        },
        userData: userData || {
          role: 'user',
          full_name: fullName,
          avatar_url: '/default-avatar.svg'
        },
        tag: {
          id: tag.id,
          name: tag.name
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Unexpected error in signup-with-invite API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 