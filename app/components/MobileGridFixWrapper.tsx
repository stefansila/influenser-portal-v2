'use client';

import React from 'react';

/**
 * Wrapper komponenta koja učitava dodatne CSS klase za mobilne uređaje
 * Ova komponenta je jednostavno prosledi decu dalje
 */
export function MobileGridFixWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
} 