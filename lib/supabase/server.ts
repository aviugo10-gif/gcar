import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../env";

/** Acts as the signed-in user: every query goes through RLS. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: true }));
        } catch {
          /* called from a Server Component: the middleware refreshes cookies */
        }
      },
    },
  });
}

/** Service role: only for public form endpoints that call the rate-limited SQL functions. Never imported by client code. */
export function supabaseService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

/** Anonymous read client for the public catalog view. */
export function supabasePublic() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}
