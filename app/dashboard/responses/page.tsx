'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { renderProgressBar } from '../../utils/progressUtils'

type AdminResponse = {
  id: string
  status: 'approved' | 'rejected' | 'pending' | 'completed'
  created_at: string
}

type Response = {
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
    admin_approved_at?: string
    campaign_completed_at?: string
    proposal_id: string
    user_id: string
    quote?: string
    proposed_publish_date?: string
    platforms?: string[]
    payment_method?: string
    uploaded_video_url?: string
    video_link?: string
    admin_responses?: AdminResponse | AdminResponse[]
  } | null
  admin_response?: {
    id: string
    status: 'approved' | 'rejected' | 'pending' | 'completed'
    created_at: string
  } | null
}

// Definišimo konstante za poređenje
const STATUS_APPROVED = "approved";
const STATUS_REJECTED = "rejected";
const STATUS_PENDING = "pending";

export default function ResponsesPage() {
  const { user } = useAuth()
  const [responses, setResponses] = useState<Response[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Add a debug function to fetch info about the admin_responses table
  useEffect(() => {
    const debugDatabaseSchema = async () => {
      if (!user) return;

      try {
        console.log('DEBUG - Checking admin_responses schema information');
        
        // Try to fetch just one admin response to analyze structure
        const { data, error } = await supabase
          .from('admin_responses')
          .select('*')
          .limit(1);
          
        if (error) {
          console.error('DEBUG - Error fetching admin_responses sample:', error);
        } else if (data && data.length > 0) {
          console.log('DEBUG - Sample admin_response raw data:', data[0]);
          console.log('DEBUG - Sample admin_response status:', data[0].status);
          console.log('DEBUG - Sample admin_response status type:', typeof data[0].status);
          
          // Try comparing string values directly
          const status = data[0].status;
          console.log('DEBUG - Direct string comparison results:');
          console.log('  status === "approved":', status === "approved");
          console.log('  status === "rejected":', status === "rejected");
          console.log('  status === "pending":', status === "pending");
          console.log('  status.toLowerCase() === "approved":', String(status).toLowerCase() === "approved");
          console.log('  status.toLowerCase() === "rejected":', String(status).toLowerCase() === "rejected");
          console.log('  status.toLowerCase() === "pending":', String(status).toLowerCase() === "pending");
        } else {
          console.log('DEBUG - No admin_responses found in database for debugging');
        }
      } catch (error) {
        console.error('DEBUG - Error in schema debugging:', error);
      }
    };
    
    if (user) {
      debugDatabaseSchema();
    }
  }, [user]);

  useEffect(() => {
    const fetchResponses = async () => {
      if (!user) return
      
      try {
        // KOPIRAM TAČNU LOGIKU SA DASHBOARD-A
        
        // 1. Prvo učitavam proposals preko proposal_visibility (kao dashboard)
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
          console.error('Error fetching proposals:', proposalError);
          setResponses([]);
        } else if (proposalData && proposalData.length > 0) {
          // Extract proposals (kao dashboard)
          const allProposals: any[] = [];
          
          proposalData.forEach(item => {
            if (item.proposals && 
                typeof item.proposals === 'object' &&
                'id' in item.proposals) {
              allProposals.push(item.proposals);
            }
          });
          
          if (allProposals.length > 0) {
            // 2. Učitavam responses za te proposals (tačno kao dashboard)
            const proposalIds = allProposals.map(p => p.id)
            
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
            
            if (responseError) {
              console.error('Error fetching responses:', responseError);
              setResponses([]);
            } else if (responseData && responseData.length > 0) {
              // 3. Mapiranje responses na proposals (TAČNO KAO DASHBOARD)
              const enhancedProposals = allProposals
                .map(proposal => {
                  const userResponse = responseData?.find(r => r.proposal_id === proposal.id)
                  
                  if (!userResponse) return null; // Samo proposals sa responses
                  
                  // Sigurno dobavljanje admin response podataka (TAČNO KAO DASHBOARD)
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
                .filter(Boolean); // Ukloni null vrednosti
              
              setResponses(enhancedProposals);
            } else {
              setResponses([]);
            }
          } else {
            setResponses([]);
          }
        } else {
          setResponses([]);
        }
      } catch (error) {
        console.error('Error fetching responses:', error);
        setResponses([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResponses();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen bg-background">
      {/* Header */}
      <div className="mb-12">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">Your Responses</h1>
          <p className="text-gray-400">View and manage your responses to proposals</p>
        </div>
      </div>

      {/* Responses List */}
      <div className="space-y-6 responses-list">
        {responses.length === 0 ? (
          <div className="bg-[#121212] border border-white/5 p-8 text-center">
            <p className="text-gray-300">You haven't responded to any proposals yet.</p>
            <Link 
              href="/dashboard" 
              className="mt-4 inline-flex items-center space-x-2 text-[#FFB900]"
            >
              <span>Browse Proposals</span>
              <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L6 7L1 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        ) : (
          responses.map((response) => (
            <div key={response.user_response?.id} className="bg-[#121212] border border-white/5 p-6">
              <div className="flex items-start justify-between resposne-top-wrapper">
                {/* Mobile progress bar - prikazuje se samo na manjim rezolucijama */}
                <div className="flex flex-col items-start gap-4 mobile-progress-wrapper">
                  {renderProgressBar(response)}
                </div>
                
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {response.title}
                  </h3>
                  <p className="text-gray-400">{response.company_name}</p>
                  
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
                    {response.user_response?.proposed_publish_date && (
                      <div>
                        <p className="text-sm text-[#FFB900]">Proposed Publish Date</p>
                        <p className="text-gray-300">
                          {new Date(response.user_response.proposed_publish_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-[#FFB900]">Response Date</p>
                      <p className="text-gray-300">
                        {response.user_response?.created_at && new Date(response.user_response.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Desktop progress bar - prikazuje se samo na većim rezolucijama */}
                <div className="flex flex-col items-end gap-4 desktop-progress-wrapper">
                  {renderProgressBar(response)}
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-6">
                <Link 
                  href={`/dashboard/view-response?id=${response.user_response?.id}`}
                  className="inline-flex items-center space-x-2 text-[#FFB900]"
                >
                  <span>View Response Details</span>
                  <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L6 7L1 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
                
                <Link 
                  href={`/dashboard/proposal/${response.id}`}
                  className="inline-flex items-center space-x-2 text-[#FFB900]"
                >
                  <span>View Proposal</span>
                  <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L6 7L1 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
} 