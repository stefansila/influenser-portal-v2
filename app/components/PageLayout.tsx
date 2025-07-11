import React from 'react';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

/**
 * Mobile-first page layout component that provides consistent padding and spacing
 */
export default function PageLayout({
  children,
  className = '',
  title,
  subtitle,
}: PageLayoutProps) {
  return (
    <div className={`w-full px-5 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8 ${className}`}>
      {/* Page header (optional) */}
      {(title || subtitle) && (
        <div className="mb-6">
          {title && <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl text-white mb-2">{title}</h1>}
          {subtitle && <p className="text-gray-400">{subtitle}</p>}
        </div>
      )}
      
      {/* Page content */}
      <div>
        {children}
      </div>
    </div>
  );
} 