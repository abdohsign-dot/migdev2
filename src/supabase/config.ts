/**
 * Supabase Configuration
 * Replaces Firebase configuration with Supabase client setup
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Environment variables for Supabase
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Lazy-initialized Supabase client
let _supabase: SupabaseClient | null = null;

/**
 * Get the Supabase client instance
 * Initializes on first call rather than at module load time
 */
export const getSupabaseClient = (): SupabaseClient => {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.');
    }
    
    try {
      _supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      console.log('✅ Supabase client initialized');
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      throw error;
    }
  }
  return _supabase;
};

/**
 * Get the Auth instance
 */
export const getAuth = () => {
  return getSupabaseClient().auth;
};

/**
 * Get the Database instance
 */
export const getDb = () => {
  return getSupabaseClient();
};

/**
 * Reset the Supabase client (useful for testing or re-initialization)
 */
export const resetSupabaseClient = () => {
  _supabase = null;
};
