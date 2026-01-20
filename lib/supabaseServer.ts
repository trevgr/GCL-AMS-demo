// lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

// If you have generated DB types, swap `any` for `Database`
export async function createServerSupabaseClient(): Promise<SupabaseClient<any>> {
  // In your Next version, cookies() is async and returns a Promise
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read auth cookies (access/refresh tokens)
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // No-op setters in server components (we don't mutate cookies here)
        set() {
          // Intentionally blank
        },
        remove() {
          // Intentionally blank
        },
      },
    }
  );
}
