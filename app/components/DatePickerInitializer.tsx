'use client';

import { useEffect } from 'react';
import { initializeDateInputs } from '../lib/datePickerFix';

export default function DatePickerInitializer() {
  useEffect(() => {
    // Inicijalizuj date picker funkcionalnost
    initializeDateInputs();
  }, []);
  
  // Ova komponenta ne renderuje ništa vidljivo u DOM-u
  return null;
} 