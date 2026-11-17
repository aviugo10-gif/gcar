import { createHmac, timingSafeEqual } from "node:crypto";
// Demo mode only: a signed cookie stands in for the Supabase session (password + second factor).
const SECRET = process.env.DEMO_SECRET ?? (process.env.NODE_ENV !== "production" ? "gcar-demo-secret-dev-only" : "");
export const DEMO_COOKIE = "gc_demo";
export const sign = (v: string) => {
  if (!SECRET) throw new Error("DEMO_SECRET is required for demo mode outside development");
  return `${v}.${createHmac("sha256", SECRET).update(v).digest("hex").slice(0, 32)}`;
};
export function verify(cookie?: string): boolean {
  if (!cookie) return false;
  const [v] = cookie.split(".");
  const a = Buffer.from(sign(v)), b = Buffer.from(cookie);
  return a.length === b.length && timingSafeEqual(a, b) && Number(v) > Date.now();
}
