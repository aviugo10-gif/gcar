import "server-only";
// New lead / scrap request → Telegram (instant, free) and email via Resend (backup). Web Push comes with the PWA in stage 5.
// No sensitive data in notifications: car, town, first name, a link into the admin app.
type Note = { title: string; lines: string[]; link: string };

async function telegram(n: Note) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  const esc = (s: string) => s.replace(/[<&>]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
  const text = `<b>${esc(n.title)}</b>\n${n.lines.map(esc).join("\n")}\n<a href="${n.link}">פתיחה באפליקציה</a>`;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(5000),
  });
  return r.ok;
}
async function email(n: Note) {
  const key = process.env.RESEND_API_KEY, to = process.env.NOTIFY_EMAIL_TO, from = process.env.NOTIFY_EMAIL_FROM;
  if (!key || !to || !from) return false;
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>${n.title}</h2>${n.lines.map((l) => `<p>${l.replace(/[<&>]/g, "")}</p>`).join("")}<p><a href="${n.link}">פתיחה באפליקציה</a></p></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject: n.title, html }), signal: AbortSignal.timeout(5000),
  });
  return r.ok;
}

export async function notifyOwner(n: Note): Promise<{ telegram: boolean; email: boolean }> {
  const [t, e] = await Promise.allSettled([telegram(n), email(n)]);
  return { telegram: t.status === "fulfilled" && t.value, email: e.status === "fulfilled" && e.value };
}
