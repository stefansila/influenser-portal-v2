'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import { useNotifications } from '../context/NotificationContext'
import { useChat } from '../context/ChatContext'
import { renderProgressBar } from '../utils/progressUtils'

type Company = {
  id: string
  name: string
  proposalCount: number
  hasNew: boolean
}

type Proposal = {
  id: string
  title: string
  company_name: string
  campaign_start_date: string
  campaign_end_date: string
  short_description: string
  created_at: string
  user_response?: {
    id: string
    status: string
    created_at: string
    progress_status?: string
  } | null
  admin_response?: {
    id: string
    status: 'pending' | 'approved' | 'rejected' | 'completed'
    message_to_user?: string
    created_at: string
  } | null
}

export default function Dashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState<string>('')
  const { unreadCount } = useNotifications()
  const { unreadCount: chatUnreadCount } = useChat()

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user) {
        router.push('/login')
        return
      }

      try {
        setLoading(true)
        
        // Get user data including role
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, full_name')
          .eq('id', user.id)
          .single()
        
        if (userError) {
          console.error('Error fetching user data:', userError)
          router.push('/login')
          return
        }
        
        const isUserAdmin = userData.role === 'admin'
        setIsAdmin(isUserAdmin)
        setFullName(userData.full_name || '')
        
        // Get current date
        const currentDate = new Date().toISOString().split('T')[0]
        
        if (isUserAdmin) {
          // Admin: fetch all proposals
          const { data: proposalData, error: proposalError } = await supabase
            .from('proposals')
            .select('*')
            .gte('campaign_end_date', currentDate)
            .order('created_at', { ascending: false })
          
          if (proposalError) {
            console.error('Error fetching proposals:', proposalError)
          } else {
            setProposals(proposalData || [])
          }
        } else {
          // Regular user: fetch proposals via proposal_visibility
          const { data: proposalData, error: proposalError } = await supabase
            .from('proposal_visibility')
            .select(`
              proposal_id,
              proposals:proposal_id(
                id, 
                title, 
                company_name, 
                campaign_start_date, 
                campaign_end_date, 
                short_description, 
                created_at
              )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
          
          if (proposalError) {
            console.error('Error fetching visible proposals:', proposalError)
          } else if (proposalData && proposalData.length > 0) {
            // Extract active proposals
            const activeProposals: Proposal[] = []
            
            proposalData.forEach(item => {
              if (item.proposals && 
                  typeof item.proposals === 'object' &&
                  'id' in item.proposals &&
                  'campaign_end_date' in item.proposals) {
                
                const proposal = item.proposals as unknown as Proposal
                if (new Date(proposal.campaign_end_date) >= new Date(currentDate)) {
                  activeProposals.push(proposal)
                }
              }
            })
            
            if (activeProposals.length > 0) {
              // Fetch responses for user
              const proposalIds = activeProposals.map(p => p.id)
              
              const { data: responseData, error: responseError } = await supabase
                .from('responses')
                .select(`
                  id,
                  status,
                  created_at,
                  progress_status,
                  admin_approved_at,
                  campaign_completed_at,
                  proposal_id,
                  user_id,
                  quote,
                  proposed_publish_date,
                  platforms,
                  payment_method,
                  uploaded_video_url,
                  video_link,
                  admin_responses(*)
                `)
                .eq('user_id', user.id)
                .in('proposal_id', proposalIds)
                .order('created_at', { ascending: false })
              
              if (!responseError) {
                // Map responses to proposals
                const enhancedProposals = activeProposals.map(proposal => {
                  const userResponse = responseData?.find(r => r.proposal_id === proposal.id)
                  
                  let adminResponse = null
                  if (userResponse && userResponse.admin_responses) {
                    if (Array.isArray(userResponse.admin_responses)) {
                      adminResponse = userResponse.admin_responses.length > 0 ? userResponse.admin_responses[0] : null
                    } else {
                      adminResponse = userResponse.admin_responses
                    }
                  }
                  
                  return {
                    ...proposal,
                    user_response: userResponse || null,
                    admin_response: adminResponse
                  }
                })
                
                setProposals(enhancedProposals)
              } else {
                setProposals(activeProposals)
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    if (!isLoading && user) {
      loadDashboard()
    }
  }, [user, isLoading, router])

  // Helper function to check if a proposal is from the last 7 days
  const isRecentProposal = (createdAt: string) => {
    const createdDate = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  }

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
      </div>
    )
  }

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

  // Render different dashboard based on user role
  if (isAdmin) {
    // Admin Dashboard based on the first image
    return (
      <div className="p-8 min-h-screen bg-[#080808]">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <Link 
            href="/admin/create-proposal"
            className="px-4 py-2 rounded-md bg-white text-black flex items-center space-x-2"
          >
            <span>Create New</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 7H13M7 1V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
        
        <div className="space-y-px">
          {companies.map((company) => (
            <div 
              key={company.id} 
              className="flex items-center justify-between p-6 bg-[#121212] border-b border-white/5"
            >
              <div className="flex items-center space-x-2">
                <h3 className="text-white font-medium">{company.name}</h3>
                {company.hasNew && (
                  <span className="px-1.5 py-0.5 text-xs bg-[#FFB900] text-black rounded">new</span>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-white">{company.proposalCount} Proposals</span>
                <Link
                  href={`/admin/company/${company.id}`}
                  className="text-[#FFB900] flex items-center space-x-1"
                >
                  <span>View Now</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  } else {
    // User Dashboard based on the second image
    return (
      <div className="p-8 min-h-screen bg-background">
        {/* Header */}
        <div className="is-header flex justify-between items-start mb-12">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-white">
              Welcome{fullName ? `, ${fullName}` : ''}
            </h1>
            <p className="text-gray-400">View available offers and track the status of your responses</p>
          </div>
          
          <div className="flex-vertical-mobile first flex items-center space-x-6">
            <Link href="/dashboard/notifications" className="relative flex items-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400 hover:text-white transition-colors">
                <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {unreadCount + chatUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#FFB900] text-black text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full">
                  {unreadCount + chatUnreadCount > 9 ? '9+' : unreadCount + chatUnreadCount}
                </span>
              )}
            </Link>
            
            <Link href="/dashboard/chats" className="relative flex items-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400 hover:text-white transition-colors">
                <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {chatUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#FFB900] text-black text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full">
                  {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                </span>
              )}
            </Link>
            
            <Link 
              href="/dashboard/old-proposals" 
              className="text-[#FFB900] flex items-center space-x-2"
            >
              <span>View Past Campaigns</span>
              <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L6 7L1 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>

        {proposals.length === 0 ? (
          <div className="bg-[#121212] border border-white/5 p-10 text-center rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h2 className="text-2xl font-bold text-white mb-2">No Active Proposals</h2>
            <p className="text-gray-400 mb-6">There are currently no active campaign proposals available.</p>
            <Link 
              href="/dashboard/old-proposals" 
              className="inline-flex items-center space-x-2 px-4 py-2 bg-[#FFB900] text-black rounded-md"
            >
              <span>View Past Campaigns</span>
              <svg width="7" height="12" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-3">
                <path d="M1 1L6 7L1 13" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        ) : (
          <>
            {/* Featured Proposal */}
            <div className="bg-[#121212] border border-white/5 mb-10">
              <div className="p-10 big-item">
                <div className="mb-8">
                  {/* Progress bar spanning full width above "New" indicator */}
                  <div className="mb-4">
                    {renderProgressBar(proposals[0], true)}
                  </div>
                  <div className="inline-block px-4 py-1 border border-[#FFB900] text-[#FFB900] rounded-full mb-4">
                    New
                  </div>
                  <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-bold text-white">{proposals[0].title}</h2>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="border-t border-white/10 border-b border-white/10">
                    <div className="py-3">
                      <div className="flex-vertical-moobile flex space-x-24">
                        <div>
                          <p className="text-sm text-[#FFB900]">Company</p>
                          <p className="text-gray-300">{proposals[0].company_name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-[#FFB900]">Campaign Date</p>
                          <p className="text-gray-300">
                            {formatDateRange(
                              proposals[0].campaign_start_date,
                              proposals[0].campaign_end_date
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-[#FFB900]">Timeline</p>
                          <p className="text-gray-300">
                            {calculateTimeline(
                              proposals[0].campaign_start_date,
                              proposals[0].campaign_end_date
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <p className="text-gray-300">{proposals[0].short_description}</p>
                </div>

                <Link
                  href={`/dashboard/proposal/${proposals[0].id}`}
                  className="inline-flex items-center space-x-3 text-[#FFB900]"
                >
                  <span>Learn More</span>
                  <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L6 7L1 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              </div>
            </div>

            {/* Recent Proposals Grid */}
            {proposals.length > 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {proposals.slice(1, 4).map((proposal) => (
                  <div key={proposal.id} className="bg-[#121212] border border-white/5">
                    <div className="p-10 small-item">
                      {/* Progress bar spanning full width above title */}
                      <div className="mb-4">
                        {renderProgressBar(proposal, false)}
                      </div>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-white">{proposal.title}</h3>
                      </div>

                      {/* Admin message if there is one */}
                      {proposal.admin_response?.message_to_user && (
                        <div className="mb-4 p-3 bg-[#1A1A1A] rounded-lg">
                          <p className="text-sm text-[#FFB900] mb-1">Admin Message:</p>
                          <p className="text-gray-300 text-sm">{proposal.admin_response.message_to_user}</p>
                        </div>
                      )}

                      <div className="space-y-3 mb-8">
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

                      <div className="mb-5">
                        <p className="text-gray-300 line-clamp-4">{proposal.short_description}</p>
                      </div>

                      <Link
                        href={`/dashboard/proposal/${proposal.id}`}
                        className="inline-flex items-center space-x-3 text-[#FFB900]"
                      >
                        <span>Learn More</span>
                        <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L6 7L1 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    )
  }
}