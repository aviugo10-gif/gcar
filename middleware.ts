import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Every /admin page needs a session that passed BOTH factors (password + TOTP, "aal2"). The database checks the same
// thing again in RLS, so a bug here can't leak data.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin/login")) return NextResponse.next();
  const toLogin = () => {
    const u = req.nextUrl.clone();
    u.pathname = "/admin/login";
    u.search = pathname !== "/admin" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(u);
  };

  if (!URL_ || !KEY) {
    // demo mode: signed cookie, checked with WebCrypto (the edge runtime has no node:crypto)
    const secret = process.env.DEMO_SECRET ?? (process.env.NODE_ENV !== "production" ? "gcar-demo-secret-dev-only" : "");
    const allowed = process.env.NODE_ENV !== "production" || (process.env.GCAR_DEMO === "1" && secret.length >= 32 && process.env.VERCEL_ENV !== "production");
    if (!allowed) return new NextResponse("Not configured", { status: 503 });
    const c = req.cookies.get("gc_demo")?.value;
    if (!c) return toLogin();
    const [exp, mac] = c.split(".");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(exp)))).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    let diff = sig.length ^ (mac ?? "").length; // constant-time compare
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ (mac ?? "").charCodeAt(i);
    return diff === 0 && Number(exp) > Date.now() ? NextResponse.next() : toLogin();
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(URL_, KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: true }));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return toLogin();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return toLogin();
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
