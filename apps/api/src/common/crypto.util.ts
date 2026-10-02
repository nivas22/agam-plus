import * as crypto from 'crypto';

// A hospital's own WhatsApp access token lets anyone holding it send messages
// as that hospital, so it is encrypted before it touches the database.
// Format is `iv:authTag:ciphertext`, all hex.

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function toKey(rawKey: string): Buffer {
  if (!rawKey) {
    throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY is not configured');
  }
  // Accept either a 64-char hex key or an arbitrary passphrase.
  if (/^[0-9a-f]{64}$/i.test(rawKey)) return Buffer.from(rawKey, 'hex');
  return crypto.createHash('sha256').update(rawKey).digest();
}

export function encrypt(plain: string, rawKey: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, toKey(rawKey), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  return [
    iv.toString('hex'),
    cipher.getAuthTag().toString('hex'),
    ciphertext.toString('hex'),
  ].join(':');
}

export function decrypt(payload: string, rawKey: string): string {
  const [ivHex, authTagHex, ciphertextHex] = (payload || '').split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Malformed encrypted payload');
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    toKey(rawKey),
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
