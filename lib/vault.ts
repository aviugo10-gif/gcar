/**
 * Zero-knowledge vault for purchase price, minimum price and all finance data.
 *
 * - A random 256-bit data key (DEK) encrypts values with AES-GCM in the browser.
 * - The DEK is stored only wrapped: by a key derived from the vault password (Argon2id), and by a key derived from a
 *   one-time recovery code that is printed at setup. The server never sees the password, the code or the DEK.
 * - Plaintext is padded to a fixed length before encryption, so ciphertext length says nothing about the amount.
 * - After unlock the DEK lives only as a non-extractable CryptoKey in memory and is dropped on lock.
 *
 * Runs in the browser and in Node 20+ (tests): both have WebCrypto as globalThis.crypto.
 */
import { argon2id } from "hash-wasm";

export type KdfParams = { alg: "argon2id"; m: number; t: number; p: number };
export type VaultRecord = {
  wrapped_dek: string;
  kdf_salt: string;
  kdf_params: KdfParams;
  recovery_wrapped_dek: string;
  check_value: string;
  prf_wrapped_dek?: string | null;
};

export const DEFAULT_KDF: KdfParams = { alg: "argon2id", m: 65536, t: 3, p: 1 }; // 64 MiB, ~0.5–1s on a phone
const VERSION = "v1";
const CHECK = "gcar-vault-ok";
const subtle = () => globalThis.crypto.subtle;
const bs = (u: Uint8Array) => u as unknown as BufferSource;

// ---------- encoding ----------
export function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const enc = new TextEncoder();
const dec = new TextDecoder();
const rand = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

// ---------- padding: [len:2 bytes][data][random fill] to a fixed bucket ----------
const BUCKETS = [64, 256, 1024, 4096, 16384];
export function pad(data: Uint8Array): Uint8Array {
  const need = data.length + 2;
  const size = BUCKETS.find((b) => b >= need);
  if (!size) throw new Error("value too large to encrypt");
  const out = rand(size);
  out[0] = data.length >> 8;
  out[1] = data.length & 0xff;
  out.set(data, 2);
  return out;
}
export function unpad(buf: Uint8Array): Uint8Array {
  const len = (buf[0] << 8) | buf[1];
  if (len > buf.length - 2) throw new Error("corrupt value");
  return buf.slice(2, 2 + len);
}

// ---------- keys ----------
async function deriveKek(secret: string, salt: Uint8Array, p: KdfParams): Promise<CryptoKey> {
  const raw = await argon2id({
    password: secret.normalize("NFKC"),
    salt,
    parallelism: p.p,
    iterations: p.t,
    memorySize: p.m,
    hashLength: 32,
    outputType: "binary",
  });
  return subtle().importKey("raw", bs(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function gcmEncrypt(key: CryptoKey, plain: Uint8Array, aad?: string): Promise<string> {
  const iv = rand(12);
  const ct = new Uint8Array(
    await subtle().encrypt({ name: "AES-GCM", iv: bs(iv), additionalData: aad ? enc.encode(aad) : undefined }, key, bs(plain)),
  );
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return `${VERSION}.${b64(out)}`;
}
async function gcmDecrypt(key: CryptoKey, token: string, aad?: string): Promise<Uint8Array> {
  const [v, body] = token.split(".");
  if (v !== VERSION || !body) throw new Error("unknown ciphertext version");
  const buf = unb64(body);
  return new Uint8Array(
    await subtle().decrypt(
      { name: "AES-GCM", iv: bs(buf.slice(0, 12)), additionalData: aad ? enc.encode(aad) : undefined },
      key,
      bs(buf.slice(12)),
    ),
  );
}
const importDek = (raw: Uint8Array) => subtle().importKey("raw", bs(raw), "AES-GCM", false, ["encrypt", "decrypt"]);

/** Recovery code: 24 chars from an unambiguous alphabet, shown as 6 groups of 4. ~120 bits. */
export function newRecoveryCode(): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = rand(24);
  let s = "";
  for (let i = 0; i < 24; i++) s += A[r[i] % 32] + (i % 4 === 3 && i < 23 ? "-" : "");
  return s;
}
const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

// ---------- public API ----------
export async function createVault(password: string, kdf: KdfParams = DEFAULT_KDF): Promise<{ record: VaultRecord; recoveryCode: string; key: CryptoKey }> {
  if (password.length < 10) throw new Error("vault password must be at least 10 characters");
  const dek = rand(32);
  const salt = rand(16);
  const recoveryCode = newRecoveryCode();
  const kek = await deriveKek(password, salt, kdf);
  const rkek = await deriveKek(normCode(recoveryCode), salt, kdf);
  const key = await importDek(dek);
  const record: VaultRecord = {
    wrapped_dek: await gcmEncrypt(kek, dek, "dek"),
    recovery_wrapped_dek: await gcmEncrypt(rkek, dek, "dek"),
    kdf_salt: b64(salt),
    kdf_params: kdf,
    check_value: await gcmEncrypt(key, pad(enc.encode(CHECK)), "check"),
  };
  dek.fill(0);
  return { record, recoveryCode, key };
}

async function openWith(kek: CryptoKey, wrapped: string, record: VaultRecord): Promise<CryptoKey> {
  let dek: Uint8Array;
  try {
    dek = await gcmDecrypt(kek, wrapped, "dek");
  } catch {
    throw new VaultError("wrong-password");
  }
  const key = await importDek(dek);
  dek.fill(0);
  const check = dec.decode(unpad(await gcmDecrypt(key, record.check_value, "check")));
  if (check !== CHECK) throw new VaultError("wrong-password");
  return key;
}

export class VaultError extends Error {
  code: "wrong-password" | "locked";
  constructor(code: "wrong-password" | "locked") {
    super(code);
    this.code = code;
  }
}

export async function unlockVault(password: string, record: VaultRecord): Promise<CryptoKey> {
  const kek = await deriveKek(password, unb64(record.kdf_salt), record.kdf_params);
  return openWith(kek, record.wrapped_dek, record);
}

export async function unlockWithRecovery(code: string, record: VaultRecord): Promise<CryptoKey> {
  const kek = await deriveKek(normCode(code), unb64(record.kdf_salt), record.kdf_params);
  return openWith(kek, record.recovery_wrapped_dek, record);
}

/** Re-wrap the same DEK under a new password (data stays as is). Needs the raw DEK, so it goes through the recovery path. */
export async function changePassword(record: VaultRecord, recoveryCode: string, newPassword: string): Promise<VaultRecord> {
  const kek = await deriveKek(normCode(recoveryCode), unb64(record.kdf_salt), record.kdf_params);
  let dek: Uint8Array;
  try {
    dek = await gcmDecrypt(kek, record.recovery_wrapped_dek, "dek");
  } catch {
    throw new VaultError("wrong-password");
  }
  const newKek = await deriveKek(newPassword, unb64(record.kdf_salt), record.kdf_params);
  const wrapped = await gcmEncrypt(newKek, dek, "dek");
  dek.fill(0);
  return { ...record, wrapped_dek: wrapped };
}

/**
 * Encrypt any JSON value. `field` is bound as associated data, so a ciphertext copied from one column to another
 * (say, min price into purchase price) fails to decrypt instead of silently showing the wrong number.
 */
export async function seal(key: CryptoKey, field: string, value: unknown): Promise<string> {
  return gcmEncrypt(key, pad(enc.encode(JSON.stringify(value))), field);
}
export async function open<T = unknown>(key: CryptoKey, field: string, token: string): Promise<T> {
  return JSON.parse(dec.decode(unpad(await gcmDecrypt(key, token, field)))) as T;
}
