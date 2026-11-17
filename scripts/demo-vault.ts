// Builds lib/demo-vault.json: a demo vault (password "gcar-demo-vault") and encrypted demo prices.
import { writeFileSync } from "node:fs";
import { createVault, seal, DEFAULT_KDF } from "../lib/vault.ts";
const { record, recoveryCode, key } = await createVault("gcar-demo-vault", DEFAULT_KDF);
const prices: Record<string, [number, number]> = {
  v1: [6850000, 7900000], v2: [6100000, 6900000], v3: [4950000, 5600000], v4: [5300000, 6050000],
  v5: [7600000, 8600000], v6: [9800000, 11200000], v7: [10400000, 11900000], v8: [3900000, 4500000],
};
const enc: Record<string, { purchase: string; min: string }> = {};
for (const [id, [p, m]] of Object.entries(prices)) enc[id] = { purchase: await seal(key, "purchase_price", p), min: await seal(key, "min_price", m) };
const expenses = [
  ["2026-09-01", { category: "שכירות מגרש", amount: 1200000, vat: 183051 }], ["2026-09-01", { category: "ביטוח", amount: 280000 }],
  ["2026-09-01", { category: "פרסום", amount: 150000, vat: 22881 }], ["2026-10-01", { category: "שכירות מגרש", amount: 1200000, vat: 183051 }],
  ["2026-10-01", { category: "ביטוח", amount: 280000 }], ["2026-10-01", { category: "פרסום", amount: 220000, vat: 33559 }],
  ["2026-11-01", { category: "שכירות מגרש", amount: 1200000, vat: 183051 }], ["2026-11-01", { category: "ביטוח", amount: 280000 }],
];
const income = [["2026-09-01", { category: "תיקוני רכב ללקוחות", amount: 640000 }], ["2026-10-01", { category: "מכירת חלקים ופירוק", amount: 910000 }], ["2026-11-01", { category: "תיקוני רכב ללקוחות", amount: 380000 }]];
const be = [] as { id: string; month: string; payload_enc: string }[];
for (const [i, [month, p]] of expenses.entries()) be.push({ id: `be${i}`, month: month as string, payload_enc: await seal(key, "business_expense", p) });
const oi = [] as { id: string; month: string; payload_enc: string }[];
for (const [i, [month, p]] of income.entries()) oi.push({ id: `oi${i}`, month: month as string, payload_enc: await seal(key, "other_income", p) });
// the sold car's purchase price, for profit/VAT
enc.v9 = { purchase: await seal(key, "purchase_price", 5200000), min: await seal(key, "min_price", 5800000) };
writeFileSync("lib/demo-vault.json", JSON.stringify({ note: "DEMO ONLY. Password: gcar-demo-vault. Recovery: " + recoveryCode, record, prices: enc, business_expenses: be, other_income: oi }, null, 1));
console.log("ok");
