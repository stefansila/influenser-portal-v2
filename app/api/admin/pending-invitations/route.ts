import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Fetch pending invitations - jednostavno bez tag-ova za sada
    const { data: invitations, error } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ 
      success: true, 
      invitations: invitations || [] 
    })

  } catch (error: any) {
    console.error('Error fetching pending invitations:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch pending invitations' },
      { status: 500 }
    )
  }
} 