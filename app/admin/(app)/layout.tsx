import type { Metadata } from "next";
import { VaultProvider } from "@/components/admin/Vault";
import { ToastProvider } from "@/components/admin/Toast";
import { Shell } from "@/components/admin/Shell";
import { isDemo } from "@/lib/env";
import { listLeads, listScrap } from "@/lib/data/admin";

export const metadata: Metadata = { title: { default: "ניהול", template: "%s · gcar ניהול" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [leads, scrap] = await Promise.all([listLeads(), listScrap()]);
  const inbox = leads.filter((l) => l.status === "new").length + scrap.filter((s) => s.status === "new").length;
  return (
    <VaultProvider>
      <ToastProvider>
        <Shell inbox={inbox} demo={isDemo}>{children}</Shell>
      </ToastProvider>
    </VaultProvider>
  );
}
