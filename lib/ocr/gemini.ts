import "server-only";
import { FIELDS, type OcrProvider } from "./index";
// Gemini vision via the REST API (no SDK). Asks for strict JSON with a confidence per field.
export const gemini: OcrProvider = {
  name: "gemini",
  async extract(image, docType) {
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const prompt =
      `You read Israeli documents (Hebrew). Document type: ${docType}. Return JSON only: ` +
      `{${FIELDS[docType].map((f) => `"${f}":{"value":string,"confidence":0..1}`).join(",")}}. ` +
      `Dates as YYYY-MM-DD, amounts as plain numbers in shekels, plate digits only. Use confidence < 0.7 when unsure; empty string when absent.`;
    const body = {
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: image.mime, data: Buffer.from(image.bytes).toString("base64") } }] }],
      generationConfig: { response_mime_type: "application/json", temperature: 0 },
    };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const raw = await r.json();
    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text) as Record<string, { value: string; confidence: number }>;
    const fields = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v?.value).map(([k, v]) => [k, { value: String(v.value), confidence: Number(v.confidence) || 0 }]));
    return { provider: "gemini", fields, raw };
  },
};
