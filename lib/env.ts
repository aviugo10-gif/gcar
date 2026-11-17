// Demo mode: no Supabase keys yet (the accounts aren't open). The app runs on seeded in-memory data so every screen
// can be seen and tested. Production refuses to start in demo mode.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const noSupabase = !SUPABASE_URL || !SUPABASE_ANON_KEY;
/** Demo needs an explicit opt-in outside `next dev`, so a deploy with missing keys never opens with a known password. */
export const demoAllowed = process.env.NODE_ENV !== "production" || (process.env.GCAR_DEMO === "1" && (process.env.DEMO_SECRET ?? "").length >= 32);
export const isDemo = noSupabase;
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const BUSINESS_PHONE = process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? "0528528282";
export const PHOTO_BASE = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/vehicle-photos/` : "/demo/";

if (typeof window === "undefined" && isDemo && (!demoAllowed || process.env.VERCEL_ENV === "production")) {
  throw new Error("Supabase env vars are missing. Demo mode needs GCAR_DEMO=1 and a DEMO_SECRET of 32+ characters, and is never allowed on the production deployment.");
}
