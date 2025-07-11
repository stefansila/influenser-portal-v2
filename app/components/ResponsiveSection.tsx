import React from 'react';

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
  noPadding?: boolean;
}

/**
 * Responzivna sekcija sa pravilnim paddingom za mobilne uređaje
 */
export default function ResponsiveSection({
  children,
  className = '',
  fullWidth = false,
  noPadding = false,
}: SectionProps) {
  const paddingClasses = noPadding ? '' : 'px-5 py-4 md:p-6 lg:p-8';
  const widthClasses = fullWidth ? 'w-full' : 'w-full max-w-7xl mx-auto';
  
  return (
    <section className={`${paddingClasses} ${widthClasses} ${className}`}>
      {children}
    </section>
  );
} 