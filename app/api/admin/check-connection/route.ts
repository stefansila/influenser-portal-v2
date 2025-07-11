import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Konstante iz .env ili supabase konfiguracije za admin pristup
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fbmdbvijfufsjpsuorxi.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Kreiramo admin klijenta sa service_role ključem
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET(request: NextRequest) {
  try {
    // Dobijamo podatke o okruženju (bez poverljivih vrednosti)
    const env = {
      SUPABASE_URL: SUPABASE_URL,
      SUPABASE_SERVICE_KEY: SUPABASE_SERVICE_KEY ? 'Postoji' : 'NE POSTOJI!',
      NODE_ENV: process.env.NODE_ENV || 'undefined',
    };

    // Pokušaj jednostavnu operaciju na Supabase-u
    const { count, error } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json({
        status: 'error',
        message: 'Greška pri povezivanju sa Supabase-om',
        error: error.message,
        env
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'success',
      message: 'Povezivanje sa Supabase-om je uspešno',
      userCount: count,
      env
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: 'Došlo je do neočekivane greške',
      error: error.message
    }, { status: 500 });
  }
} 