'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'

type ResponseDetail = {
  id: string
  status: 'accepted' | 'rejected' | 'pending' | 'pending_update'
  quote: string
  proposed_publish_date: string | null
  platforms: string[]
  payment_method: string
  uploaded_video_url: string | null
  video_link: string | null
  created_at: string
  user_id: string
  proposal_id: string
  user_email: string
  proposal_title: string
  company_name: string
  progress_status?: 'no_response' | 'accepted' | 'live' | 'completed'
  admin_approved_at?: string
  campaign_completed_at?: string
  user_tags?: Array<{
    id: string
    name: string
    color: string
  }>
  admin_response?: {
    id: string | null
    status: 'pending' | 'approved' | 'rejected' | 'completed'
  } | null
  chat_id: string | null
}

export default function ResponseDetailPage() {
  console.log('ResponseDetailPage component rendered')
  const params = useParams()
  const id = params?.id ? (typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '') : ''
  const router = useRouter()
  const { user } = useAuth()
  const [response, setResponse] = useState<ResponseDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showResponseForm, setShowResponseForm] = useState(false)
  const [responseAction, setResponseAction] = useState<'approved' | 'rejected'>('approved')
  const [adminMessage, setAdminMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdateAction, setIsUpdateAction] = useState(false)
  const [isCreatingChat, setIsCreatingChat] = useState(false)
  
  const fetchResponseDetails = async (setLoadingState = true) => {
    try {
      console.log('fetchResponseDetails called with setLoadingState:', setLoadingState)
      if (setLoadingState) {
        setIsLoading(true)
      }
      
      // First fetch the response
      const { data: responseData, error: responseError } = await supabase
        .from('responses')
        .select(`
          id,
          status,
          quote,
          proposed_publish_date,
          platforms,
          payment_method,
          uploaded_video_url,
          video_link,
          created_at,
          user_id,
          proposal_id,
          progress_status,
          admin_approved_at,
          campaign_completed_at
        `)
        .eq('id', id)
        .single()
      
      if (responseError) {
        console.error('Error fetching response:', responseError)
        router.push('/admin')
        return
      }
      
      console.log('Fetched response data:', responseData)
      
      // Fetch user info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('id', responseData.user_id)
        .single()
        
      if (userError) {
        console.error('Error fetching user:', userError)
      }
      
      // Fetch proposal info
      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select('title, company_name')
        .eq('id', responseData.proposal_id)
        .single()
        
      if (proposalError) {
        console.error('Error fetching proposal:', proposalError)
      }

      // Fetch admin response if exists
      const { data: adminResponseData, error: adminResponseError } = await supabase
        .from('admin_responses')
        .select('id, status')
        .eq('response_id', id)
        .maybeSingle()

      if (adminResponseError) {
        console.error('Error fetching admin response:', adminResponseError)
      }
      
      // Fetch chat if exists
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .eq('proposal_id', responseData.proposal_id)
        .order('created_at', { ascending: false })
        .maybeSingle()
        
      if (chatError) {
        console.error('Error fetching chat:', chatError)
      }

      // Fetch user tags
      const { data: userTagsData, error: userTagsError } = await supabase
        .from('user_tags')
        .select(`
          tags (
            id,
            name,
            color
          )
        `)
        .eq('user_id', responseData.user_id)

      if (userTagsError) {
        console.error('Error fetching user tags:', userTagsError)
      }
      
      // Combine all data
      const combinedData: ResponseDetail = {
        ...responseData,
        user_email: userData?.email || 'Unknown User',
        proposal_title: proposalData?.title || 'Unknown Proposal',
        company_name: proposalData?.company_name || '',
        user_tags: userTagsData?.map((ut: any) => ut.tags).filter(Boolean) || [],
        admin_response: adminResponseData,
        chat_id: chatData?.id || null
      }
      
      console.log('Setting response state to:', combinedData)
      console.log('fetchResponseDetails is about to call setResponse')
      setResponse(combinedData)
      console.log('Response state set successfully')
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      if (setLoadingState) {
        setIsLoading(false)
      }
    }
  }
  
  useEffect(() => {
    console.log('useEffect triggered with id:', id)
    console.log('useEffect dependency [id] changed')
    if (id) {
      fetchResponseDetails(true)
    }
  }, [id])

  const handleSubmitResponse = async () => {
    if (!response) return
    
    console.log('handleSubmitResponse called with action:', responseAction)
    setIsSubmitting(true)
    
    try {
      // Check if admin response already exists
      const adminResponseExists = response.admin_response?.id
      
      // Only set response to pending_update if this is an Update Response action and message changed
      const isUpdatingExistingResponse = adminResponseExists && isUpdateAction;
      
      if (adminResponseExists) {
        // Update existing admin response (without message_to_user field)
        const { error } = await supabase
          .from('admin_responses')
          .update({
            status: responseAction,
          })
          .eq('id', adminResponseExists)
        
        if (error) throw error
        
        // If approving, update progress_status to 'live' and set admin_approved_at
        if (responseAction === 'approved') {
          const { error: progressError } = await supabase
            .from('responses')
            .update({
              progress_status: 'live',
              admin_approved_at: new Date().toISOString()
            })
            .eq('id', response.id)
          
          if (progressError) {
            console.error('Error updating progress status:', progressError)
          }
        }
        
        // Only set response to pending_update if admin clicked Update Response
        if (isUpdatingExistingResponse) {
          // Set the user's response to pending_update
          const { error: responseUpdateError } = await supabase
            .from('responses')
            .update({
              status: 'pending_update',
            })
            .eq('id', response.id)
          
          if (responseUpdateError) {
            console.error('Error updating response status:', responseUpdateError)
          }
          
          // Update local state to reflect pending_update status
          setResponse({
            ...response,
            status: 'pending_update',
            admin_response: {
              id: response.admin_response?.id || null,
              status: responseAction,
            }
          })
        } else {
          // Just update the admin response info and progress_status if approved
          const updatedResponse = {
            ...response,
            admin_response: {
              id: response.admin_response?.id || null,
              status: responseAction,
            }
          }
          
          // If approving, also update progress_status to 'live'
          if (responseAction === 'approved') {
            updatedResponse.progress_status = 'live'
            updatedResponse.admin_approved_at = new Date().toISOString()
          }
          
          setResponse(updatedResponse)
        }
      } else {
        // Create new admin response (without message_to_user field)
        const { error } = await supabase
          .from('admin_responses')
          .insert({
            response_id: response.id,
            status: responseAction,
          })
        
        if (error) throw error
        
        // If approving, update progress_status to 'live' and set admin_approved_at
        if (responseAction === 'approved') {
          const { error: progressError } = await supabase
            .from('responses')
            .update({
              progress_status: 'live',
              admin_approved_at: new Date().toISOString()
            })
            .eq('id', response.id)
          
          if (progressError) {
            console.error('Error updating progress status:', progressError)
          }
        }
        
        // Update local state without changing response status
        setResponse({
          ...response,
          admin_response: {
            id: null, // Will be assigned by database
            status: responseAction,
          }
        })
      }
      
      // If admin provided a message, create a chat message
      if (adminMessage.trim()) {
        // Find the chat for this response
        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .select('id')
          .eq('proposal_id', response.proposal_id)
          .eq('user_id', response.user_id)
          .single()
        
        if (chatError) {
          console.error('Error finding chat:', chatError)
        } else if (chatData) {
          // Create the chat message from admin
          const { error: messageError } = await supabase
            .from('chat_messages')
            .insert({
              chat_id: chatData.id,
              user_id: user!.id, // Admin user ID
              message: adminMessage.trim()
            })
          
          if (messageError) {
            console.error('Error creating chat message:', messageError)
          }
        }
      }
      
      // Reset the update action flag
      setIsUpdateAction(false)
      
      // Hide the form
      setShowResponseForm(false)
    } catch (error) {
      console.error('Error submitting admin response:', error)
      alert('Failed to submit response. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCompleteOffer = async (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    if (!response) return
    
    const confirmed = confirm('Are you sure you want to mark this offer as completed? This action cannot be undone.')
    if (!confirmed) return
    
    setIsSubmitting(true)
    
    try {
      console.log('Calling complete_offer function...')
      console.log('Response ID:', response.id)
      console.log('Admin Response ID:', response.admin_response?.id)
      
      // Use RPC to call the complete_offer function which bypasses RLS
      const { data, error } = await supabase.rpc('complete_offer', {
        response_id: response.id,
        admin_response_id: response.admin_response?.id || null
      })
      
      if (error) {
        console.error('RPC Error:', error)
        
        // RPC call failed, throw error
        throw new Error(`RPC call failed: ${error.message}`)
      } else {
        console.log('RPC Response:', data)
        
        // Check if the function returned an error
        if (data && !data.success) {
          throw new Error(data.error || 'Function returned error')
        }
      }
      
      console.log('Database updates completed via RPC, updating local state...')
      // Update local state immediately to reflect the change
      const updatedResponse = {
        ...response,
        progress_status: 'completed' as const,
        campaign_completed_at: new Date().toISOString(),
        admin_response: response.admin_response ? {
          id: response.admin_response.id,
          status: 'completed' as 'pending' | 'approved' | 'rejected' | 'completed'
        } : null
      }
      
      setResponse(updatedResponse)
      
      console.log('handleCompleteOffer completed successfully')
      alert('Offer has been marked as completed successfully!')
    } catch (error: any) {
      console.error('Error completing offer:', error)
      
      // If RPC function doesn't exist, fall back to direct updates
      if (error.message?.includes('function complete_offer') || error.code === '42883') {
        console.log('RPC function not found, falling back to direct updates...')
        try {
          // Fallback: First try to clean up notifications safely
          try {
            // Delete notifications for this response
            const { data: notificationsToDelete } = await supabase
              .from('notifications')
              .select('id')
              .eq('related_response_id', response.id)
              .eq('recipient_id', response.user_id)
              .eq('title', 'Admin responded to your reply')
              .eq('is_read', false)
            
            if (notificationsToDelete && notificationsToDelete.length > 0) {
              const notificationIds = notificationsToDelete.map(n => n.id)
              
              // Delete notifications
              await supabase
                .from('notifications')
                .delete()
                .in('id', notificationIds)
            }
          } catch (cleanupError) {
            console.warn('Cleanup failed, continuing with updates:', cleanupError)
          }
          
          // Fallback to direct table updates
          const { data: responseUpdateData, error: responseError } = await supabase
            .from('responses')
            .update({
              progress_status: 'completed' as const,
              campaign_completed_at: new Date().toISOString()
            })
            .eq('id', response.id)
            .select()
          
          if (responseError) {
            console.error('Fallback: Error updating response:', responseError)
            throw new Error(`Failed to update response: ${responseError.message}`)
          }
          
          console.log('Fallback: Response update successful:', responseUpdateData)
          
          // Also update admin_response status to 'completed'
          if (response.admin_response?.id) {
            const { data: adminUpdateData, error: adminError } = await supabase
              .from('admin_responses')
              .update({
                status: 'completed'
              })
              .eq('id', response.admin_response.id)
              .select()
            
            if (adminError) {
              console.error('Fallback: Error updating admin response:', adminError)
              // Don't throw here, just log the error
            } else {
              console.log('Fallback: Admin response update successful:', adminUpdateData)
            }
          }
          
          // Update local state
          const updatedResponse = {
            ...response,
            progress_status: 'completed' as const,
            campaign_completed_at: new Date().toISOString(),
            admin_response: response.admin_response ? {
              id: response.admin_response.id,
              status: 'completed' as 'pending' | 'approved' | 'rejected' | 'completed'
            } : null
          }
          
          setResponse(updatedResponse)
          alert('Offer has been marked as completed successfully!')
        } catch (fallbackError: any) {
          console.error('Fallback also failed:', fallbackError)
          alert(`Failed to complete offer: ${fallbackError.message || 'Unknown error'}. This may be due to a database constraint issue. Please contact support.`)
        }
      } else {
        // Show error message
        alert(`Failed to complete offer: ${error.message || 'Unknown error'}. Please check the console for details.`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Format date function
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  }
  
  // Update the function to only find and open existing chats
  const handleOpenChat = async () => {
    if (!response) return;
    
    if (response.chat_id) {
      // If chat exists in the response data, navigate to it
      router.push(`/admin/chats/${response.chat_id}?proposalId=${response.proposal_id}`);
    } else {
      // We'll search for any chat with this user and proposal
      setIsCreatingChat(true);
      
      try {
        // Try to find any existing chat for this user and proposal
        const { data: existingChat, error } = await supabase
          .from('chats')
          .select('id')
          .eq('proposal_id', response.proposal_id)
          .eq('user_id', response.user_id)
          .single();
          
        if (error) {
          if (error.code === 'PGRST116') {
            // No chat exists with this user
            alert('No chat exists with this user yet.');
          } else {
            console.error('Error finding chat:', error);
            alert('Failed to find chat');
          }
          setIsCreatingChat(false);
          return;
        }
        
        // Navigate to the existing chat
        router.push(`/admin/chats/${existingChat.id}?proposalId=${response.proposal_id}`);
      } catch (err) {
        console.error('Chat lookup error:', err);
        alert('An error occurred while looking for the chat');
        setIsCreatingChat(false);
      }
    }
  };
  
  if (isLoading || !response) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080808]">
        <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
      </div>
    )
  }
  
  return (
    <div className="p-10">
      <div className="flex items-center space-x-2 mb-6">
        <Link href="/admin" className="text-[#FFB900]">Admin Dashboard</Link>
        <span className="text-gray-400">{'>'}</span>
        <Link href={`/admin/proposal/${response.proposal_id}/responses`} className="text-[#FFB900]">Proposal</Link>
        <span className="text-gray-400">{'>'}</span>
        <span className="text-gray-400">Details</span>
      </div>
      
      <Link href={`/admin/proposal/${response.proposal_id}/responses`} className="text-[#FFB900] inline-flex items-center mb-8">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
          <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back
      </Link>
      
      <div className="bg-[#121212] border border-white/5 p-8 rounded-lg mb-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-white text-3xl font-bold">Response Details</h1>
          <div>
            <button
              onClick={handleOpenChat}
              disabled={isCreatingChat}
              className="px-4 py-2 bg-[#1A1A1A] text-[#FFB900] rounded-full hover:bg-[#252525] transition-colors flex items-center space-x-2"
            >
              {isCreatingChat ? (
                <div className="w-5 h-5 border-t-2 border-[#FFB900] rounded-full animate-spin mr-2"></div>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92176 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              <span>Open Chat</span>
            </button>
          </div>
        </div>
        
        <div className="mb-8">
          <p className="text-[#FFB900] text-sm mb-2">Response By</p>
          <h1 className="text-white text-3xl font-bold">{response.user_email}</h1>
          {response.user_tags && response.user_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {response.user_tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/20 text-white border border-white/20"
                >
                  <div 
                    className="w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
          <div>
            <p className="text-[#FFB900] text-sm mb-2">Quote</p>
            <p className="text-white">{response.quote || 'No quote provided'}</p>
          </div>
          
          <div>
            <p className="text-[#FFB900] text-sm mb-2">Date</p>
            <p className="text-white">{formatDate(response.created_at)}</p>
          </div>
          
          <div>
            <p className="text-[#FFB900] text-sm mb-2">Platforms</p>
            <p className="text-white">{response.platforms?.join(', ') || 'None'}</p>
          </div>
          
          {response.proposed_publish_date && (
            <div>
              <p className="text-[#FFB900] text-sm mb-2">Publish Date</p>
              <p className="text-white">{formatDate(response.proposed_publish_date)}</p>
            </div>
          )}
          
          {response.payment_method && (
            <div>
              <p className="text-[#FFB900] text-sm mb-2">Payment Method</p>
              <p className="text-white">{response.payment_method}</p>
            </div>
          )}
          
          <div>
            <p className="text-[#FFB900] text-sm mb-2">Status</p>
            <p className={`capitalize ${
              response.status === 'accepted' ? 'text-green-500' : 
              response.status === 'rejected' ? 'text-red-500' : 
              response.status === 'pending_update' ? 'text-orange-500' :
              'text-gray-400'
            }`}>
              {response.status}
            </p>
          </div>

          <div>
            <p className="text-[#FFB900] text-sm mb-2">Admin Response</p>
            <p className={`capitalize ${
              response.admin_response?.status === 'completed' ? 'text-purple-500' :
              response.admin_response?.status === 'approved' ? 'text-green-500' : 
              response.admin_response?.status === 'rejected' ? 'text-red-500' : 
              'text-gray-400'
            }`}>
              {response.admin_response?.status === 'completed' ? 'Completed' : (response.admin_response?.status || 'Pending')}
            </p>
          </div>
        </div>
        
        {(response.video_link || response.uploaded_video_url) && (
          <div>
            <p className="text-[#FFB900] text-sm mb-4">Video</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {response.video_link && (
                <div className="bg-black aspect-video relative flex items-center justify-center rounded overflow-hidden">
                  <a 
                    href={response.video_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="bg-[#FFB900] rounded-full w-16 h-16 flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 3L19 12L5 21V3Z" fill="black"/>
                      </svg>
                    </div>
                  </a>
                </div>
              )}
              
              {response.uploaded_video_url && (
                <div className="bg-black aspect-video relative flex items-center justify-center rounded overflow-hidden">
                  <a 
                    href={response.uploaded_video_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="bg-[#FFB900] rounded-full w-16 h-16 flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 3L19 12L5 21V3Z" fill="black"/>
                      </svg>
                    </div>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {!showResponseForm ? (
        <div className="flex justify-center space-x-4">
          {response.admin_response?.status !== 'completed' && (
            <>
              <button 
                className="bg-white text-black px-8 py-3 rounded-full font-medium flex items-center space-x-2"
                onClick={() => {
                  setResponseAction('approved')
                  setShowResponseForm(true)
                  setIsUpdateAction(false)
                }}
              >
                <span>Apply Offer</span>
                <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L6 7L1 13" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              
              <button 
                className="border border-white text-white px-8 py-3 rounded-full font-medium flex items-center space-x-2"
                onClick={() => {
                  setResponseAction('rejected')
                  setShowResponseForm(true)
                  setIsUpdateAction(false)
                }}
              >
                <span>Decline Offer</span>
                <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L6 7L1 13" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              
              {response.admin_response?.status === 'approved' && (
                <button 
                  className="bg-green-600 text-white px-8 py-3 rounded-full font-medium flex items-center space-x-2 hover:bg-green-700 transition-colors"
                  onClick={(e) => handleCompleteOffer(e)}
                  disabled={isSubmitting}
                >
                  <span>Complete Offer</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </>
          )}
          
          {response.admin_response?.status === 'completed' && (
            <div className="text-center">
              <div className="inline-flex items-center px-8 py-3 bg-purple-600 text-white rounded-full font-medium">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                  <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Offer Completed</span>
              </div>
              {response.campaign_completed_at && (
                <p className="text-gray-400 text-sm mt-2">
                  Completed on {formatDate(response.campaign_completed_at)}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#121212] border border-white/5 p-8 rounded-lg">
          <h2 className="text-white text-xl font-bold mb-4">
            {responseAction === 'approved' ? 'Apply Offer' : 'Decline Offer'}
          </h2>
          
          <div className="mb-6">
            <label htmlFor="adminMessage" className="block text-[#FFB900] text-sm mb-2">
              Message to User
            </label>
            <textarea
              id="adminMessage"
              className="w-full bg-[#1A1A1A] border border-white/10 rounded p-3 text-white"
              rows={5}
              value={adminMessage}
              onChange={(e) => setAdminMessage(e.target.value)}
              placeholder="Enter your message to the user..."
            ></textarea>
          </div>
          
          <div className="flex justify-end space-x-4">
            <button
              className="border border-white text-white px-6 py-2 rounded-md"
              onClick={() => setShowResponseForm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            
            <button
              className={`bg-[#FFB900] text-black px-6 py-2 rounded-md font-medium ${isSubmitting ? 'opacity-50' : ''}`}
              onClick={handleSubmitResponse}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Response'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 