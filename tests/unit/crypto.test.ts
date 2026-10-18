import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ctrDecipherAt, decryptAll, unwrapSecurityToken } from '../../src/main/tidal/crypto';

// Known-answer vector: kat.lumitide.bin was produced by lumitide's own Rust code
// (decrypt_security_token + Ctr64BE over 64 KiB chunks) from kat.keyid and the plaintext pattern below.
const keyId = readFileSync(new URL('../fixtures/kat.keyid', import.meta.url), 'utf8');
const cipher = readFileSync(new URL('../fixtures/kat.lumitide.bin', import.meta.url));
const plain = Buffer.alloc(70001);
for (let i = 0; i < plain.length; i++) plain[i] = (i * 7 + (i >> 8)) & 255;

describe('OLD_AES crypto (lumitide parity)', () => {
  it('unwraps the security token into a 16-byte key and 8-byte nonce', () => {
    const k = unwrapSecurityToken(keyId);
    expect(k.key).toHaveLength(16);
    expect(k.nonce).toHaveLength(8);
  });

  it('decrypts byte-identically to lumitide', () => {
    expect(decryptAll(unwrapSecurityToken(keyId), cipher).equals(plain)).toBe(true);
  });

  it('decrypts correctly from any offset (seeking)', () => {
    const k = unwrapSecurityToken(keyId);
    for (const off of [0, 1, 15, 16, 17, 4095, 65536, 65537, 70000]) {
      const d = ctrDecipherAt(k, off);
      const part = Buffer.concat([d.update(cipher.subarray(off, off + 777)), d.final()]);
      expect(part.equals(plain.subarray(off, off + 777)), `offset ${off}`).toBe(true);
    }
  });

  it('rejects short tokens', () => {
    expect(() => unwrapSecurityToken(Buffer.alloc(20).toString('base64'))).toThrow(/too short/);
  });
});
