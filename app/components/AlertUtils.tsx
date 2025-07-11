'use client';

import { toast } from 'react-hot-toast';

// Global toast utility functions for showing styled alerts
const AlertUtils = {
  info: (title: string, message: string) => {
    toast.custom(
      <div className="bg-[#121212] border border-blue-500/20 rounded-lg shadow-lg p-4 text-white max-w-md">
        <div className="flex gap-3">
          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-blue-900/20 text-blue-400 rounded-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-sm">{title}</h3>
            <p className="text-xs text-gray-300 mt-1">{message}</p>
          </div>
        </div>
      </div>
    );
  },
  
  success: (title: string, message: string) => {
    toast.custom(
      <div className="bg-[#121212] border border-green-500/20 rounded-lg shadow-lg p-4 text-white max-w-md">
        <div className="flex gap-3">
          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-green-900/20 text-green-400 rounded-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1952 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-sm text-green-400">{title}</h3>
            <p className="text-xs text-gray-300 mt-1">{message}</p>
          </div>
        </div>
      </div>
    );
  },
  
  warning: (title: string, message: string) => {
    toast.custom(
      <div className="bg-[#121212] border border-[#FFB900]/20 rounded-lg shadow-lg p-4 text-white max-w-md">
        <div className="flex gap-3">
          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-amber-900/20 text-[#FFB900] rounded-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.29 3.86L1.82 18C1.64 18.32 1.56 18.7 1.58 19.08C1.6 19.46 1.73 19.82 1.95 20.12C2.17 20.42 2.47 20.66 2.82 20.79C3.16 20.93 3.54 20.95 3.9 20.87L12 18.69L20.1 20.87C20.46 20.95 20.84 20.93 21.18 20.79C21.53 20.66 21.83 20.42 22.05 20.12C22.27 19.82 22.4 19.46 22.42 19.08C22.44 18.7 22.36 18.32 22.18 18L13.71 3.86C13.55 3.57 13.3 3.33 13 3.16C12.7 2.99 12.36 2.9 12 2.9C11.64 2.9 11.3 2.99 11 3.16C10.7 3.33 10.45 3.57 10.29 3.86Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-sm text-[#FFB900]">{title}</h3>
            <p className="text-xs text-gray-300 mt-1">{message}</p>
          </div>
        </div>
      </div>
    );
  },
  
  error: (title: string, message: string) => {
    toast.custom(
      <div className="bg-[#121212] border border-red-500/20 rounded-lg shadow-lg p-4 text-white max-w-md">
        <div className="flex gap-3">
          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-red-900/20 text-red-400 rounded-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 9L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-sm text-red-400">{title}</h3>
            <p className="text-xs text-gray-300 mt-1">{message}</p>
          </div>
        </div>
      </div>
    );
  }
};

export default AlertUtils; 