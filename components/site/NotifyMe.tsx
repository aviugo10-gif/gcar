"use client";
import { LeadForm } from "./LeadForm";
export function NotifyMe({ initial }: { initial?: string }) {
  return <LeadForm kind="notify_me" messageLabel="מה אתם מחפשים?" initialMessage={initial} submitLabel="תגידו לי כשמגיע" />;
}
