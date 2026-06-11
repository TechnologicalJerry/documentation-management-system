import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 12;

/**
 * Hash a plain text password using bcrypt
 */
export async function hash(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * Compare a plain text string against a hash
 */
export async function compare(plainText: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plainText, hashed);
}

/**
 * Generate a cryptographically secure random token
 */
export function generateToken(bytes: number = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generate a URL-safe random token (base64url)
 */
export function generateUrlSafeToken(bytes: number = 32): string {
  return randomBytes(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate a numeric OTP of specified length
 */
export function generateOTP(length: number = 6): string {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  const range = max - min;
  const randomValue = parseInt(randomBytes(4).toString('hex'), 16);
  return String(min + (randomValue % range)).padStart(length, '0');
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Create an SHA-256 hash of a string
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Create an MD5 hash (for non-security purposes like ETags)
 */
export function md5(data: string): string {
  return createHash('md5').update(data).digest('hex');
}

/**
 * Generate a short unique ID (for slugs, short IDs, etc.)
 */
export function generateShortId(length: number = 8): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Use XOR comparison
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i]! ^ bufB[i]!;
  }
  return result === 0;
}
