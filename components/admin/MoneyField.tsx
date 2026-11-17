"use client";
import { Icon } from "../Icon";

/** Shekel amount, whole shekels, grouped as you type. `value` is a digits-only string. */
export function MoneyField({ label, value, onChange, locked, hint }: { label: string; value: string; onChange: (v: string) => void; locked?: boolean; hint?: string }) {
  return (
    <label className="gc-field">
      <span className="gc-field__label" style={{ display: "flex", alignItems: "center", gap: 6 }}>{locked && <Icon name="lock" size="sm" />}{label}</span>
      <span className="gc-field__control">
        <span className="gc-field__affix">₪</span>
        <input inputMode="numeric" className="gc-num" value={value ? Number(value).toLocaleString("he-IL") : ""} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="0" autoComplete="off" />
      </span>
      {hint && <span className="gc-field__hint">{hint}</span>}
    </label>
  );
}
