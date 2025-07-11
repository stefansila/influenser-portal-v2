import React from 'react';

// Utility functions for progress status calculation

export type ProgressStatus = 'no_response' | 'accepted' | 'live' | 'completed';

export interface ProgressData {
  user_response?: {
    status: string;
    progress_status?: string;
  } | null;
  admin_response?: {
    status: 'pending' | 'approved' | 'rejected' | 'completed';
  } | null;
  admin_responses?: any;
  campaign_end_date?: string;
  status?: string;
  progress_status?: string;
}

/**
 * Determines the current progress status based on proposal/response data
 * This function ensures consistent progress calculation across all pages
 */
export function getProgressStatus(data: ProgressData): ProgressStatus {
  // If this is a response object (has status directly)
  if (data.status) {
    if (data.status === 'rejected') {
      return 'no_response';
    }
    
    // Use progress_status from database if available
    if (data.progress_status) {
      return data.progress_status as ProgressStatus;
    }
    
    // Fallback calculation for response objects
    if (data.status === 'accepted' || data.status === 'pending_update') {
      let currentStatus: ProgressStatus = 'accepted';
      
      // Check if admin approved (live status)
      const adminResponse = Array.isArray(data.admin_responses) 
        ? (data.admin_responses.length > 0 ? data.admin_responses[0] : null)
        : data.admin_responses;
        
      if (adminResponse && adminResponse.status === 'approved') {
        currentStatus = 'live';
        
        // Check if campaign is completed (end date passed)
        if (data.campaign_end_date) {
          const currentDate = new Date();
          const endDate = new Date(data.campaign_end_date);
          if (endDate < currentDate) {
            currentStatus = 'completed';
          }
        }
      }
      
      return currentStatus;
    }
    
    return 'no_response';
  }
  
  // If this is a proposal object (has user_response)
  if (data.user_response) {
    if (data.user_response.status === 'rejected') {
      return 'no_response';
    }
    
    if (data.user_response.status === 'accepted') {
      let currentStatus: ProgressStatus = 'accepted';
      
      // Check if admin approved or progress_status indicates live/completed
      if (data.admin_response?.status === 'approved' || 
          data.user_response.progress_status === 'live' || 
          data.user_response.progress_status === 'completed') {
        currentStatus = 'live';
        
        // Check if campaign is completed
        if (data.user_response.progress_status === 'completed' || 
            data.admin_response?.status === 'completed') {
          currentStatus = 'completed';
        } else if (data.campaign_end_date) {
          // Check if campaign end date has passed
          const currentDate = new Date();
          const endDate = new Date(data.campaign_end_date);
          if (endDate < currentDate) {
            currentStatus = 'completed';
          }
        }
      }
      
      return currentStatus;
    }
  }
  
  return 'no_response';
}

/**
 * Renders the progress bar component with consistent styling
 */
