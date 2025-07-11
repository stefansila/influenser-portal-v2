import React from 'react';
import Link from 'next/link';

export function ProposalUnavailableMessage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#080808]">
      <div className="bg-[#121212] border border-white/5 p-8 rounded-lg max-w-md text-center">
        <h2 className="text-xl font-bold text-white mb-4">User Data Unavailable</h2>
        <p className="text-gray-300 mb-6">
          We couldn't load your user data. Please try logging in again or contact support if the problem persists.
        </p>
        <Link 
          href="/login" 
          className="inline-block px-6 py-3 bg-[#FFB900] text-black rounded-full hover:bg-[#E6A800] transition-colors"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}

export function DataUnavailableMessage({ type, redirectTo, redirectLabel }: { 
  type: string, 
  redirectTo: string,
  redirectLabel: string
}) {
  return (
    <div className="p-8 min-h-screen bg-background">
      <div className="flex flex-col items-center justify-center p-12 bg-[#121212] border border-white/5 text-center rounded-md">
        <p className="text-xl text-gray-300 mb-3">{type} not found</p>
        <p className="text-gray-400">The {type.toLowerCase()} you are looking for doesn't exist</p>
        <Link
          href={redirectTo}
          className="mt-8 inline-flex items-center justify-between px-8 py-4 bg-white rounded-full"
        >
          <span className="mr-4 text-black font-medium">{redirectLabel}</span>
        </Link>
      </div>
    </div>
  );
} 