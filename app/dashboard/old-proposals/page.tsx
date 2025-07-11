'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'

import { renderProgressBar } from '../../utils/progressUtils'

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

export default function OldProposalsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPastProposals = async () => {
      if (!user) {
        router.push('/login')
        return
      }

      try {
        // Get current date
        const currentDate = new Date().toISOString().split('T')[0]
        
        // Fetch past proposals (end date < current date) from the proposal_visibility table
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
          .order('created_at', { ascending: false });
        
        if (proposalError) {
          console.error('Error fetching past proposals:', proposalError)
          setProposals([]) // Show empty state
        } else if (proposalData && proposalData.length > 0) {
          // Extract and filter the past proposals (end date < current date)
          const pastProposals: Proposal[] = [];
          
          // Process each item and build array of valid past proposals
          proposalData.forEach(item => {
            if (item.proposals && 
                typeof item.proposals === 'object' &&
                'id' in item.proposals &&
                'campaign_end_date' in item.proposals) {
              
              const proposal = item.proposals as unknown as Proposal;
              if (new Date(proposal.campaign_end_date) < new Date(currentDate)) {
                pastProposals.push(proposal);
              }
            }
          });
          
          if (pastProposals.length > 0) {
            // If we have proposals, fetch responses for this user
            const proposalIds = pastProposals.map(p => p.id)
            
            const { data: responseData, error: responseError } = await supabase
              .from('responses')
              .select(`
                *,
                admin_responses(*)
              `)
              .eq('user_id', user.id)
              .in('proposal_id', proposalIds)
            
            if (responseError) {
              console.error('Error fetching responses:', responseError)
              setProposals(pastProposals)
            } else {
              // Map responses to their proposals
              const enhancedProposals = pastProposals.map(proposal => {
                const userResponse = responseData?.find(r => r.proposal_id === proposal.id)
                
                // Sigurno dobavljanje admin response podataka
                let adminResponse = null;
                if (userResponse && userResponse.admin_responses) {
                  // Proveri da li je admin_responses objekat ili niz
                  if (Array.isArray(userResponse.admin_responses)) {
                    adminResponse = userResponse.admin_responses.length > 0 ? userResponse.admin_responses[0] : null;
                  } else {
                    adminResponse = userResponse.admin_responses;
                  }
                }
                
                return {
                  ...proposal,
                  user_response: userResponse || null,
                  admin_response: adminResponse
                }
              })
              
              setProposals(enhancedProposals)
            }
          } else {
            setProposals([]) // No past proposals
          }
        } else {
          setProposals([]) // No data in database
        }
      } catch (error) {
        console.error('Error:', error)
        setProposals([]) // Show empty state instead of mock data
      } finally {
        setLoading(false)
      }
    }

    if (!isLoading) {
      fetchPastProposals()
    }
  }, [user, isLoading, router])

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

  // Function to get mock proposals data
  const getMockProposals = () => {
    return [
      {
        id: '5',
        title: 'Spring Collection Showcase',
        company_name: 'Fashion Forward',
        campaign_start_date: '2023-03-01',
        campaign_end_date: '2023-03-30',
        short_description: 'Our spring collection featured vibrant colors and lightweight fabrics.',
        created_at: '2023-02-15',
        user_response: {
          id: 'resp4',
          status: 'accepted',
          created_at: '2023-02-16',
          admin_responses: {
            id: 'adminresp3',
            status: 'approved',
            message_to_user: 'Thanks for working with us on this campaign!',
            created_at: '2023-02-17'
          }
        },
        admin_response: {
          id: 'adminresp3',
          status: 'approved',
          message_to_user: 'Thanks for working with us on this campaign!',
          created_at: '2023-02-17'
        }
      },
      {
        id: '6',
        title: 'Winter Sports Equipment',
        company_name: 'Peak Performance',
        campaign_start_date: '2023-01-10',
        campaign_end_date: '2023-02-28',
        short_description: 'Premium winter sports equipment for enthusiasts and professionals.',
        created_at: '2023-01-05',
        user_response: {
          id: 'resp5',
          status: 'rejected',
          created_at: '2023-01-06'
        },
        admin_response: null
      },
      {
        id: '7',
        title: 'Holiday Special Promotion',
        company_name: 'Gifty',
        campaign_start_date: '2022-12-01',
        campaign_end_date: '2022-12-31',
        short_description: 'Special holiday gift boxes with curated items for every taste.',
        created_at: '2022-11-20',
        user_response: null,
        admin_response: null
      },
    ];
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen bg-background">
      {/* Header */}
      <div className="mb-12">
        <div className="is-header flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-white">Past Campaigns</h1>
            <p className="text-gray-400">Review previous advertising opportunities</p>
          </div>
          <Link
            href="/dashboard"
            className="text-[#FFB900] flex items-center space-x-2"
          >
            <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="rotate-180">
              <path d="M1 1L6 7L1 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Back to Active Campaigns</span>
          </Link>
        </div>
      </div>

      {/* Proposals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {proposals.map((proposal) => (
          <div key={proposal.id} className="bg-[#121212] border border-white/5">
            <div className="p-10 small-item">
              {/* Progress bar spanning full width above title */}
              <div className="mb-4">
                {renderProgressBar(proposal)}
              </div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">{proposal.title}</h3>
              </div>

              {/* Admin message if there is one */}
              {proposal.admin_response?.message_to_user && proposal.user_response?.status === 'accepted' && (
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
                <span>View Details</span>
                <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L6 7L1 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          </div>
        ))}
      </div>
      
      {proposals.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 bg-[#121212] border border-white/5 text-center rounded-md">
          <p className="text-xl text-gray-300 mb-3">No past campaigns found</p>
          <p className="text-gray-400">All your campaigns are currently active</p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex items-center justify-between px-8 py-4 bg-white rounded-full"
          >
            <span className="mr-4 text-black font-medium">View Active Campaigns</span>
            <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L6 7L1 13" stroke="#131110" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      )}
    </div>
  )
} 