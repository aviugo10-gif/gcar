import "server-only";
// One OCR interface for every document: vehicle licence, receipt, ID card, check, deal document.
// Today: a mock provider (and the plate-only path via the registry). Gemini: set OCR_PROVIDER=gemini + GEMINI_API_KEY.
// Screens don't change when the provider does.
export type DocType = "vehicle_license" | "receipt" | "id_card" | "check" | "deal_doc";
export type OcrField = { value: string; confidence: number };
export type OcrResult = { provider: string; fields: Record<string, OcrField>; raw: unknown };
export interface OcrProvider {
  name: string;
  extract(image: { bytes: Uint8Array; mime: string }, docType: DocType): Promise<OcrResult>;
}

export const FIELDS: Record<DocType, string[]> = {
  vehicle_license: ["plate", "make", "model", "year", "color", "vin", "owner_name", "test_valid_until", "fuel"],
  receipt: ["supplier", "date", "total", "vat"],
  id_card: ["full_name", "id_number", "birth_date", "address"],
  check: ["bank", "branch", "account", "check_number", "amount", "date", "payer"],
  deal_doc: ["title", "date", "parties"],
};

export async function getProvider(): Promise<OcrProvider> {
  if (process.env.OCR_PROVIDER === "gemini" && process.env.GEMINI_API_KEY) return (await import("./gemini")).gemini;
  return (await import("./mock")).mock;
}
