import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function DELETE(request: NextRequest) {
  try {
    const { invitationId } = await request.json()

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      )
    }

    // Delete the invitation
    const { error: deleteError } = await supabaseAdmin
      .from('invitations')
      .delete()
      .eq('id', invitationId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Invitation deleted successfully' 
    })

  } catch (error: any) {
    console.error('Error deleting invitation:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete invitation' },
      { status: 500 }
    )
  }
} 