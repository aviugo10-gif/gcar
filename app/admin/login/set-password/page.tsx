import type { Metadata } from "next";
import { SetPassword } from "@/components/admin/SetPassword";
import { Logo } from "@/components/Icon";

export const metadata: Metadata = { title: "הגדרת סיסמה", robots: { index: false } };

export default function Page() {
  return (
    <main className="login">
      <Logo className="footer-logo" />
      <div className="card login__card"><SetPassword /></div>
    </main>
  );
}
