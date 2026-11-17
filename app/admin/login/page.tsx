import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";
import { Logo } from "@/components/Icon";
import { isDemo } from "@/lib/env";

export const metadata: Metadata = { title: "כניסה", robots: { index: false } };

export default function Login() {
  return (
    <main className="login">
      <Logo className="footer-logo" />
      <div className="card login__card"><Suspense><LoginForm demo={isDemo} /></Suspense></div>
      {isDemo && <p className="t-caption" style={{ maxWidth: 360, textAlign: "center" }}>מצב הדגמה: סיסמה <b className="gc-num">gcar-demo</b> וכל קוד בן 6 ספרות. כש־Supabase יחובר, הכניסה תהיה עם סיסמה וקוד מאפליקציית אימות.</p>}
    </main>
  );
}
