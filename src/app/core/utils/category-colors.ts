/** Color palette assigned to each product category, keyed by keyword regex. */
const CATEGORY_COLOR_MAP: { pattern: RegExp; bg: string; text: string }[] = [
  {
    pattern: /bebida|agua|gatorade|jugo|isotónico|isotonico|refresco|energizante|soda/,
    bg: 'bg-sky-100', text: 'text-sky-700',
  },
  {
    pattern: /comida|sandwich|sándwich|snack|lunch|alimento|food/,
    bg: 'bg-amber-100', text: 'text-amber-700',
  },
  {
    pattern: /paleta|raqueta|alquiler|pelota|deporte|sport|equipo/,
    bg: 'bg-emerald-100', text: 'text-emerald-700',
  },
  {
    pattern: /ropa|indumentaria|remera|camiseta|short|calzado|apparel/,
    bg: 'bg-violet-100', text: 'text-violet-700',
  },
];

const DEFAULT_COLOR = { bg: 'bg-slate-100', text: 'text-slate-600' };

/**
 * Returns the Tailwind bg + text classes for a product category badge.
 * Falls back to slate if the category name doesn't match any known pattern.
 */
export function getCategoryColor(categoryName: string): { bg: string; text: string } {
  if (!categoryName) return DEFAULT_COLOR;
  const n = categoryName.toLowerCase();
  return CATEGORY_COLOR_MAP.find((entry) => entry.pattern.test(n)) ?? DEFAULT_COLOR;
}
