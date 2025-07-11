import React from 'react';

interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: string;
  className?: string;
}

export default function ResponsiveGrid({
  children,
  columns = { xs: 1, sm: 1, md: 2, lg: 3, xl: 4 },
  gap = 'gap-4',
  className = '',
}: ResponsiveGridProps) {
  // Build the grid template columns classes dynamically, ensuring mobile is always single column
  const colClasses = [
    `grid-cols-1`, // Always start with 1 column for smallest screens
    columns.sm && columns.sm > 1 ? `sm:grid-cols-${columns.sm}` : '',
    columns.md && columns.md > 1 ? `md:grid-cols-${columns.md}` : '',
    columns.lg && columns.lg > 1 ? `lg:grid-cols-${columns.lg}` : '',
    columns.xl && columns.xl > 1 ? `xl:grid-cols-${columns.xl}` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={`grid ${colClasses} ${gap} ${className}`}>
      {children}
    </div>
  );
} 