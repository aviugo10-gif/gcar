// Israel-specific rules: ID check digit, phone numbers, margin VAT.

/** Israeli ID (ת"ז) check digit (Luhn variant). Accepts up to 9 digits, left-padded. */
export function isValidIsraeliId(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length === 0 || d.length > 9) return false;
  const id = d.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let x = Number(id[i]) * ((i % 2) + 1);
    if (x > 9) x -= 9;
    sum += x;
  }
  return sum % 10 === 0;
}

/** Israeli phone, landline or mobile, local format 0XXXXXXXX(X). */
export const normalizePhone = (p: string) => p.replace(/\D/g, "").replace(/^972/, "0");
export const isValidPhone = (p: string) => /^0[2-9]\d{7,8}$/.test(normalizePhone(p));
export const toWhatsApp = (p: string) => "972" + normalizePhone(p).replace(/^0/, "");

/**
 * Margin VAT for a used-car dealer (עוסק מורשה): VAT is due only on the margin, and it is included in it.
 * vat = margin × rate / (100 + rate). A loss means zero VAT. Amounts in agorot.
 */
export function marginVat(salePrice: number, purchasePrice: number, ratePercent = 18) {
  const margin = salePrice - purchasePrice;
  if (margin <= 0) return { margin, vat: 0, net: margin };
  const vat = Math.round((margin * ratePercent) / (100 + ratePercent));
  return { margin, vat, net: margin - vat };
}
