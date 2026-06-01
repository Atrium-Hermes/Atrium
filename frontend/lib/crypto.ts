// Browser-side skill-body decryption (WebCrypto, AES-256-GCM). Decrypts the
// envelope produced by shared/crypto.ts after the key-service releases the key.

export const ENC_MARKER = "ATRIUM-ENCRYPTED-V1:";

export interface Envelope {
  v: 1;
  alg: "A256GCM";
  iv: string;
  data: string;
}

export function isEncrypted(body: string | null | undefined): boolean {
  return !!body && body.includes(ENC_MARKER);
}

export function extractEnvelope(body: string): Envelope | null {
  const i = body.indexOf(ENC_MARKER);
  if (i < 0) return null;
  const b64 = body.slice(i + ENC_MARKER.length).trim().split(/\s/)[0];
  try {
    return JSON.parse(atobToStr(b64)) as Envelope;
  } catch {
    return null;
  }
}

/** Decrypt a body envelope with a hex content key (from the key-service). */
export async function decryptBody(env: Envelope, keyHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", hexToBytes(keyHex) as BufferSource, { name: "AES-GCM" }, false, [
    "decrypt",
  ]);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(env.iv) as BufferSource },
    key,
    b64ToBytes(env.data) as BufferSource
  );
  return new TextDecoder().decode(pt);
}

function atobToStr(b64: string): string {
  return decodeURIComponent(
    atob(b64)
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
