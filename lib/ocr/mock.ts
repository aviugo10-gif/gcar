import type { OcrProvider, OcrResult } from "./index";
// Returns plausible fields with mixed confidence, so the review screen (orange = unsure) can be built and tested.
export const mock: OcrProvider = {
  name: "mock",
  async extract(_image, docType): Promise<OcrResult> {
    if (docType === "vehicle_license")
      return {
        provider: "mock",
        raw: { mock: true },
        fields: {
          plate: { value: "61234501", confidence: 0.98 }, make: { value: "סוזוקי", confidence: 0.95 }, model: { value: "סוויפט", confidence: 0.9 },
          year: { value: "2020", confidence: 0.93 }, color: { value: "כסף", confidence: 0.6 }, test_valid_until: { value: "2027-03-14", confidence: 0.72 },
        },
      };
    if (docType === "receipt") return { provider: "mock", raw: { mock: true }, fields: { supplier: { value: "מוסך אבי", confidence: 0.8 }, date: { value: new Date().toISOString().slice(0, 10), confidence: 0.9 }, total: { value: "1450", confidence: 0.85 } } };
    return { provider: "mock", raw: { mock: true }, fields: {} };
  },
};
