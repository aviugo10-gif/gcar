import { test } from "node:test";
import assert from "node:assert/strict";
import { createVault, unlockVault, unlockWithRecovery, changePassword, seal, open, pad, unpad, type KdfParams } from "../lib/vault.ts";

// Light KDF for tests only; production uses DEFAULT_KDF (64 MiB).
const FAST: KdfParams = { alg: "argon2id", m: 1024, t: 1, p: 1 };

test("round trip: create, seal, unlock with password, open", async () => {
  const { record, key } = await createVault("correct horse battery", FAST);
  const token = await seal(key, "purchase_price", 6850000);
  const key2 = await unlockVault("correct horse battery", record);
  assert.equal(await open(key2, "purchase_price", token), 6850000);
});

test("wrong password is rejected", async () => {
  const { record } = await createVault("correct horse battery", FAST);
  await assert.rejects(unlockVault("wrong password!!", record), /wrong-password/);
});

test("recovery code unlocks and can set a new password", async () => {
  const { record, recoveryCode, key } = await createVault("correct horse battery", FAST);
  const token = await seal(key, "min_price", 7900000);
  const viaCode = await unlockWithRecovery(recoveryCode.toLowerCase().replace(/-/g, " "), record);
  assert.equal(await open(viaCode, "min_price", token), 7900000);
  const r2 = await changePassword(record, recoveryCode, "a brand new password");
  const k3 = await unlockVault("a brand new password", r2);
  assert.equal(await open(k3, "min_price", token), 7900000);
  await assert.rejects(unlockVault("correct horse battery", r2));
});

test("ciphertext length does not depend on the amount", async () => {
  const { key } = await createVault("correct horse battery", FAST);
  const a = await seal(key, "purchase_price", 1);
  const b = await seal(key, "purchase_price", 999999999);
  assert.equal(a.length, b.length);
  assert.notEqual(await seal(key, "purchase_price", 1), a, "random IV: same value, different ciphertext");
});

test("a ciphertext moved to another field fails", async () => {
  const { key } = await createVault("correct horse battery", FAST);
  const t = await seal(key, "min_price", 100);
  await assert.rejects(open(key, "purchase_price", t));
});

test("padding round trip and bounds", () => {
  const d = new TextEncoder().encode("hello");
  const p = pad(d);
  assert.equal(p.length, 64);
  assert.deepEqual(unpad(p), d);
  assert.throws(() => pad(new Uint8Array(20000)));
});
