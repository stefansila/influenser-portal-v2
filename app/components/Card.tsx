import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
  noPadding?: boolean;
}

/**
 * A responsive card component that works well across all screen sizes
 */
export default function Card({
  children,
  className = '',
  padding = 'p-4 sm:p-5 md:p-6',
  noPadding = false,
}: CardProps) {
  return (
    <div 
      className={`
        bg-[#0F0F0F] border border-white/10 rounded-lg
        w-full mb-4 ${noPadding ? '' : padding} ${className}
      `}
    >
      {children}
    </div>
  );
}

// Smaller Card variant with reduced padding
export function SmallCard({
  children,
  className = '',
  padding = 'p-3 sm:p-4',
  noPadding = false,
}: CardProps) {
  return (
    <div 
      className={`
        bg-[#0F0F0F] border border-white/10 rounded-lg
        w-full mb-3 ${noPadding ? '' : padding} ${className}
      `}
    >
      {children}
    </div>
  );
} 