export function renderProgressBar(
  data: ProgressData, 
  isBigItem: boolean = false,
  showRejectedBadge: boolean = true
): JSX.Element {
  // If user rejected and we should show the badge
  if (showRejectedBadge && (data.status === 'rejected' || data.user_response?.status === 'rejected')) {
    return (
      <div className="flex items-center">
        <span className="px-3 py-1 text-xs bg-red-700 text-white rounded-full">
          Declined
        </span>
      </div>
    );
  }
  
  const currentStatus = getProgressStatus(data);
  
  // For big items, render both progress types and let CSS control visibility
  if (isBigItem) {
    const stages = [
      { key: 'no_response', label: 'No Response' },
      { key: 'accepted', label: 'Accepted' },
      { key: 'live', label: 'Live' },
      { key: 'completed', label: 'Completed' }
    ];

    const currentIndex = stages.findIndex(stage => stage.key === currentStatus);

    // Text-based progress for mobile
    const textProgress = (
      <div className="progress-global-wrapper">
        {stages.map((stage, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          
          return (
            <div key={stage.key} className="flex items-center">
              <span 
                className={`progress-text ${isActive ? 'progress-text-active' : ''}`}
                style={{ 
                  color: isActive ? 'var(--yellow)' : (isCompleted ? '#10B981' : '#6B7280'),
                  fontSize: '14px'
                }}
              >
                {stage.label}
              </span>
              {index < stages.length - 1 && (
                <span 
                  style={{ 
                    margin: '0 6px',
                    color: isCompleted ? '#10B981' : '#6B7280',
                    fontSize: '14px'
                  }}
                >
                  &gt;
                </span>
              )}
            </div>
          );
        })}
      </div>
    );

    // Circular progress for desktop
    const circularStages = [
      { 
        key: 'no_response', 
        label: 'No Response', 
        icon: (
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_1076_29)">
              <g clipPath="url(#clip1_1076_29)">
                <path d="M7.5 3.125C7.25136 3.125 7.0129 3.02623 6.83709 2.85041C6.66127 2.6746 6.5625 2.43614 6.5625 2.1875V0.9375C6.5625 0.68886 6.66127 0.450403 6.83709 0.274587C7.0129 0.098772 7.25136 0 7.5 0C7.74864 0 7.9871 0.098772 8.16291 0.274587C8.33873 0.450403 8.4375 0.68886 8.4375 0.9375V2.1875C8.4375 2.43614 8.33873 2.6746 8.16291 2.85041C7.9871 3.02623 7.74864 3.125 7.5 3.125ZM8.4375 14.0625V12.8125C8.4375 12.5639 8.33873 12.3254 8.16291 12.1496C7.9871 11.9738 7.74864 11.875 7.5 11.875C7.25136 11.875 7.0129 11.9738 6.83709 12.1496C6.66127 12.3254 6.5625 12.5639 6.5625 12.8125V14.0625C6.5625 14.3111 6.66127 14.5496 6.83709 14.7254C7.0129 14.9012 7.25136 15 7.5 15C7.74864 15 7.9871 14.9012 8.16291 14.7254C8.33873 14.5496 8.4375 14.3111 8.4375 14.0625ZM3.125 7.5C3.125 7.25136 3.02623 7.0129 2.85041 6.83709C2.6746 6.66127 2.43614 6.5625 2.1875 6.5625H0.9375C0.68886 6.5625 0.450403 6.66127 0.274587 6.83709C0.098772 7.0129 0 7.25136 0 7.5C0 7.74864 0.098772 7.9871 0.274587 8.16291C0.450403 8.33873 0.68886 8.4375 0.9375 8.4375H2.1875C2.43614 8.4375 2.6746 8.33873 2.85041 8.16291C3.02623 7.9871 3.125 7.74864 3.125 7.5ZM15 7.5C15 7.25136 14.9012 7.0129 14.7254 6.83709C14.5496 6.66127 14.3111 6.5625 14.0625 6.5625H12.8125C12.5639 6.5625 12.3254 6.66127 12.1496 6.83709C11.9738 7.0129 11.875 7.25136 11.875 7.5C11.875 7.74864 11.9738 7.9871 12.1496 8.16291C12.3254 8.33873 12.5639 8.4375 12.8125 8.4375H14.0625C14.3111 8.4375 14.5496 8.33873 14.7254 8.16291C14.9012 7.9871 15 7.74864 15 7.5ZM10.9225 3.33062L11.5356 2.24125C11.6528 2.02503 11.6803 1.77142 11.6123 1.53509C11.5442 1.29877 11.386 1.09865 11.1718 0.977878C10.9575 0.857108 10.7044 0.825358 10.467 0.889473C10.2296 0.953587 10.0268 1.10843 9.9025 1.32062L9.28875 2.41C9.22825 2.5173 9.18948 2.63547 9.17467 2.75777C9.15986 2.88006 9.1693 3.00407 9.20244 3.12271C9.23559 3.24135 9.29179 3.3523 9.36783 3.44921C9.44387 3.54612 9.53827 3.62709 9.64562 3.6875C9.78563 3.76712 9.94394 3.8089 10.105 3.80875C10.2714 3.8088 10.4349 3.76453 10.5786 3.6805C10.7222 3.59648 10.8409 3.47571 10.9225 3.33062ZM5.0975 13.6794L5.71125 12.59C5.83333 12.3734 5.86435 12.1171 5.79748 11.8776C5.73061 11.638 5.57134 11.4349 5.35469 11.3128C5.13804 11.1907 4.88177 11.1597 4.64225 11.2266C4.40273 11.2934 4.19958 11.4527 4.0775 11.6694L3.46438 12.7587C3.34719 12.975 3.31967 13.2286 3.38773 13.4649C3.4558 13.7012 3.614 13.9014 3.82824 14.0221C4.04247 14.1429 4.29559 14.1746 4.53302 14.1105C4.77045 14.0464 4.97317 13.8916 5.0975 13.6794ZM3.6875 5.35438C3.80955 5.1378 3.84058 4.88162 3.77377 4.64217C3.70697 4.40272 3.54779 4.19961 3.33125 4.0775L2.24125 3.46438C2.02503 3.34719 1.77142 3.31967 1.53509 3.38773C1.29877 3.4558 1.09865 3.614 0.977878 3.82824C0.857108 4.04247 0.825358 4.29559 0.889473 4.53302C0.953587 4.77045 1.10843 4.97317 1.32062 5.0975L2.41 5.71125C2.5173 5.77175 2.63547 5.81052 2.75777 5.82533C2.88006 5.84014 3.00407 5.8307 3.12271 5.79756C3.24135 5.76441 3.3523 5.70821 3.44921 5.63217C3.54612 5.55613 3.62709 5.46173 3.6875 5.35438ZM14.0363 11.1794C14.1583 10.9628 14.1893 10.7066 14.1225 10.4672C14.0557 10.2277 13.8965 10.0246 13.68 9.9025L12.5906 9.28875C12.4834 9.2283 12.3652 9.18957 12.243 9.17478C12.1207 9.15998 11.9968 9.16941 11.8782 9.20252C11.7596 9.23563 11.6487 9.29177 11.5518 9.36775C11.4549 9.44372 11.3739 9.53804 11.3134 9.64531C11.253 9.75259 11.2143 9.87072 11.1995 9.99296C11.1847 10.1152 11.1941 10.2392 11.2272 10.3578C11.2941 10.5973 11.4534 10.8004 11.67 10.9225L12.7594 11.5356C12.9759 11.6577 13.2321 11.6887 13.4716 11.6219C13.711 11.5551 13.9141 11.3959 14.0363 11.1794ZM5.35438 3.6875C5.57102 3.5655 5.73033 3.36243 5.79726 3.12297C5.86418 2.88351 5.83325 2.62727 5.71125 2.41063L5.0975 1.32062C4.97317 1.10843 4.77045 0.953587 4.53302 0.889473C4.29559 0.825358 4.04247 0.857108 3.82824 0.977878C3.614 1.09865 3.4558 1.29877 3.38773 1.53509C3.31967 1.77142 3.34719 2.02503 3.46438 2.24125L4.0775 3.33062C4.15914 3.4756 4.27788 3.59623 4.42155 3.68015C4.56521 3.76406 4.72862 3.80823 4.895 3.80812C5.056 3.80847 5.21431 3.7669 5.35438 3.6875ZM11.1794 14.0363C11.3959 13.9141 11.5551 13.711 11.6219 13.4716C11.6887 13.2321 11.6577 12.9759 11.5356 12.7594L10.9225 11.67C10.8004 11.4534 10.5973 11.2941 10.3578 11.2272C10.1182 11.1603 9.86196 11.1914 9.64531 11.3134C9.42866 11.4355 9.26939 11.6387 9.20252 11.8782C9.13565 12.1177 9.16667 12.374 9.28875 12.5906L9.9025 13.68C10.0246 13.8965 10.2277 14.0557 10.4672 14.1225C10.7066 14.1893 10.9628 14.1583 11.1794 14.0363ZM12.59 5.71125L13.6794 5.0975C13.8916 4.97317 14.0464 4.77045 14.1105 4.53302C14.1746 4.29559 14.1429 4.04247 14.0221 3.82824C13.9014 3.614 13.7012 3.4558 13.4649 3.38773C13.2286 3.31967 12.975 3.34719 12.7587 3.46438L11.6694 4.0775C11.4527 4.19958 11.2934 4.40273 11.2266 4.64225C11.1597 4.88177 11.1907 5.13804 11.3128 5.35469C11.4349 5.57134 11.638 5.73061 11.8776 5.79748C12.1171 5.86435 12.3734 5.83333 12.59 5.71125ZM2.24125 11.5356L3.33062 10.9225C3.4379 10.8621 3.53222 10.7811 3.60819 10.6842C3.68417 10.5873 3.74031 10.4764 3.77342 10.3578C3.80653 10.2392 3.81596 10.1152 3.80116 9.99296C3.78636 9.87072 3.74764 9.75259 3.68719 9.64531C3.62674 9.53804 3.54575 9.44372 3.44885 9.36775C3.35195 9.29177 3.24104 9.23563 3.12244 9.20252C3.00384 9.16941 2.87988 9.15998 2.75764 9.17478C2.6354 9.18957 2.51727 9.2283 2.41 9.28875L1.32062 9.9025C1.14028 10.0044 0.99875 10.1631 0.918147 10.3539C0.837544 10.5448 0.822404 10.7569 0.875091 10.9572C0.927777 11.1575 1.04532 11.3348 1.20937 11.4612C1.37342 11.5877 1.57474 11.6563 1.78188 11.6562C1.94288 11.6566 2.1012 11.615 2.24125 11.5356Z" />
              </g>
            </g>
            <defs>
              <clipPath id="clip0_1076_29">
                <rect width="15" height="15" fill="white"/>
              </clipPath>
              <clipPath id="clip1_1076_29">
                <rect width="15" height="15" fill="white"/>
              </clipPath>
            </defs>
          </svg>
        )
      },
      { 
        key: 'accepted', 
        label: 'Accepted', 
        icon: (
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_1076_34)">
              <path d="M10.1863 5.18L11.0637 6.07063L7.44313 9.6375C7.20125 9.87938 6.88312 10 6.56375 10C6.24437 10 5.92313 9.87812 5.67875 9.63437L3.94 7.94937L4.81063 7.05125L6.55625 8.74313L10.1863 5.18ZM15 7.5C15 11.6356 11.6356 15 7.5 15C3.36437 15 0 11.6356 0 7.5C0 3.36437 3.36437 0 7.5 0C11.6356 0 15 3.36437 15 7.5ZM13.75 7.5C13.75 4.05375 10.9462 1.25 7.5 1.25C4.05375 1.25 1.25 4.05375 1.25 7.5C1.25 10.9462 4.05375 13.75 7.5 13.75C10.9462 13.75 13.75 10.9462 13.75 7.5Z" fill="currentColor"/>
            </g>
            <defs>
              <clipPath id="clip0_1076_34">
                <rect width="15" height="15" fill="white"/>
              </clipPath>
            </defs>
          </svg>
        )
      },
      { 
        key: 'live', 
        label: 'Live', 
        icon: (
          <svg width="10" height="11" viewBox="0 0 10 11" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="5" cy="5.5" r="5" fill="currentColor"/>
          </svg>
        )
      },
      { 
        key: 'completed', 
        label: 'Completed', 
        icon: (
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_1076_34)">
              <path d="M10.1863 5.18L11.0637 6.07063L7.44313 9.6375C7.20125 9.87938 6.88312 10 6.56375 10C6.24437 10 5.92313 9.87812 5.67875 9.63437L3.94 7.94937L4.81063 7.05125L6.55625 8.74313L10.1863 5.18ZM15 7.5C15 11.6356 11.6356 15 7.5 15C3.36437 15 0 11.6356 0 7.5C0 3.36437 3.36437 0 7.5 0C11.6356 0 15 3.36437 15 7.5ZM13.75 7.5C13.75 4.05375 10.9462 1.25 7.5 1.25C4.05375 1.25 1.25 4.05375 1.25 7.5C1.25 10.9462 4.05375 13.75 7.5 13.75C10.9462 13.75 13.75 10.9462 13.75 7.5Z" fill="currentColor"/>
            </g>
            <defs>
              <clipPath id="clip0_1076_34">
                <rect width="15" height="15" fill="white"/>
              </clipPath>
            </defs>
          </svg>
        )
      }
    ];

    const circularCurrentIndex = circularStages.findIndex(stage => stage.key === currentStatus);
    
    // Calculate line width: 12% initial + 30% for each completed step
    const lineWidth = 12 + (circularCurrentIndex * 30);

    const circularProgress = (
      <div className="progres-wrapper">
        <div className="progress-top">
          {circularStages.map((stage, index) => {
            const isActive = index <= circularCurrentIndex;
            
            return (
              <div 
                key={stage.key} 
                className={`progress-item ${isActive ? 'progress-item-active' : ''}`}
              >
                <div className="progress-icon-wrap">
                  <div className="progress-icon dh-embed">
                    {stage.icon}
                  </div>
                </div>
                <span>{stage.label}</span>
              </div>
            );
          })}
        </div>
        <div className="progress-bottom-line">
          <div 
            className="line-active" 
            style={{ width: `${lineWidth}%` }}
          ></div>
        </div>
      </div>
    );

    // Return both progress types
    return (
      <>
        {textProgress}
        {circularProgress}
      </>
    );
  }

  // For smaller items, use the text-based progress
  const stages = [
    { key: 'no_response', label: 'No Response' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'live', label: 'Live' },
    { key: 'completed', label: 'Completed' }
  ];

  const currentIndex = stages.findIndex(stage => stage.key === currentStatus);

  return (
    <div className="progress-global-wrapper">
      {stages.map((stage, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;
        
        return (
          <div key={stage.key} className="flex items-center">
            <span 
              className={`progress-text ${isActive ? 'progress-text-active' : ''}`}
              style={{ 
                color: isActive ? 'var(--yellow)' : (isCompleted ? '#10B981' : '#6B7280'),
                fontSize: '14px'
              }}
            >
              {stage.label}
            </span>
            {index < stages.length - 1 && (
              <span 
                style={{ 
                  margin: '0 6px',
                  color: isCompleted ? '#10B981' : '#6B7280',
                  fontSize: '14px'
                }}
              >
                &gt;
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
} 