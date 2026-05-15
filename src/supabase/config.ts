/**
 * Supabase Configuration
 * Replaces Firebase configuration with Supabase client setup
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Environment variables for Supabase
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

// Lazy-initialized Supabase client
let _supabase: SupabaseClient | null = null;
let _supabaseServiceRole: SupabaseClient | null = null;

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
 * Get the Supabase service role client instance
 * Bypasses RLS policies for admin operations like migration
 */
export const getServiceRoleClient = (): SupabaseClient => {
  if (!_supabaseServiceRole) {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      // Silent fallback to anon breaks RLS bypass and causes confusing 42501 errors.
      console.error('❌ Service role key not configured (EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY missing). RLS bypass will not work.');
      throw new Error('Missing Supabase service role key for RLS bypass');
    }

    try {
      _supabaseServiceRole = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.log('✅ Supabase service role client initialized');
    } catch (error) {
      console.error('Failed to initialize Supabase service role client:', error);
      throw error;
    }
  }
  return _supabaseServiceRole;
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
 * Get the Database instance with service role (bypasses RLS)
 */
export const getDbServiceRole = () => {
  return getServiceRoleClient();
};

/**
 * Reset the Supabase client (useful for testing or re-initialization)
 */
export const resetSupabaseClient = () => {
  _supabase = null;
  _supabaseServiceRole = null;
};
