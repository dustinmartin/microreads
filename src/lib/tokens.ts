import { createHmac } from "crypto";

const TOKEN_EXPIRY_DAYS = 7;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return secret;
}

function base64urlEncode(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(data: string): string {
  // Restore standard base64 characters
  let base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

function sign(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  return base64urlEncode(hmac.digest("base64"));
}

/**
 * Generate an HMAC-SHA256 signed token encoding the chunkId and an expiry timestamp.
 * Format: `${base64url(payload)}.${base64url(signature)}`
 */
export function generateChunkToken(chunkId: string): string {
  const secret = getSecret();
  const exp = Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ chunkId, exp });
  const encodedPayload = base64urlEncode(payload);
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify a chunk token: checks HMAC signature, chunkId match, and expiry.
 * Returns false on any failure.
 */
export function verifyChunkToken(token: string, chunkId: string): boolean {
  try {
    const secret = getSecret();
    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const [encodedPayload, signature] = parts;

    // Verify signature
    const expectedSignature = sign(encodedPayload, secret);
    if (signature !== expectedSignature) return false;

    // Decode and parse payload
    const payload = JSON.parse(base64urlDecode(encodedPayload));

    // Check chunkId matches
    if (payload.chunkId !== chunkId) return false;

    // Check expiry
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}
