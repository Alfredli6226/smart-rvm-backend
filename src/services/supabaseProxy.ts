import { supabase } from './supabase';

/**
 * Supabase Proxy — uses the anon key directly from the frontend.
 * These functions are used for admin write operations that bypass RLS
 * by calling backend API endpoints.
 */

// Direct Supabase client operations for admin features
// Using the anon key + RLS policies for secure access

export const proxy = {
  from: (table: string) => supabase.from(table),
};

export async function proxySelect(table: string, query: any) {
  return supabase.from(table as any).select(query);
}

export async function proxyUpdate(table: string, data: any, match: any) {
  return supabase.from(table as any).update(data).match(match);
}

export async function proxyInsert(table: string, data: any) {
  return supabase.from(table as any).insert(data);
}

export async function proxyDelete(table: string, match: any) {
  return supabase.from(table as any).delete().match(match);
}

export async function proxyUpsert(table: string, data: any, conflict: string) {
  return supabase.from(table as any).upsert(data, { onConflict: conflict });
}
