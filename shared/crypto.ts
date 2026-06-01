// Skill-body encryption (AES-256-GCM). The CLI encrypts a body before pinning;
// the key-service holds the per-skill content key and releases it only to
// addresses that have paid on-chain; the consumer (FE/CLI) decrypts.
//
// Envelope is interoperable with WebCrypto: `data` = ciphertext || 16-byte tag,
// 12-byte IV — so frontend/lib/crypto.ts can decrypt what this produces.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const ENC_MARKER = "ATRIUM-ENCRYPTED-V1:";

export interface Envelope {
  v: 1;
  alg: "A256GCM";
  iv: string; // base64
  data: string; // base64(ciphertext || authTag)
}

/** 32-byte AES-256 content key. */
export function newContentKey(): Buffer {
  return randomBytes(32);
}

export function encryptBody(plaintext: string, key: Buffer): Envelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v: 1, alg: "A256GCM", iv: iv.toString("base64"), data: Buffer.concat([ct, tag]).toString("base64") };
}

export function decryptBody(env: Envelope, key: Buffer): string {
  const iv = Buffer.from(env.iv, "base64");
  const buf = Buffer.from(env.data, "base64");
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(0, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Render an encrypted body for skill.md: a human-readable notice + the marker. */
export function wrapEncryptedBody(env: Envelope): string {
  const b64 = Buffer.from(JSON.stringify(env), "utf8").toString("base64");
  return (
    "> 🔒 This skill body is encrypted. Invoke it on Atrium to obtain the per-invocation " +
    "decryption key.\n\n" +
    ENC_MARKER +
    b64
  );
}

/** Pull the envelope back out of an encrypted body (CLI side). */
export function extractEnvelope(body: string): Envelope | null {
  const i = body.indexOf(ENC_MARKER);
  if (i < 0) return null;
  const b64 = body.slice(i + ENC_MARKER.length).trim().split(/\s/)[0];
  try {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as Envelope;
  } catch {
    return null;
  }
}

export function isEncrypted(body: string): boolean {
  return body.includes(ENC_MARKER);
}
