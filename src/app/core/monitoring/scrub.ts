const REDACTED = '[redacted]';

const PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
];

/** Strips the query string (it may carry filters, emails or tokens). */
export function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, '');
}

/**
 * Removes tokens and personal data from free text before it leaves the browser:
 * bearer tokens, JWTs, email addresses and URL query strings.
 */
export function scrub(text: string): string {
  let out = text.replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/g, `$1${REDACTED}`);
  for (const pattern of PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}
