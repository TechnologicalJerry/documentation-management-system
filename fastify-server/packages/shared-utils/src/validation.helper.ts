import { validate as uuidValidate, version as uuidVersion } from 'uuid';

// RFC 5322 compliant email regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/; // E.164 format

/**
 * Check if a string is a valid email address
 */
export function isEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Check if a password meets strength requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
export function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return false;
  return true;
}

export interface PasswordStrengthResult {
  isStrong: boolean;
  score: number; // 0-4
  issues: string[];
}

/**
 * Evaluate password strength and return detailed feedback
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const issues: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else issues.push('Password must be at least 8 characters long');

  if (password.length >= 12) score++;

  if (/[A-Z]/.test(password)) score++;
  else issues.push('Password must contain at least one uppercase letter');

  if (/[a-z]/.test(password)) score++;
  else issues.push('Password must contain at least one lowercase letter');

  if (/[0-9]/.test(password)) score++;
  else issues.push('Password must contain at least one number');

  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score++;
  else issues.push('Password must contain at least one special character');

  return {
    isStrong: issues.length === 0,
    score: Math.min(4, Math.floor(score / 1.5)),
    issues,
  };
}

/**
 * Check if a string is a valid UUID (v4 by default)
 */
export function isUUID(value: string, uuidVersionNum: 1 | 3 | 4 | 5 = 4): boolean {
  return uuidValidate(value) && uuidVersion(value) === uuidVersionNum;
}

/**
 * Check if a string is a valid URL
 */
export function isURL(value: string): boolean {
  return URL_REGEX.test(value);
}

/**
 * Check if a string is a valid URL slug
 */
export function isSlug(value: string): boolean {
  return SLUG_REGEX.test(value);
}

/**
 * Check if a string is a valid E.164 phone number
 */
export function isPhoneNumber(value: string): boolean {
  return PHONE_REGEX.test(value);
}

/**
 * Sanitize a string to a URL-safe slug
 */
export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if a value is a positive integer
 */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Validate and sanitize an email address
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Check if a string has minimum and maximum length
 */
export function hasLength(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}
