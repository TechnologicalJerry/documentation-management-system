import {
  format,
  addDays as fnsAddDays,
  addHours,
  addMinutes,
  addMonths,
  isAfter,
  isBefore,
  differenceInSeconds,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  parseISO,
  isValid,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

/**
 * Format a date to a given format string
 * Default: 'yyyy-MM-dd HH:mm:ss'
 */
export function formatDate(date: Date | string, formatStr: string = 'yyyy-MM-dd HH:mm:ss'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) throw new Error(`Invalid date: ${date}`);
  return format(d, formatStr);
}

/**
 * Format a date to ISO 8601 string
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Add days to a date and return new Date
 */
export function addDays(date: Date, days: number): Date {
  return fnsAddDays(date, days);
}

/**
 * Add hours to a date
 */
export { addHours, addMinutes, addMonths };

/**
 * Check if a date is expired (i.e., in the past)
 */
export function isExpired(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isBefore(d, new Date());
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isAfter(d, new Date());
}

/**
 * Get expiry date from now + seconds
 */
export function getExpiryDate(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

/**
 * Get expiry date from now + minutes
 */
export function getExpiryDateFromMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Calculate difference in seconds between two dates
 */
export function secondsBetween(start: Date, end: Date): number {
  return Math.abs(differenceInSeconds(end, start));
}

/**
 * Calculate difference in minutes
 */
export function minutesBetween(start: Date, end: Date): number {
  return Math.abs(differenceInMinutes(end, start));
}

/**
 * Calculate difference in hours
 */
export function hoursBetween(start: Date, end: Date): number {
  return Math.abs(differenceInHours(end, start));
}

/**
 * Calculate difference in days
 */
export function daysBetween(start: Date, end: Date): number {
  return Math.abs(differenceInDays(end, start));
}

/**
 * Parse ISO string to Date safely
 */
export function parseDate(isoString: string): Date | null {
  const d = parseISO(isoString);
  return isValid(d) ? d : null;
}

/**
 * Check if a value is a valid date
 */
export function isValidDate(date: unknown): date is Date {
  return date instanceof Date && isValid(date);
}

/**
 * Get start and end of a day
 */
export function getDayRange(date: Date): { start: Date; end: Date } {
  return { start: startOfDay(date), end: endOfDay(date) };
}

/**
 * Get start and end of a month
 */
export function getMonthRange(date: Date): { start: Date; end: Date } {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}
