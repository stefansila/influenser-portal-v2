import React from 'react';

interface GridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: string;
  className?: string;
}

/**
 * Jednostavna komponenta za grid layout koja automatski prelazi na jedan stubac na mobilnim uređajima
 */
export default function SimpleGridLayout({
  children,
  columns = 3,
  gap = 'gap-4',
  className = '',
}: GridProps) {
  let gridClass = '';
  
  // Na mobilnim uređajima uvek jedan stubac, na većim ekranima po želji
  switch (columns) {
    case 1:
      gridClass = 'grid-cols-1';
      break;
    case 2:
      gridClass = 'grid-cols-1 md:grid-cols-2';
      break;
    case 3:
      gridClass = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      break;
    case 4:
      gridClass = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
      break;
    default:
      gridClass = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  }

  return (
    <div className={`grid ${gridClass} ${gap} ${className}`}>
      {children}
    </div>
  );
} 