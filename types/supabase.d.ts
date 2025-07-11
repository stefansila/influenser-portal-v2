// Custom fix for Supabase Realtime .on method types
import { RealtimeChannel, RealtimeChannelOptions } from '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  interface RealtimeChannel {
    on(
      event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
      table: string,
      callback: (payload: any) => void
    ): RealtimeChannel;
    
    on(
      event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
      callback: (payload: any) => void
    ): RealtimeChannel;

    on(
      event: 'presence',
      callback: (payload: {
        event: 'sync' | 'join' | 'leave';
        presence: {
          [key: string]: any;
        };
      }) => void
    ): RealtimeChannel;

    on(
      event: 'broadcast',
      callback: (payload: any) => void
    ): RealtimeChannel;

    on(
      event: 'broadcast',
      params: { event: string },
      callback: (payload: any) => void
    ): RealtimeChannel;
  }
} 