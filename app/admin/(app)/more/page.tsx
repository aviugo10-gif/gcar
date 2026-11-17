import Link from "next/link";
import { TopBar } from "@/components/admin/Shell";
import { Icon } from "@/components/Icon";
import type { IconName } from "@/components/icons-data";
import { VaultSettings, SignOut, ThemeToggle } from "@/components/admin/Settings";
import { getVaultRecord } from "@/lib/data/admin";
import { isDemo } from "@/lib/env";

export const metadata = { title: "עוד" };

export default async function Page() {
  const vault = await getVaultRecord();
  const links: [string, string, IconName][] = [["/admin/customers", "לקוחות", "users"], ["/admin/deals", "עסקאות ותשלומים", "receipt"], ["/admin/finance", "כספים", "bar-chart"], ["/admin/inbox", "פניות וגריטה", "inbox"]];
  const notify = [["טלגרם", !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)], ["מייל (Resend)", !!process.env.RESEND_API_KEY], ["קריאת מסמכים (Gemini)", process.env.OCR_PROVIDER === "gemini" && !!process.env.GEMINI_API_KEY]] as const;
  return (
    <>
      <TopBar title="עוד" />
      <main className="app-main narrow gc-stack" style={{ gap: 8 }}>
        <div className="ios-list">{links.map(([h, l, i]) => <Link key={h} href={h}><Icon name={i} /><span className="grow">{l}</span><Icon name="chevron-left" className="gc-faint" /></Link>)}</div>
        <div className="ios-list"><a href="/" target="_blank" rel="noreferrer"><Icon name="globe" /><span className="grow">האתר</span><Icon name="chevron-left" className="gc-faint" /></a><ThemeToggle /></div>
        <h2 className="group-title" id="vault">כספת</h2>
        <VaultSettings exists={!!vault} />
        <h2 className="group-title">התראות וחיבורים</h2>
        <div className="ios-list">{notify.map(([n, on]) => <div key={n}><span className="grow">{n}</span><span className={`gc-status ${on ? "gc-status--available" : "gc-status--sold"}`}>{on ? "מחובר" : "לא הוגדר"}</span></div>)}</div>
        <p className="t-caption">מחברים בהגדרות הסביבה ב־Vercel. פרטי העסק, שעות פעילות וטקסטים באתר יעברו לכאן בשלב הליטוש.</p>
        {isDemo && <div className="alert alert--info"><Icon name="key" />מצב הדגמה: סיסמת הכספת היא gcar-demo-vault</div>}
        <div style={{ marginTop: 16 }}><SignOut /></div>
      </main>
    </>
  );
}
