/**
 * Escapes a value for safe interpolation into an HTML string.
 * Use it for any user-entered text (client, product or court names) that ends
 * up in `innerHTML` or a SweetAlert `html` option.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
