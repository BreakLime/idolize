// TIDAL OLD_AES stream decryption, ported 1:1 from lumitide (src/api.rs: decrypt_security_token, e2e_stream_decrypt).
//
// keyId (base64) = iv[16] || AES-256-CBC(masterKey, iv, key[16] || nonce[8] || padding)
// stream        = AES-128-CTR(key, counter = nonce[8] || blockIndex[8] big-endian, starting at 0)
//
// lumitide uses Ctr64BE (only the low 64 bits count). Node's aes-128-ctr carries into the full
// 128 bits, which is identical as long as the block index never overflows 64 bits — always true here.
import { createDecipheriv, type Decipheriv } from 'node:crypto';

// Publicly known master key used by TIDAL clients to wrap per-track keys (same as lumitide/python-tidal).
const MASTER_KEY = Buffer.from('UIlTTEMmmLfGowo/UC60x2H45W6MdGgTRfo/umg4754=', 'base64');

export interface TrackKey {
  key: Buffer; // 16 bytes
  nonce: Buffer; // 8 bytes
}

export function unwrapSecurityToken(keyId: string): TrackKey {
  const token = Buffer.from(keyId, 'base64');
  if (token.length < 32) throw new Error(`Security token too short (${token.length} bytes)`);
  const iv = token.subarray(0, 16);
  let body = token.subarray(16);
  const rem = body.length % 16;
  if (rem !== 0) body = Buffer.concat([body, Buffer.alloc(16 - rem)]);
  const cbc = createDecipheriv('aes-256-cbc', MASTER_KEY, iv);
  cbc.setAutoPadding(false);
  const plain = Buffer.concat([cbc.update(body), cbc.final()]);
  return { key: plain.subarray(0, 16), nonce: plain.subarray(16, 24) };
}

/** A CTR decipher positioned at an arbitrary byte offset of the encrypted stream (enables HTTP Range / seeking). */
export function ctrDecipherAt({ key, nonce }: TrackKey, offset = 0): Decipheriv {
  const iv = Buffer.alloc(16);
  nonce.copy(iv, 0);
  iv.writeBigUInt64BE(BigInt(Math.floor(offset / 16)), 8);
  const d = createDecipheriv('aes-128-ctr', key, iv);
  const skip = offset % 16;
  if (skip) d.update(Buffer.alloc(skip));
  return d;
}

export function decryptAll(trackKey: TrackKey, data: Buffer): Buffer {
  const d = ctrDecipherAt(trackKey, 0);
  return Buffer.concat([d.update(data), d.final()]);
}
