import React from 'react';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'none';
  padding?: string;
  noPadding?: boolean;
}

export default function ResponsiveContainer({
  children,
  className = '',
  maxWidth = 'xl',
  padding = 'px-5 py-4 sm:px-6 sm:py-5 md:px-6 md:py-6',
  noPadding = false,
}: ResponsiveContainerProps) {
  // Map maxWidth to Tailwind classes
  const maxWidthClass = maxWidth === 'none' 
    ? '' 
    : {
        'xs': 'max-w-screen-xs',
        'sm': 'max-w-screen-sm',
        'md': 'max-w-screen-md',
        'lg': 'max-w-screen-lg',
        'xl': 'max-w-screen-xl',
        '2xl': 'max-w-screen-2xl',
      }[maxWidth];

  return (
    <div className={`w-full mx-auto ${maxWidthClass} ${noPadding ? '' : padding} ${className}`}>
      {children}
    </div>
  );
} 