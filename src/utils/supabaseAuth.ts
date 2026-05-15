/**
 * Supabase Authentication utilities
 * Replaces Firebase Auth with Supabase Auth
 */

import { getAuth, getDb } from '../supabase/config';
import type { User, Session } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  admin: boolean;
  driver: boolean;
  driver_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize Supabase Authentication and set up auth state listener
 */
export const initializeAuth = () => {
  const auth = getAuth();
  return auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      console.log('User authenticated:', session.user.id);
    } else {
      console.log('User signed out');
    }
  });
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const auth = getAuth();
    const { data, error } = await auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    
    console.log('✅ Sign in successful');
    return data.user;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
};

/**
 * Sign up with email and password
 */
export const signUpWithEmail = async (email: string, password: string) => {
  try {
    const auth = getAuth();
    const { data, error } = await auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    
    console.log('✅ Sign up successful');
    return data.user;
  } catch (error) {
    console.error('Sign up error:', error);
    throw error;
  }
};

/**
 * Sign out current user
 */
export const signOut = async () => {
  try {
    const auth = getAuth();
    const { error } = await auth.signOut();
    
    if (error) throw error;
    
    console.log('✅ Sign out successful');
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const auth = getAuth();
    const { data: { user } } = await auth.getUser();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Get current session
 */
export const getCurrentSession = async (): Promise<Session | null> => {
  try {
    const auth = getAuth();
    const { data: { session } } = await auth.getSession();
    return session;
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
};

/**
 * Get user profile from profiles table
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

/**
 * Check if current user is admin
 */
export const isCurrentUserAdmin = async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const profile = await getUserProfile(user.id);
    return profile?.admin || false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

/**
 * Check if current user is driver
 */
export const isCurrentUserDriver = async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const profile = await getUserProfile(user.id);
    return profile?.driver || false;
  } catch (error) {
    console.error('Error checking driver status:', error);
    return false;
  }
};

/**
 * Get current user's driver ID (if they are a driver)
 */
export const getCurrentDriverId = async (): Promise<string | null> => {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const profile = await getUserProfile(user.id);
    return profile?.driver_id || null;
  } catch (error) {
    console.error('Error getting driver ID:', error);
    return null;
  }
};

/**
 * Create admin user profile
 */
export const createAdminProfile = async (userId: string, email: string) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        admin: true,
        driver: false,
      })
      .select()
      .single();

    if (error) throw error;
    
    console.log('Admin profile created successfully:', userId);
    return data;
  } catch (error) {
    console.error('Error creating admin profile:', error);
    throw error;
  }
};

/**
 * Create driver user profile
 */
export const createDriverProfile = async (userId: string, email: string, driverId: string) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        admin: false,
        driver: true,
        driver_id: driverId,
      })
      .select()
      .single();

    if (error) throw error;
    
    console.log('Driver profile created successfully:', userId);
    return data;
  } catch (error) {
    console.error('Error creating driver profile:', error);
    throw error;
  }
};

/**
 * Reset password
 */
export const resetPassword = async (email: string) => {
  try {
    const auth = getAuth();
    const { error } = await auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
    
    console.log('✅ Password reset email sent');
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
};

/**
 * Update password
 */
export const updatePassword = async (newPassword: string) => {
  try {
    const auth = getAuth();
    const { error } = await auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
    
    console.log('✅ Password updated successfully');
  } catch (error) {
    console.error('Password update error:', error);
    throw error;
  }
};
