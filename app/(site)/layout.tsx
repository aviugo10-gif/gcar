import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { A11yWidget } from "@/components/site/A11yWidget";
import { Icon } from "@/components/Icon";
import { getSettings } from "@/lib/data/public";
import { waLink } from "@/lib/wa";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <>
      <a className="skip" href="#main">דילוג לתוכן</a>
      <SiteHeader phone={s.business.phone} />
      <main id="main">{children}</main>
      <SiteFooter s={s} />
      <a className="wa-float" href={waLink(s.business.phone)} target="_blank" rel="noopener" aria-label="שליחת הודעה בווצאפ"><Icon name="message-circle" size="lg" /></a>
      <A11yWidget />
    </>
  );
}
