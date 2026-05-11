import { ClassicAtsFactory } from './templates/classic-ats';
import type { RegisteredReactPdfTemplate } from './types';

/**
 * Registry of base designs that have a react-pdf TSX implementation.
 *
 * `key` is matched against a DB Template row using this priority:
 *   1. Template.baseTemplateId (slug, when set on color/language variants)
 *   2. Template.id (the row's own cuid; only matches if the registry entry
 *      was added with the explicit DB id)
 *   3. Template.name kebab-cased (color suffix stripped) — e.g. "Classic ATS"
 *      → "classic-ats", "Elegant Sidebar (Original Brown)" → "elegant-sidebar"
 *   4. Template.category kebab-cased (fallback heuristic)
 *
 * Templates not present here transparently fall back to the legacy puppeteer
 * renderer per-call. This is what makes Phase 1 incrementally rolloutable.
 */
const REGISTRY: RegisteredReactPdfTemplate[] = [
  { key: 'classic-ats', factory: ClassicAtsFactory },
];

const REGISTRY_BY_KEY = new Map(REGISTRY.map((t) => [t.key, t]));

export interface ResolveInput {
  baseTemplateId?: string | null;
  templateId?: string | null;
  /** Template display name, e.g. "Classic ATS" — matched as kebab-case slug. */
  name?: string | null;
  category?: string | null;
}

function slug(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, '') // strip "(Original Brown)" color suffix
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveReactPdfTemplate(
  input: ResolveInput,
): RegisteredReactPdfTemplate | undefined {
  const candidates = [
    input.baseTemplateId,
    input.templateId,
    slug(input.name),
    slug(input.category),
  ].filter((v): v is string => Boolean(v));

  for (const key of candidates) {
    const hit = REGISTRY_BY_KEY.get(key);
    if (hit) return hit;
  }
  return undefined;
}

export function listRegisteredKeys(): string[] {
  return Array.from(REGISTRY_BY_KEY.keys());
}
