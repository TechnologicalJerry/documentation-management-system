/**
 * Convert a string to a URL-safe slug.
 * Handles Unicode by normalising to ASCII where possible.
 */
export default function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .replace(/[^a-z0-9\s-]/g, '')    // keep only alphanumerics, spaces, hyphens
    .trim()
    .replace(/[\s]+/g, '-')          // spaces → hyphens
    .replace(/-+/g, '-')             // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '');        // strip leading/trailing hyphens
}
