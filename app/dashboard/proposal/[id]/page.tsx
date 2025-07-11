'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import ConfirmationModal from '../../../components/ConfirmationModal'
import DeclineModal from '../../../components/DeclineModal'
import { showToast } from '../../../components/ToastProvider'

type Proposal = {
  id: string
  title: string
  company_name: string
  campaign_start_date: string
  campaign_end_date: string
  content: any  // Update this to accept any format of content
  created_at: string
  logo_url?: string
}

type Response = {
  id: string
  user_id: string
  proposal_id: string
  status: string
  created_at: string
  admin_response?: {
    id: string | null
    status: 'pending' | 'approved' | 'rejected' | 'completed'
  } | null
}

export default function ProposalDetailPage({ params }: { params: { id: string } }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [response, setResponse] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    const fetchProposalDetails = async () => {
      if (!user) {
        router.push('/login')
        return
      }

      try {
        // Fetch proposal details
        const { data: proposalData, error: proposalError } = await supabase
          .from('proposals')
          .select('*')
          .eq('id', params.id)
          .single()
        
        if (proposalError) {
          console.error('Error fetching proposal details:', proposalError)
          
          // Check if error is because item was not found
          if (proposalError.code === 'PGRST116') {
            // Proposal not found - set proposal to null
            setProposal(null)
          } else {
            // Other database error occurred
            console.error('Database error:', proposalError)
            setProposal(null)
          }
        } else {
          setProposal(proposalData)
          
          // Check if proposal is expired based on campaign_end_date
          const currentDate = new Date().toISOString().split('T')[0]
          const endDate = proposalData.campaign_end_date
          
          if (endDate < currentDate) {
            setIsExpired(true)
          }
        }

        // If a valid proposal was found, check for user response
        if (proposalData) {
          // Check if user has already responded to this proposal
          const { data: responseData, error: responseError } = await supabase
            .from('responses')
            .select('*')
            .eq('proposal_id', params.id)
            .eq('user_id', user.id)
            .single()
          
          if (!responseError && responseData) {
            console.log('Response data:', responseData)
            
            // Fetch admin response if exists
            const { data: adminResponseData, error: adminResponseError } = await supabase
              .from('admin_responses')
              .select('id, status')
              .eq('response_id', responseData.id)
              .maybeSingle()
              
            if (adminResponseError) {
              console.error('Error fetching admin response:', adminResponseError)
            }
            
            // Combine the data
            setResponse({
              ...responseData,
              admin_response: adminResponseData || null
            })
          }
        }
      } catch (error) {
        console.error('Error:', error)
        setProposal(null)
      } finally {
        setLoading(false)
      }
    }

    if (!isLoading) {
      fetchProposalDetails()
    }
  }, [user, isLoading, router, params.id])

  // Format date range function
  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    // Format the dates to display as "Month DD-DD" or "Month DD - Month DD" if different months
    const startMonth = start.toLocaleString('default', { month: 'long' })
    const endMonth = end.toLocaleString('default', { month: 'long' })
    
    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()}-${end.getDate()}`
    } else {
      return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`
    }
  }
  
  // Calculate timeline in days
  const calculateTimeline = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return `${diffDays} days`
  }

  const handleApply = () => {
    // Redirect to the apply-offer page with proposalId
    router.push(`/dashboard/apply-offer?proposalId=${params.id}`)
  }

  const handleDecline = () => {
    setShowDeclineModal(true)
  }

  const handleDeclineSubmit = async (reason: string) => {
    if (!user || !proposal) return
    
    setSubmitting(true)
    
    try {
      // Create response in database with declined status
      const responseData = {
        proposal_id: params.id,
        user_id: user.id,
        status: 'rejected',
        progress_status: 'no_response',
        message: reason,
        platforms: [], // Empty since it's declined
        payment_method: 'none', // Not applicable for declined
      }
      
      const { error } = await supabase
        .from('responses')
        .insert(responseData)
        
      if (error) throw error

      // Create or get existing chat for this proposal and user
      let chatId = null
      
      // Check if chat already exists
      const { data: existingChat, error: chatCheckError } = await supabase
        .from('chats')
        .select('id')
        .eq('proposal_id', params.id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (chatCheckError) {
        console.error('Error checking existing chat:', chatCheckError)
      }
      
      if (existingChat) {
        chatId = existingChat.id
      } else {
        // Create new chat
        const { data: newChat, error: chatCreateError } = await supabase
          .from('chats')
          .insert({
            proposal_id: params.id,
            user_id: user.id
          })
          .select('id')
          .single()
        
        if (chatCreateError) {
          console.error('Error creating chat:', chatCreateError)
        } else {
          chatId = newChat.id
        }
      }
      
      // Send decline message to chat if chat was created/found successfully
      if (chatId) {
        const declineMessage = `I have declined this offer. Reason: ${reason}`
        
        const { error: messageError } = await supabase
          .from('chat_messages')
          .insert({
            chat_id: chatId,
            user_id: user.id,
            message: declineMessage,
            is_read: false
          })
        
        if (messageError) {
          console.error('Error sending decline message to chat:', messageError)
        }
      }
      
      // Update local state
      setResponse({
        id: '', // Will be assigned by database
        user_id: user.id,
        proposal_id: params.id,
        status: 'rejected',
        created_at: new Date().toISOString()
      })
      
      // Close the modal
      setShowDeclineModal(false)
      
      // Show success toast notification instead of alert
      showToast.success('Offer declined', 'You have successfully declined this offer and sent a message to the chat')
      
    } catch (error: any) {
      console.error('Error declining offer:', error.message)
      showToast.error('Error', 'Failed to decline offer. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = () => {
    // Will be implemented later
    console.log('Update clicked')
  }

  // Add a helper function to safely render content
  const renderContent = (content: any) => {
    if (!content) return null;
    
    // If content is a string, return it directly
    if (typeof content === 'string') {
      return <p>{content}</p>;
    }
    
    // If content has html property (rich text), render it safely
    if (content.html) {
      return <div dangerouslySetInnerHTML={{ __html: content.html }} />;
    }
    
    // If content is an object with blocks, render a placeholder
    if (content.blocks || content.type) {
      return <p>This proposal contains rich content that cannot be displayed directly.</p>;
    }
    
    // Fallback for other cases
    return <p>No content available</p>;
  };

  // Add a link to view the response if the user has already responded
  const renderActionButtons = () => {
    // If proposal is expired and user hasn't responded, show expired message
    if (isExpired && !response) {
      return (
        <div className="space-y-4">
          <div className="bg-[#1A1A1A] p-4 rounded-lg mb-4">
            <p className="text-center text-white">
              This offer has expired and is no longer accepting responses.
            </p>
          </div>
        </div>
      )
    }
    
    if (response) {
      // Check if admin has updated the response or the response is in pending_update state
      const isAdminResponsePending = response.admin_response?.status === 'pending';
      const isPendingUpdate = response.status === 'pending_update';
      const canEditResponse = isAdminResponsePending || isPendingUpdate;
      
      // Don't show the "admin updated" message if user has already finished editing
      // (i.e., if response status is 'accepted' and admin response is 'pending')
      const shouldShowAdminUpdateMessage = canEditResponse && !(response.status === 'accepted' && isAdminResponsePending);
      
      return (
        <div className="space-y-4">
          <div className="bg-[#1A1A1A] p-4 rounded-lg mb-4">
            <p className="text-center text-white">
              {response.status === 'accepted' 
                ? 'You have applied to this offer' 
                : response.status === 'pending'
                ? 'Your response is pending review'
                : response.status === 'pending_update'
                ? 'Your response requires updates'
                : 'You have declined this offer'}
            </p>
            <p className="text-center text-gray-400 text-sm mt-2">
              Submitted on {new Date(response.created_at).toLocaleDateString()}
            </p>
            {shouldShowAdminUpdateMessage && (
              <p className="text-center text-[#FFB900] text-sm mt-2">
                {isPendingUpdate 
                  ? 'The admin has requested changes. Please update your response.' 
                  : 'The admin has updated their response. You can edit your response.'}
              </p>
            )}
          </div>
          
          <div className="flex flex-col space-y-3">
            {(response.admin_response?.status === 'rejected' || response.status === 'pending_update') && (
              <Link
                href={`/dashboard/edit-response?id=${response.id}`}
                className="w-full flex items-center justify-center space-x-2 px-8 py-4 bg-[#FFB900] rounded-full hover:bg-[#E6A800] transition-colors"
              >
                <span className="text-black font-medium">Edit Response</span>
              </Link>
            )}
            
            <Link
              href={`/dashboard/view-response?id=${response.id}`}
              className="w-full flex items-center justify-center space-x-2 px-8 py-4 bg-[#FFB900] rounded-full hover:bg-[#E6A800] transition-colors"
            >
              <span className="text-black font-medium">View Your Response</span>
            </Link>
            
            <Link
              href={`/dashboard/chats/${params.id}`}
              className="w-full flex items-center justify-center space-x-2 px-8 py-4 border border-white/20 rounded-full text-white hover:bg-white/5 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="font-medium">Chat</span>
            </Link>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col md:flex-row gap-4 flex-wrap-center">
        <button
          onClick={handleApply}
          className="inline-flex items-center justify-center px-8 py-4 bg-[#FFB900] rounded-full text-black font-medium transition-colors hover:bg-[#E0A800]"
        >
          Accept Offer
        </button>
        <button
          onClick={handleDecline}
          className="inline-flex items-center justify-center px-8 py-4 border border-white/20 rounded-full text-white font-medium transition-colors hover:bg-white/5"
        >
          Decline Offer
        </button>
      </div>
    )
  }

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="p-8 min-h-screen bg-background">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-[#FFB900] flex items-center space-x-2"
          >
            <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 1L1 7L6 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Back</span>
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center p-12 bg-[#121212] border border-white/5 text-center rounded-md">
          <p className="text-xl text-gray-300 mb-3">Proposal not found</p>
          <p className="text-gray-400">The proposal you are looking for doesn't exist</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen bg-background">
      {/* Back button */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="text-[#FFB900] flex items-center space-x-2"
        >
          <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 1L1 7L6 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Back</span>
        </Link>
      </div>
      
      {/* Proposal details */}
      <div className="flex proposal-box bg-[#121212] border border-white/5">
        {/* Left section with logo and buttons */}
        <div className="w-1/3 p-10 border-r border-white/10 flex flex-col items-center">
          <div className="mb-10">
            {proposal.logo_url ? (
              <Image 
                src={proposal.logo_url} 
                alt={proposal.company_name} 
                width={136} 
                height={136} 
                className="object-contain" 
              />
            ) : (
              <div className="w-[136px] h-[136px] bg-gray-800 flex items-center justify-center rounded-md">
                <span className="text-white text-2xl font-bold">
                  {proposal.company_name.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* Apply and Decline buttons section */}
          <div className="w-full space-y-4">
            {renderActionButtons()}
          </div>
        </div>
        
        {/* Right section with details */}
        <div className="w-2/3 p-10">
          <h1 className="text-3xl font-bold text-white mb-8">{proposal.title}</h1>
          
          <div className="space-y-4 mb-8">
            <div className="border-t border-white/10">
              <div className="py-3">
                <p className="text-sm text-[#FFB900]">Company</p>
                <p className="text-gray-300">{proposal.company_name}</p>
              </div>
            </div>
            <div className="border-t border-white/10">
              <div className="py-3">
                <p className="text-sm text-[#FFB900]">Campaign Date</p>
                <p className="text-gray-300">
                  {formatDateRange(
                    proposal.campaign_start_date,
                    proposal.campaign_end_date
                  )}
                </p>
              </div>
            </div>
            <div className="border-t border-white/10 border-b border-white/10">
              <div className="py-3">
                <p className="text-sm text-[#FFB900]">Timeline</p>
                <p className="text-gray-300">
                  {calculateTimeline(
                    proposal.campaign_start_date,
                    proposal.campaign_end_date
                  )}
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-gray-300 space-y-4">
            {renderContent(proposal.content)}

            {/* Only show bullet points for string content */}
            {typeof proposal.content === 'string' && (
              <ul className="list-disc list-inside space-y-2 pl-4 mt-6">
                <li>Lorem ipsum</li>
                <li>Lorem ipsum</li>
                <li>Lorem ipsum</li>
                <li>Lorem ipsum</li>
                <li>Lorem ipsum</li>
              </ul>
            )}
          </div>
        </div>
      </div>
      
      {/* Modals */}
      {showApplyModal && (
        <ConfirmationModal 
          isOpen={showApplyModal}
          title="Apply for this opportunity"
          message="You'll be redirected to a form where you can submit your application."
          confirmText="Continue"
          cancelText="Cancel"
          onConfirm={handleApply}
          onCancel={() => setShowApplyModal(false)}
        />
      )}
      
      {showDeclineModal && (
        <DeclineModal
          isOpen={showDeclineModal}
          title="Decline Offer"
          proposalTitle={proposal.title}
          onConfirm={handleDeclineSubmit}
          onCancel={() => setShowDeclineModal(false)}
        />
      )}
    </div>
  )
} 