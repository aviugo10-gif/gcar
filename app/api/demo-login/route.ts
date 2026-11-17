import { NextResponse } from "next/server";
import { isDemo } from "@/lib/env";
import { sign, DEMO_COOKIE } from "@/lib/server/demo-auth";
import { clientKey, memLimit, readJson } from "@/lib/server/guard";

// Demo login: password "gcar-demo" + any 6-digit code. Disabled as soon as Supabase is configured.
export async function POST(req: Request) {
  if (!isDemo) return NextResponse.json({ error: "disabled" }, { status: 404 });
  if (!memLimit("login:" + (await clientKey()), 10, 600_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const { password, code } = ((await readJson(req, 512)) ?? {}) as { password?: string; code?: string };
  if (password !== "gcar-demo") return NextResponse.json({ error: "password" }, { status: 401 });
  if (!/^\d{6}$/.test(code ?? "")) return NextResponse.json({ error: "code" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_COOKIE, sign(String(Date.now() + 30 * 86_400_000)), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 });
  return res;
}
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(DEMO_COOKIE);
  return res;
}
