import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidIsraeliId, isValidPhone, toWhatsApp, marginVat } from "../lib/il.ts";
import { scrapPromise, type Hours } from "../lib/promise.ts";
import { money, plate, phone } from "../lib/format.ts";

test("Israeli ID check digit", () => {
  assert.equal(isValidIsraeliId("000000018"), true);
  assert.equal(isValidIsraeliId("123456782"), true);
  assert.equal(isValidIsraeliId("123456789"), false);
  assert.equal(isValidIsraeliId(""), false);
});
test("phones", () => {
  assert.equal(isValidPhone("052-852-8282"), true);
  assert.equal(isValidPhone("+972 52 852 8282"), true);
  assert.equal(isValidPhone("12345"), false);
  assert.equal(toWhatsApp("0528528282"), "972528528282");
});
test("margin VAT 18% is included in the margin; a loss pays none", () => {
  assert.deepEqual(marginVat(8490000, 6850000), { margin: 1640000, vat: 250169, net: 1389831 });
  assert.deepEqual(marginVat(5000000, 6000000), { margin: -1000000, vat: 0, net: -1000000 });
});
test("formatting", () => {
  assert.equal(money(8490000), "₪ 84,900");
  assert.equal(plate("12345678"), "123-45-678");
  assert.equal(plate("1234567"), "12-345-67");
  assert.equal(phone("0528528282"), "052-852-8282");
});
const H: Hours = { sun: ["09:00", "19:00"], mon: ["09:00", "19:00"], tue: ["09:00", "19:00"], wed: ["09:00", "19:00"], thu: ["09:00", "19:00"], fri: ["09:00", "13:00"], sat: null };
test("scrap promise follows Israel time", () => {
  // Tue 2026-11-17 12:00 Israel (UTC+2) -> minutes
  assert.equal(scrapPromise(new Date("2026-11-17T10:00:00Z"), H).kind, "minutes");
  // Fri 2026-11-20 10:00 Israel, open but Friday -> later, Sunday 09:00
  const fri = scrapPromise(new Date("2026-11-20T08:00:00Z"), H);
  assert.equal(fri.kind, "later");
  assert.match(fri.text, /ביום ראשון מ־09:00/);
  // Tue 22:00 -> tomorrow 09:00
  assert.match(scrapPromise(new Date("2026-11-17T20:00:00Z"), H).text, /מחר מ־09:00/);
  // Tue 07:00 -> today 09:00
  assert.match(scrapPromise(new Date("2026-11-17T05:00:00Z"), H).text, /היום מ־09:00/);
  // holiday on Wed -> Tue night points to Thu
  assert.match(scrapPromise(new Date("2026-11-17T20:00:00Z"), H, ["2026-11-18"]).text, /ביום חמישי/);
});
