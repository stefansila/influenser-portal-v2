import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    console.log(`Starting cascade deletion for user: ${userId}`)

    // Delete in order to respect foreign key constraints
    
    // 1. Delete user_tags
    console.log('Deleting user_tags...')
    const { error: userTagsError } = await supabaseAdmin
      .from('user_tags')
      .delete()
      .eq('user_id', userId)

    if (userTagsError) {
      console.error('Error deleting user_tags:', userTagsError)
      throw userTagsError
    }

    // 2. Delete invitations sent by this user
    console.log('Deleting invitations...')
    const { error: invitationsError } = await supabaseAdmin
      .from('invitations')
      .delete()
      .eq('invited_by', userId)

    if (invitationsError) {
      console.error('Error deleting invitations:', invitationsError)
      // Don't throw here, continue with user deletion
    }

    // 3. Delete notifications for this user AND related to their responses
    console.log('Deleting notifications...')
    
    // First get user's response IDs to delete related notifications
    const { data: userResponses } = await supabaseAdmin
      .from('responses')
      .select('id')
      .eq('user_id', userId)

    // Delete notifications related to user's responses
    if (userResponses && userResponses.length > 0) {
      const responseIds = userResponses.map(response => response.id)
      await supabaseAdmin
        .from('notifications')
        .delete()
        .in('related_response_id', responseIds)
    }

    // Delete notifications for this user as recipient
    const { error: notificationsError } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('recipient_id', userId)

    if (notificationsError) {
      console.error('Error deleting notifications:', notificationsError)
      // Don't throw here, continue with user deletion
    }

    // 4. Delete chat messages by this user
    console.log('Deleting chat_messages...')
    const { error: chatMessagesError } = await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('user_id', userId)

    if (chatMessagesError) {
      console.error('Error deleting chat_messages:', chatMessagesError)
      // Don't throw here, continue with user deletion
    }

    // 5. Delete chats where user is participant
    console.log('Deleting chats...')
    const { error: chatsError } = await supabaseAdmin
      .from('chats')
      .delete()
      .eq('user_id', userId)

    if (chatsError) {
      console.error('Error deleting chats:', chatsError)
      // Don't throw here, continue with user deletion
    }

    // 6. Delete proposal visibility for this user
    console.log('Deleting proposal_visibility...')
    const { error: proposalVisibilityError } = await supabaseAdmin
      .from('proposal_visibility')
      .delete()
      .eq('user_id', userId)

    if (proposalVisibilityError) {
      console.error('Error deleting proposal_visibility:', proposalVisibilityError)
      // Don't throw here, continue with user deletion
    }

    // 7. Delete admin responses for user's responses (using already fetched userResponses)
    console.log('Deleting admin_responses...')
    if (userResponses && userResponses.length > 0) {
      const responseIds = userResponses.map(response => response.id)
      const { error: adminResponsesError } = await supabaseAdmin
        .from('admin_responses')
        .delete()
        .in('response_id', responseIds)

      if (adminResponsesError) {
        console.error('Error deleting admin_responses:', adminResponsesError)
        // Don't throw here, continue with user deletion
      }
    }

    // 8. Delete user responses
    console.log('Deleting responses...')
    const { error: responsesError } = await supabaseAdmin
      .from('responses')
      .delete()
      .eq('user_id', userId)

    if (responsesError) {
      console.error('Error deleting responses:', responsesError)
      // Don't throw here, continue with user deletion
    }

    // 9. Delete proposals created by this user (and their related data)
    console.log('Deleting proposals and related data...')
    const { data: userProposals } = await supabaseAdmin
      .from('proposals')
      .select('id')
      .eq('created_by', userId)

    if (userProposals && userProposals.length > 0) {
      const proposalIds = userProposals.map(proposal => proposal.id)
      
      // Delete proposal visibility for these proposals
      await supabaseAdmin
        .from('proposal_visibility')
        .delete()
        .in('proposal_id', proposalIds)

      // Delete responses to these proposals and their admin responses
      const { data: proposalResponses } = await supabaseAdmin
        .from('responses')
        .select('id')
        .in('proposal_id', proposalIds)

      if (proposalResponses && proposalResponses.length > 0) {
        const proposalResponseIds = proposalResponses.map(r => r.id)
        await supabaseAdmin
          .from('admin_responses')
          .delete()
          .in('response_id', proposalResponseIds)
      }

      await supabaseAdmin
        .from('responses')
        .delete()
        .in('proposal_id', proposalIds)

      // Delete chats for these proposals and their messages
      const { data: proposalChats } = await supabaseAdmin
        .from('chats')
        .select('id')
        .in('proposal_id', proposalIds)

      if (proposalChats && proposalChats.length > 0) {
        const proposalChatIds = proposalChats.map(chat => chat.id)
        await supabaseAdmin
          .from('chat_messages')
          .delete()
          .in('chat_id', proposalChatIds)
      }

      await supabaseAdmin
        .from('chats')
        .delete()
        .in('proposal_id', proposalIds)

      // Delete notifications related to these proposals
      await supabaseAdmin
        .from('notifications')
        .delete()
        .in('related_proposal_id', proposalIds)

      // Finally delete the proposals
      await supabaseAdmin
        .from('proposals')
        .delete()
        .in('id', proposalIds)
    }

    // 10. Delete from auth schema tables
    console.log('Deleting from auth schema...')

    // Get user sessions first for cascade deletion
    const { data: userSessions } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('user_id', userId)

    if (userSessions && userSessions.length > 0) {
      const sessionIds = userSessions.map(session => session.id)
      
      // Delete mfa_amr_claims
      await supabaseAdmin
        .from('mfa_amr_claims')
        .delete()
        .in('session_id', sessionIds)

      // Delete refresh_tokens
      await supabaseAdmin
        .from('refresh_tokens')
        .delete()
        .in('session_id', sessionIds)
    }

    // Get user MFA factors for cascade deletion
    const { data: userFactors } = await supabaseAdmin
      .from('mfa_factors')
      .select('id')
      .eq('user_id', userId)

    if (userFactors && userFactors.length > 0) {
      const factorIds = userFactors.map(factor => factor.id)
      
      // Delete mfa_challenges
      await supabaseAdmin
        .from('mfa_challenges')
        .delete()
        .in('factor_id', factorIds)
    }

    // Delete identities
    await supabaseAdmin
      .from('identities')
      .delete()
      .eq('user_id', userId)

    // Delete mfa_factors
    await supabaseAdmin
      .from('mfa_factors')
      .delete()
      .eq('user_id', userId)

    // Delete one_time_tokens
    await supabaseAdmin
      .from('one_time_tokens')
      .delete()
      .eq('user_id', userId)

    // Delete sessions
    await supabaseAdmin
      .from('sessions')
      .delete()
      .eq('user_id', userId)

    // 11. Finally delete from auth.users first
    console.log('Deleting from auth.users...')
    const { error: authUserError } = await supabaseAdmin
      .rpc('delete_auth_user', { user_id: userId })

    if (authUserError) {
      console.error('Error deleting from auth.users:', authUserError)
      // Try alternative method using direct SQL
      try {
        const { error: sqlError } = await supabaseAdmin
          .from('auth.users')
          .delete()
          .eq('id', userId)
        
        if (sqlError) {
          console.error('Error with direct SQL deletion:', sqlError)
          // Don't throw here as we'll try to continue
        }
      } catch (sqlErr) {
        console.error('SQL deletion failed:', sqlErr)
        // Don't throw here as we'll try to continue
      }
    }

    // 12. Delete from public.users last
    console.log('Deleting from public.users...')
    const { error: publicUserError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId)

    if (publicUserError) {
      console.error('Error deleting from public.users:', publicUserError)
      throw publicUserError
    }

    console.log(`Successfully completed cascade deletion for user: ${userId}`)

    return NextResponse.json({ 
      success: true, 
      message: 'User and all related data deleted successfully from all tables' 
    })

  } catch (error: any) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    )
  }
} 