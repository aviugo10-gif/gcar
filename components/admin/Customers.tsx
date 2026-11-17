"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "../Icon";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";
import { createCustomer } from "@/app/admin/actions";
import { money, phone as fmtPhone } from "@/lib/format";
import { isValidIsraeliId, isValidPhone } from "@/lib/il";
import type { Customer } from "@/lib/types";

export function CustomersList({ customers, openNew }: { customers: (Customer & { debt: number; overdue: number })[]; openNew: boolean }) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(openNew);
  const rows = useMemo(() => {
    const n = q.replace(/[-\s]/g, "");
    return customers.filter((c) => !n || c.full_name.includes(q.trim()) || c.phone.includes(n) || c.id_number_last4 === n);
  }, [customers, q]);
  return (
    <div className="gc-stack" style={{ gap: 12 }}>
      <label className="searchbar"><Icon name="search" className="gc-faint" /><input type="search" placeholder="שם, טלפון או 4 ספרות אחרונות של ת״ז" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש לקוח" /></label>
      {rows.length ? (
        <div className="list">
          {rows.map((c) => (
            <Link key={c.id} href={`/admin/customers/${c.id}`} className="row-link">
              <span className="avatar" aria-hidden="true">{c.full_name.trim()[0]}</span>
              <span className="row-link__main"><span className="row-link__t">{c.full_name}</span><span className="row-link__s gc-num" dir="ltr" style={{ textAlign: "end" }}>{fmtPhone(c.phone)}</span></span>
              {c.debt > 0 && <span className={`gc-tag ${c.overdue ? "gc-tag--sale" : "gc-tag--glass"}`}>{c.overdue ? "באיחור " : "יתרה "}<span className="gc-num">{money(c.debt)}</span></span>}
              <Icon name="chevron-left" className="gc-faint" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="gc-empty"><span className="gc-empty__ic"><Icon name="users" /></span><p className="gc-empty__title">{q ? "לא נמצא לקוח" : "עוד אין לקוחות"}</p></div>
      )}
      <button className="gc-btn gc-btn--primary fab" onClick={() => setAdding(true)}><Icon name="plus" />לקוח חדש</button>
      {adding && <CustomerSheet onClose={() => setAdding(false)} />}
    </div>
  );
}

/** Name + phone are enough; the ID number is checked (check digit) and encrypted on the server. */
export function CustomerSheet({ onClose, onCreated }: { onClose: () => void; onCreated?: (id: string, name: string) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ full_name: "", phone: "", id_number: "", email: "", address: "", notes: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const phoneBad = f.phone.length >= 9 && !isValidPhone(f.phone);
  const idBad = f.id_number.length >= 5 && !isValidIsraeliId(f.id_number);
  async function save() {
    setBusy(true); setErr("");
    const r = await createCustomer({ ...f, id_number: f.id_number || undefined, email: f.email || null, address: f.address || null, notes: f.notes || null });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast(r.data!.duplicate ? "הלקוח כבר קיים, נבחר הקיים" : "הלקוח נוסף");
    if (onCreated) onCreated(r.data!.id, f.full_name);
    else router.push(`/admin/customers/${r.data!.id}`);
    onClose();
    router.refresh();
  }
  return (
    <Sheet title="לקוח חדש" onClose={onClose} footer={<button className="gc-btn gc-btn--primary gc-btn--block" disabled={busy || f.full_name.length < 2 || !isValidPhone(f.phone) || idBad} onClick={save}>{busy ? "שומר…" : "שמירה"}</button>}>
      <div className="form">
        <label className="gc-field"><span className="gc-field__label">שם מלא</span><span className="gc-field__control"><input value={f.full_name} onChange={(e) => set("full_name", e.target.value)} autoComplete="off" /></span></label>
        <label className={`gc-field ${phoneBad ? "gc-field--error" : ""}`}><span className="gc-field__label">טלפון</span><span className="gc-field__control"><Icon name="phone" size="sm" /><input type="tel" inputMode="tel" dir="ltr" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></span>{phoneBad && <span className="gc-field__hint">מספר לא תקין</span>}</label>
        <label className={`gc-field ${idBad ? "gc-field--error" : ""}`}><span className="gc-field__label">תעודת זהות (לא חובה)</span><span className="gc-field__control"><Icon name="lock" size="sm" /><input inputMode="numeric" dir="ltr" value={f.id_number} onChange={(e) => set("id_number", e.target.value.replace(/\D/g, "").slice(0, 9))} autoComplete="off" /></span><span className="gc-field__hint">{idBad ? "ספרת הביקורת לא מתאימה" : "נשמרת מוצפנת. במערכת מוצגות רק 4 ספרות אחרונות."}</span></label>
        <details><summary className="t-label" style={{ cursor: "pointer" }}>עוד פרטים</summary>
          <div className="form" style={{ marginTop: 12 }}>
            <label className="gc-field"><span className="gc-field__label">אימייל</span><span className="gc-field__control"><input type="email" dir="ltr" value={f.email} onChange={(e) => set("email", e.target.value)} /></span></label>
            <label className="gc-field"><span className="gc-field__label">עיר / כתובת</span><span className="gc-field__control"><input value={f.address} onChange={(e) => set("address", e.target.value)} /></span></label>
            <label className="gc-field"><span className="gc-field__label">הערות</span><span className="gc-field__control"><textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></span></label>
          </div>
        </details>
        {err && <div className="alert alert--danger" role="alert"><Icon name="alert" />{err}</div>}
      </div>
    </Sheet>
  );
}
