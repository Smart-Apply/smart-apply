/**
 * Color derivation helpers for templates whose variants are driven by a
 * single `accentColor` hex stored in the DB (e.g. Elegant Sidebar).
 *
 * Mirrors the design tokens from the source CSS variants:
 *   --bg-sidebar    ≈ accent mixed with white at ~92% white  (8% accent)
 *   --bg-secondary  ≈ accent mixed with white at ~85% white  (15% accent)
 *   --text-accent   ≈ accent mixed with black at ~30% black  (70% accent)
 *
 * These ratios were reverse-engineered from
 * apps/api/src/pdf/templates/elegant-sidebar/config.json so the react-pdf
 * variants match the puppeteer ones within ΔE perceptual tolerance.
 */

const HEX_RE = /^#?([0-9a-f]{6})$/i;

function parseHex(hex: string): { r: number; g: number; b: number } {
  const m = HEX_RE.exec(hex.trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  const v = m[1];
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mix `color` with white at the given ratio. ratio=1 → pure white, 0 → unchanged. */
function tint(hex: string, ratio: number): string {
  const { r, g, b } = parseHex(hex);
  return toHex({
    r: r + (255 - r) * ratio,
    g: g + (255 - g) * ratio,
    b: b + (255 - b) * ratio,
  });
}

/** Mix `color` with black at the given ratio. ratio=1 → pure black, 0 → unchanged. */
function shade(hex: string, ratio: number): string {
  const { r, g, b } = parseHex(hex);
  return toHex({
    r: r * (1 - ratio),
    g: g * (1 - ratio),
    b: b * (1 - ratio),
  });
}

export interface ElegantSidebarPalette {
  accent: string;
  headerBg: string;
  bgSidebar: string;
  bgSecondary: string;
  textAccent: string;
  textOnHeader: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  bgPrimary: string;
}

export function deriveElegantSidebarPalette(
  accentColor: string | undefined,
): ElegantSidebarPalette {
  const accent = accentColor && HEX_RE.test(accentColor) ? accentColor : '#9c7a5b';
  return {
    accent,
    headerBg: accent,
    bgSidebar: tint(accent, 0.92),
    bgSecondary: tint(accent, 0.85),
    textAccent: shade(accent, 0.3),
    textOnHeader: '#ffffff',
    textPrimary: '#3d3d3d',
    textSecondary: '#6b6b6b',
    textMuted: '#8a8a8a',
    bgPrimary: '#ffffff',
  };
}
