"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "../Icon";
import type { IconName } from "../icons-data";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";
import { addExpense, deleteExpense, ocrDocument } from "@/app/admin/actions";
import { compressImage } from "@/lib/image";
import { money, date, toAgorot } from "@/lib/format";
import type { VehicleExpense, ExpenseCategory } from "@/lib/types";

export function ExpensesTab({ vehicleId, expenses, categories, suppliers }: { vehicleId: string; expenses: VehicleExpense[]; categories: ExpenseCategory[]; suppliers: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const rows = expenses.filter((e) => !hidden.includes(e.id));
  const total = rows.reduce((s, e) => s + e.amount, 0);
  const cat = (id: string) => categories.find((c) => c.id === id);
  const byCat = categories.map((c) => ({ c, sum: rows.filter((e) => e.category_id === c.id).reduce((s, e) => s + e.amount, 0) })).filter((x) => x.sum > 0).sort((a, b) => b.sum - a.sum);

  async function remove(e: VehicleExpense) {
    setHidden((h) => [...h, e.id]);
    await deleteExpense(e.id, vehicleId);
    toast(`נמחקה הוצאה: ${money(e.amount)}`, async () => {
      const { id: _id, ...copy } = e;
      await deleteExpense(e.id, vehicleId, true, copy);
      setHidden((h) => h.filter((x) => x !== e.id));
      router.refresh();
    });
    router.refresh();
  }
  return (
    <div className="gc-stack" style={{ gap: 16 }}>
      <div className="gc-stat gc-stat--ink"><span className="gc-stat__label"><Icon name="wrench" size="sm" />סה״כ הוצאות על הרכב</span><span className="gc-stat__value gc-num">{money(total)}</span></div>
      {byCat.length > 1 && (
        <div className="stack-bar" aria-label="פילוח לפי קטגוריה">
          {byCat.map(({ c, sum }, i) => <span key={c.id} style={{ flex: sum, opacity: 1 - i * 0.14 }} title={`${c.name}: ${money(sum)}`} />)}
        </div>
      )}
      <button className="gc-btn gc-btn--primary gc-btn--block" onClick={() => setOpen(true)}><Icon name="plus" />הוספת הוצאה</button>
      {rows.length ? (
        <div className="ios-list">
          {rows.map((e) => (
            <div key={e.id}>
              <span className="attn__ic attn__ic--info" style={{ width: 36, height: 36 }}><Icon name={(cat(e.category_id)?.icon ?? "receipt") as IconName} size="sm" /></span>
              <span className="grow" style={{ display: "flex", flexDirection: "column", padding: "8px 0" }}><b style={{ fontWeight: 600 }}>{cat(e.category_id)?.name}</b><span className="t-caption">{[e.supplier, date(e.date, true), e.note].filter(Boolean).join(" · ")}</span></span>
              <span className="gc-num" style={{ fontWeight: 600 }}>{money(e.amount)}</span>
              <button className="gc-btn gc-btn--ghost gc-btn--icon" aria-label="מחיקה" onClick={() => remove(e)}><Icon name="trash" size="sm" /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="gc-empty"><span className="gc-empty__ic"><Icon name="receipt" /></span><p className="gc-empty__title">עוד אין הוצאות</p><p className="gc-empty__text">כל הוצאה נכנסת לחישוב הרווח.</p></div>
      )}
      {open && <AddExpense vehicleId={vehicleId} categories={categories} suppliers={suppliers} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddExpense({ vehicleId, categories, suppliers, onClose }: { vehicleId: string; categories: ExpenseCategory[]; suppliers: string[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [cat, setCat] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const press = (k: string) => setAmount((a) => (k === "del" ? a.slice(0, -1) : (a + k).replace(/^0+/, "").slice(0, 7)));

  async function scan(f: File) {
    setBusy(true);
    const fd = new FormData();
    fd.set("image", new File([await compressImage(f)], "r.jpg", { type: "image/jpeg" }));
    fd.set("docType", "receipt");
    const r = await ocrDocument(fd);
    setBusy(false);
    if (!r.ok) return toast(r.error);
    const x = r.data!.fields;
    if (x.total) setAmount(String(Math.round(Number(x.total))));
    if (x.supplier) setSupplier(x.supplier);
    if (x.date) setDay(x.date);
    toast("הקבלה נקראה. בודקים ושומרים");
  }
  async function save() {
    if (!cat || !amount) return;
    setBusy(true);
    const r = await addExpense({ vehicle_id: vehicleId, category_id: cat, amount: toAgorot(Number(amount)), date: day, supplier: supplier || null, note: note || null });
    setBusy(false);
    if (!r.ok) return toast(r.error);
    toast(`נוספה הוצאה: ₪ ${Number(amount).toLocaleString("he-IL")}`);
    onClose(); router.refresh();
  }
  return (
    <Sheet title={cat ? categories.find((c) => c.id === cat)!.name : "על מה ההוצאה?"} onClose={onClose}
      footer={cat ? <button className="gc-btn gc-btn--primary gc-btn--block" onClick={save} disabled={!amount || busy}>{busy ? "שומר…" : "שמירה"}</button> : undefined}>
      {!cat ? (
        <div className="gc-stack">
          <div className="gc-cats">{categories.map((c) => <button key={c.id} className="gc-cat" aria-pressed={false} onClick={() => setCat(c.id)}><span className="gc-cat__ic"><Icon name={c.icon as IconName} /></span>{c.name}</button>)}</div>
          <button className="gc-btn gc-btn--outline gc-btn--block" onClick={() => file.current?.click()} disabled={busy}><Icon name="camera" />{busy ? "קורא…" : "צילום קבלה"}</button>
          <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { if (e.target.files?.[0]) { scan(e.target.files[0]); setCat(categories[0].id); } }} />
        </div>
      ) : (
        <div className="gc-stack">
          <button className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => setCat(null)}>החלפת קטגוריה</button>
          <div className="amount-display" aria-live="polite">₪ {amount ? Number(amount).toLocaleString("he-IL") : "0"}</div>
          <div className="numpad">{["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"].map((k) => <button key={k} onClick={() => press(k)} aria-label={k === "del" ? "מחיקת ספרה" : k}>{k === "del" ? <Icon name="undo" /> : k}</button>)}</div>
          {suppliers.length > 0 && <div className="gc-chips">{suppliers.slice(0, 8).map((s) => <button key={s} className="gc-chip" aria-pressed={supplier === s} onClick={() => setSupplier(supplier === s ? "" : s)}>{s}</button>)}</div>}
          <div className="grid2">
            <label className="gc-field"><span className="gc-field__label">ספק</span><span className="gc-field__control"><input value={supplier} onChange={(e) => setSupplier(e.target.value)} /></span></label>
            <label className="gc-field"><span className="gc-field__label">תאריך</span><span className="gc-field__control"><input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></span></label>
          </div>
          <label className="gc-field"><span className="gc-field__label">הערה</span><span className="gc-field__control"><input value={note} onChange={(e) => setNote(e.target.value)} /></span></label>
        </div>
      )}
    </Sheet>
  );
}
