export interface User {
  id: string
  email: string
  role: 'admin' | 'user'
  full_name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
  last_activity?: string
}

export interface Tag {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

export interface UserTag {
  id: string
  user_id: string
  tag_id: string
  created_at: string
}

export interface UserWithTags extends User {
  tags: Tag[]
  user_tags?: any[]
}

export interface Proposal {
  id: string
  title: string
  logo_url?: string
  company_name: string
  campaign_start_date: string
  campaign_end_date: string
  short_description: string
  content: any
  created_by: string
  disclaimer?: string
  created_at: string
  updated_at: string
}

export interface Response {
  id: string
  proposal_id: string
  user_id: string
  status: 'accepted' | 'rejected' | 'pending_update'
  progress_status?: 'no_response' | 'accepted' | 'live' | 'completed'
  quote?: string
  proposed_publish_date?: string
  platforms: string[]
  video_link?: string
  payment_method: string
  uploaded_video_url?: string
  message?: string
  disclaimer_accepted?: boolean
  admin_approved_at?: string
  campaign_completed_at?: string
  created_at: string
  updated_at: string
}

export interface Chat {
  id: string
  proposal_id: string
  user_id: string
  created_at: string
}

export interface ChatMessage {
  id: string
  chat_id: string
  user_id: string
  message: string
  is_read: boolean
  attachment_url?: string
  file_name?: string
  created_at: string
}

export interface Notification {
  id: string
  recipient_id: string
  title: string
  message: string
  type: 'info' | 'action' | 'popup'
  link_url?: string
  related_proposal_id?: string
  related_response_id?: string
  is_read: boolean
  created_at: string
}

export interface Invitation {
  id: string
  email: string
  invited_by?: string
  status: 'pending' | 'completed'
  created_at: string
  completed_at?: string
  token?: string
  expires_at?: string
  updated_at: string
  tag_id?: string
  tags?: Tag
}

export interface PasswordResetToken {
  id: string
  email: string
  token: string
  status: 'pending' | 'used' | 'expired'
  expires_at: string
  used_at?: string
  created_at: string
  updated_at: string
} 