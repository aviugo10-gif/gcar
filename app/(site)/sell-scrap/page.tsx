import type { Metadata } from "next";
import { getHolidays, getSettings } from "@/lib/data/public";
import { scrapPromise } from "@/lib/promise";
import { ScrapForm } from "@/components/site/ScrapForm";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: "מכירת רכב לפירוק", description: "רכב ישן, אחרי תאונה או בלי טסט? ממלאים פרטים ומקבלים הצעת מחיר. גרירה עלינו, ביטול רישום ואישור בכתב." };
export const dynamic = "force-dynamic"; // the promise depends on the current time in Israel

const FAQ = [
  ["הרכב לא נוסע. אפשר?", "כן. הגרירה עלינו, מכל מקום בארץ."],
  ["אין לרכב טסט בתוקף. אפשר?", "כן. טסט לא נדרש למכירה לפירוק."],
  ["יש שעבוד או עיקול על הרכב?", "צריך להסיר אותו לפני ביטול הרישום. ספרו לנו בטופס ונסביר מה עושים."],
  ["הרכב רשום על שם אדם שנפטר?", "אפשר. נדרשים צו ירושה או צו קיום צוואה. נעבור על המסמכים יחד."],
  ["תוך כמה זמן הרכב יורד משמי?", "ביטול הרישום נעשה בסמוך לאיסוף, ותקבלו אישור בכתב. אפשר לבדוק גם במאגר משרד התחבורה."],
  ["מגיע לי החזר על האגרה?", "אם נותרו 30 יום ומעלה לתוקף רישיון הרכב, אפשר לקבל החזר יחסי של אגרת הרישוי ממשרד התחבורה."],
];

export default async function ScrapPage() {
  const [s, holidays] = await Promise.all([getSettings(), getHolidays()]);
  const promise = scrapPromise(new Date(), s.hours, holidays, s.scrap.promise_enabled, s.scrap.promise_minutes);
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  return (
    <div className="wrap" style={{ paddingTop: 24 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />
      <div className="car">
        <div className="gc-stack" style={{ gap: 24 }}>
          <div className="gc-stack">
            <h1 className="t-display-l">מכירת רכב לפירוק</h1>
            <p className="t-body-l gc-muted" style={{ maxWidth: "56ch" }}>רכב ישן, אחרי תאונה או שפשוט נמאס לטפל בו? ממלאים כמה פרטים, מקבלים הצעת מחיר, ואנחנו דואגים לכל השאר.</p>
          </div>
          <div className="gc-offer"><span className="gc-offer__badge"><Icon name="clock" size="lg" /></span><div><p className="gc-offer__title">{promise.text}</p><p className="gc-offer__text">{promise.kind === "minutes" ? "בימים א׳–ה׳ בשעות הפעילות. בלי התחייבות." : promise.sub}</p></div></div>
          <div className="card"><ScrapForm promise={promise} phone={s.business.phone} /></div>
        </div>
        <aside className="car__side gc-stack" style={{ gap: 16 }}>
          <div className="card gc-stack">
            <h2 className="t-title-m">איך זה עובד</h2>
            {[["file-text", "ממלאים פרטים", "פחות מ־2 דקות, בלי להתחייב."], ["banknote", "מקבלים הצעה", "בווצאפ או בטלפון, לפי מה שנוח."], ["truck", "איסוף, תשלום וביטול רישום", "גוררים, משלמים במעמד האיסוף ומבטלים את הרישום."]].map(([i, t, d], n) => (
              <div key={t} className="why__item"><span className="why__ic"><Icon name={i as "truck"} /></span><div><strong>{n + 1}. {t}</strong><p className="gc-muted">{d}</p></div></div>
            ))}
          </div>
          <div className="card gc-stack">
            <h2 className="t-title-m">על מה אפשר לסמוך</h2>
            <ul className="gc-stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {["טיפול בביטול הרישום ואישור בכתב שהרכב ירד מהכביש", "גרירה עלינו", "תשלום במעמד האיסוף", "לא מציפים בהודעות: פונים רק לגבי ההצעה"].map((t) => <li key={t} className="gc-row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}><Icon name="shield-check" size="sm" />{t}</li>)}
            </ul>
          </div>
          <div className="card gc-stack">
            <h2 className="t-title-m">שאלות נפוצות</h2>
            {FAQ.map(([q, a]) => <details key={q}><summary style={{ cursor: "pointer", fontWeight: 600, padding: "8px 0" }}>{q}</summary><p className="gc-muted" style={{ paddingBottom: 8 }}>{a}</p></details>)}
          </div>
        </aside>
      </div>
    </div>
  );
}
