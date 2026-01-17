import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Single client used both in server components (for data fetching)
// and in client components (for auth & actions)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
