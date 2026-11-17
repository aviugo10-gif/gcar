// The "quote within minutes" promise on the scrap page, computed in Israel time from business hours and holidays.
export type Hours = Record<"sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat", [string, string] | null>;
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** Wall-clock parts in Asia/Jerusalem for a given instant. */
export function israelParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { ymd: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), dow };
}
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export type ScrapPromise =
  | { kind: "minutes"; text: string; sub: string }
  | { kind: "later"; text: string; sub: string; day: string; time: string };

/**
 * Weekdays (Sun–Thu) inside business hours: "within minutes". Otherwise, the next working day's opening time.
 * Friday and Saturday never promise minutes, even inside Friday hours (the user's rule).
 */
export function scrapPromise(now: Date, hours: Hours, holidays: string[] = [], enabled = true, minutes = 30): ScrapPromise {
  const { ymd, minutes: m, dow } = israelParts(now);
  const today = hours[DAYS[dow]];
  const working = enabled && dow <= 4 && !holidays.includes(ymd) && today && m >= toMin(today[0]) && m < toMin(today[1]) - 15;
  if (working) return { kind: "minutes", text: "הצעת מחיר תוך דקות", sub: `בדרך כלל תוך ${minutes} דקות בשעות הפעילות.` };
  // find the next opening, skipping Fri/Sat and holidays
  for (let add = 0; add < 14; add++) {
    const day = new Date(now.getTime() + add * 86_400_000);
    const p = israelParts(day);
    const h = hours[DAYS[p.dow]];
    if (!h || p.dow >= 5 || holidays.includes(p.ymd)) continue;
    if (add === 0 && m >= toMin(h[0])) continue;
    const dayName = add === 0 ? "היום" : add === 1 ? "מחר" : `ביום ${DAY_HE[p.dow]}`;
    return { kind: "later", text: `נחזור עם הצעה ${dayName} מ־${h[0]}`, sub: "השאירו פרטים עכשיו, ההצעה תחכה לכם בווצאפ.", day: dayName, time: h[0] };
  }
  return { kind: "later", text: "נחזור אליכם עם הצעה בהקדם", sub: "", day: "", time: "" };
}
