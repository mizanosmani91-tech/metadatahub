// utils/supabase.js
import { createClient } from '@supabase/supabase-js';

// Fallback values prevent build-time crashes when environment variables are not yet loaded
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);