import React from 'react';

interface GridLayoutProps {
  children: React.ReactNode;
  columns: 1 | 2 | 3 | 4;
  gap?: string;
  className?: string;
}

/**
 * A simple grid layout component that always collapses to a single column on mobile
 * Use this for standard grid layouts where you want a predictable mobile experience
 */
export default function GridLayout({
  children,
  columns = 3,
  gap = 'gap-6',
  className = '',
}: GridLayoutProps) {
  // Handle different column configurations
  let columnClasses = 'grid-cols-1'; // Always start with 1 column for mobile
  
  if (columns === 2) {
    columnClasses += ' md:grid-cols-2';
  } else if (columns === 3) {
    columnClasses += ' md:grid-cols-2 lg:grid-cols-3';
  } else if (columns === 4) {
    columnClasses += ' md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
  }

  return (
    <div className={`grid ${columnClasses} ${gap} ${className}`}>
      {children}
    </div>
  );
} 