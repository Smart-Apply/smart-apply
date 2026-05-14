---
name: pdf-react-pdf-template
description: 'Recipe for adding a new PDF template (resume + cover letter) to Smart Apply using `@react-pdf/renderer`. Covers the factory pattern, ESM-only loader, color-variant derivation, i18n labels, registry wiring, and validation.'
---

# Add a New PDF Template (`@react-pdf/renderer`)

This skill describes the canonical workflow for porting a Handlebars template from `apps/api/src/pdf/templates/<slug>/` into a TSX react-pdf factory under `apps/api/src/pdf-v2/templates/<slug>.tsx`, or for authoring a brand-new design from scratch.

The legacy Puppeteer + Handlebars renderer at [`apps/api/src/pdf/`](../../apps/api/src/pdf/) still ships and is the fallback for any design not yet registered. The new renderer at [`apps/api/src/pdf-v2/`](../../apps/api/src/pdf-v2/) is the **default target**; new templates should be authored here.

---

## When to use this skill

Use this when the user asks to:

- "Add a new PDF template" / "create a resume design" / "port the X template to react-pdf"
- "Add a new color variant" to an existing react-pdf template
- "Switch the default renderer for template X to react-pdf"

Do **not** use this for:

- Pure styling tweaks to an already-ported design (just edit the `.tsx` file directly)
- New Handlebars (`.hbs`) templates — use [`PDF-Template-Agent`](../agents/pdf-template-agent.md) for the legacy pipeline
- Adding fonts (font registration is its own follow-up; defer for now and use Helvetica/Times-Roman)

---

## Mental model: the contract

A "template" in pdf-v2 is a **factory** that takes the lazily-loaded `@react-pdf/renderer` namespace and returns React components for the resume and/or cover letter. Components are pure functions of `{ data, meta }`:

```ts
// apps/api/src/pdf-v2/types.ts
interface ReactPdfTemplateFactory {
  resume?:      (rp: ReactPdfNamespace) => (props: ReactPdfResumeProps)      => ReactElement;
  coverLetter?: (rp: ReactPdfNamespace) => (props: ReactPdfCoverLetterProps) => ReactElement;
}

interface ReactPdfTemplateMeta {
  language: string;            // 'en' | 'de' | 'fr' | 'es' | 'it'
  accentColor?: string;        // hex from DB Template.accentColor
  colorVariantName?: string;   // 'Original Brown', 'Ocean Blue', ...
  atsOptimized?: boolean;
}
```

`data` is `ResumeTemplateData` / `CoverLetterTemplateData` from [`apps/api/src/pdf/template-renderer.service.ts`](../../apps/api/src/pdf/template-renderer.service.ts) — the **same** shape both renderers consume. Do not invent new fields here.

The DB stores **only** `accentColor` per variant. Multi-tone palettes (sidebar bg, secondary bg, accent text) are **derived at render time** from that single hex via `tint()` / `shade()` helpers in [`color-utils.ts`](../../apps/api/src/pdf-v2/color-utils.ts). One factory entry handles all color variants of a base design.

---

## Hard constraints (read before writing code)

1. **Never `import` `@react-pdf/renderer` statically.** The api package is CommonJS; the package is ESM-only. Use the `rp: ReactPdfNamespace` argument passed to the factory and call `createElement` from `react`. Static imports compile to `require()` and crash with `ERR_REQUIRE_ESM` at runtime.

2. **No JSX in template files** (in practice — the package doesn't ship CJS-friendly JSX runtimes for the namespace types). Build trees with `createElement(rp.View, { style }, children)`. Mirror the existing templates verbatim.

3. **Unit conversion is fixed.** The CSS source uses pixels at Chromium's 96 DPI print default. PDF coordinate space is points (72 per inch):
   ```ts
   const px   = (n: number) => n * 0.75; // CSS px → PDF pt
   const inch = (n: number) => n * 72;   // inches → PDF pt
   ```
   Always copy these helpers from an existing template; don't introduce a new conversion convention.

4. **Layout is flexbox-only.** No CSS grid, no floats, no absolute positioning across page breaks. For full-bleed backgrounds that must repeat on every page, use `<View fixed style={{ position: 'absolute', ... }} />` — see `elegant-sidebar.tsx`.

5. **`wrap={false}` on every list item** that should not split across pages (experience entries, education rows, project cards). This is the only way react-pdf gives deterministic break behaviour.

6. **Keep `data` shape immutable.** If a Handlebars template references `{{this.location}}` on `Education`, check the TS type first — `Education` does **not** have `location`; that field only exists on `Experience`. Drop unsupported fields rather than extending the type.

7. **TypeScript strict, no `any`.** The `ReactPdfNamespace` types are intentionally `ComponentType<any>` (centralised in `react-pdf-loader.ts`); do not propagate that into your template — accept props through the `ReactPdfResumeProps` / `ReactPdfCoverLetterProps` interfaces.

8. **Repo policy applies.** Conventional Commits. 0 lint errors AND 0 lint warnings. Run `npm run lint` from `apps/api` before committing. Don't disable rules without a `// eslint-disable-... — reason: ...` comment on the line above.

---

## Step-by-step recipe

### 1. Pick a slug

The slug is what binds your TSX file to a DB row. Resolution order in [`template-registry.ts`](../../apps/api/src/pdf-v2/template-registry.ts):

1. `Template.baseTemplateId` (preferred — set this on color/language variants when seeding)
2. `Template.id` (cuid, only matches if the registry entry uses the literal id)
3. Kebab-case of `Template.name` with `(Color)` suffix stripped, e.g. `"Elegant Sidebar (Original Brown)"` → `elegant-sidebar`
4. Kebab-case of `Template.category`

Pick a slug that survives all three: short, kebab-case, no spaces. Examples: `classic-ats`, `harvard-classic`, `elegant-sidebar`.

### 2. Add i18n labels (only if the template introduces new sections)

Edit [`apps/api/src/pdf-v2/i18n.ts`](../../apps/api/src/pdf-v2/i18n.ts). Add an entry to the `LABELS` map keyed `<scope>.<field>` with at minimum `en`, `de`, `fr`, `es`, `it`. The fallback chain is `requested-lang → en → key`, so an `en` value is mandatory.

```ts
'resume.publications': {
  en: 'Publications',
  de: 'Publikationen',
  fr: 'Publications',
  es: 'Publicaciones',
  it: 'Pubblicazioni',
},
```

Reuse existing labels (`resume.summary`, `resume.experience`, `resume.education`, `resume.skills`, `resume.certifications`, `resume.languages`, `resume.projects`, `contact`) wherever possible.

### 3. Create the template file

`apps/api/src/pdf-v2/templates/<slug>.tsx`. Use [`classic-ats.tsx`](../../apps/api/src/pdf-v2/templates/classic-ats.tsx) as the structural reference for single-column ATS layouts and [`elegant-sidebar.tsx`](../../apps/api/src/pdf-v2/templates/elegant-sidebar.tsx) for two-column / colored designs.

Skeleton:

```tsx
import { createElement, type ReactElement } from 'react';
import { tLabel } from '../i18n';
import { createRichTextRenderer } from '../rich-text';
import type { ReactPdfNamespace } from '../react-pdf-loader';
import type {
  ReactPdfCoverLetterProps,
  ReactPdfResumeProps,
  ReactPdfTemplateFactory,
} from '../types';

const px   = (n: number) => n * 0.75;
const inch = (n: number) => n * 72;

const ACCENT_FALLBACK = '#1a1a1a';

const buildResumeStyles = (rp: ReactPdfNamespace, accent: string) =>
  rp.StyleSheet.create({
    page: {
      paddingTop: inch(0.5),
      // ...
      fontFamily: 'Helvetica',
      fontSize: px(11),
      color: '#1a1a1a',
    },
    // ...
  });

function ResumeFactory(rp: ReactPdfNamespace) {
  const renderRichText = createRichTextRenderer(rp);
  return ({ data, meta }: ReactPdfResumeProps): ReactElement => {
    const accent = meta.accentColor ?? ACCENT_FALLBACK;
    const styles = buildResumeStyles(rp, accent);
    const t = (k: string) => tLabel(k, meta.language);
    return createElement(
      rp.Document,
      null,
      createElement(
        rp.Page,
        { size: 'A4', style: styles.page },
        // ...build the tree with rp.View / rp.Text / rp.Link
      ),
    );
  };
}

function CoverLetterFactory(rp: ReactPdfNamespace) { /* same shape */ }

export const MyTemplateFactory: ReactPdfTemplateFactory = {
  resume:      ResumeFactory,
  coverLetter: CoverLetterFactory,
};
```

#### Component cheatsheet

| Need                                       | Pattern                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| Container                                  | `rp.View`                                                                |
| Inline / block text                        | `rp.Text`                                                                |
| Hyperlink                                  | `rp.Link` with `src` + child `rp.Text`                                   |
| Repeating element on every page            | `rp.View` with prop `fixed: true`                                        |
| Prevent split across page break            | prop `wrap: false` on the wrapping `rp.View`                             |
| HTML from LLM (cover letter body, summary) | `createRichTextRenderer(rp)(html, { paragraph, list, ... })`             |
| Pill / chip                                | `rp.View` with `borderRadius: px(12)`, `paddingHorizontal: px(8)`        |
| Section title with left-bar accent         | `borderLeftWidth: px(3)`, `borderLeftColor: accent`, `paddingLeft: px(6)` |

### 4. (If multi-color) add the palette deriver

If the template ships multiple color variants but the DB only stores one `accentColor` per row, add a derivation function to [`color-utils.ts`](../../apps/api/src/pdf-v2/color-utils.ts). Mirror `deriveElegantSidebarPalette`:

```ts
export interface MyTemplatePalette {
  accent: string;
  bgSidebar: string;
  // ...
}

export function deriveMyTemplatePalette(accentColor: string | undefined): MyTemplatePalette {
  const accent = accentColor && HEX_RE.test(accentColor) ? accentColor : '#9c7a5b';
  return {
    accent,
    bgSidebar:   tint(accent, 0.92), // 8% accent, 92% white
    bgSecondary: tint(accent, 0.85),
    textAccent:  shade(accent, 0.30),
    // ...
  };
}
```

The ratios (`tint(_, 0.92)`, `shade(_, 0.30)`) are reverse-engineered from the source CSS variants — read the legacy `apps/api/src/pdf/templates/<slug>/config.json`'s `colorVariants[]` and reproduce one variant exactly with `tint`/`shade` until the resulting hexes match. **One** factory entry then handles all variants.

### 5. Register the factory

Edit [`apps/api/src/pdf-v2/template-registry.ts`](../../apps/api/src/pdf-v2/template-registry.ts):

```ts
import { MyTemplateFactory } from './templates/my-template';

const REGISTRY: RegisteredReactPdfTemplate[] = [
  { key: 'classic-ats', factory: ClassicAtsFactory },
  // ...
  { key: 'my-template', factory: MyTemplateFactory }, // ← slug from step 1
];
```

That's the only wiring needed — `ReactPdfRendererService.supports()` and the per-call selector in `PdfService` pick it up automatically. Templates not in the registry fall back to Puppeteer.

### 6. Validate

Run, **in order**, from `apps/api`:

```bash
# 1. Type-check the whole api package — catches data-shape mismatches early.
npx tsc --noEmit -p tsconfig.json

# 2. Lint just the files you touched. Must be 0 errors AND 0 warnings.
npx eslint src/pdf-v2/templates/<slug>.tsx \
           src/pdf-v2/template-registry.ts \
           src/pdf-v2/i18n.ts \
           src/pdf-v2/color-utils.ts

# 3. Lightweight standalone runtime check (NO Nest, NO Prisma).
#    Add an entry for your template to TARGETS in this file first if it's
#    not already covered.
npx ts-node -r tsconfig-paths/register scripts/validate-react-pdf-templates.ts

# 4. Visual diff vs Puppeteer (requires running DB + seeded templates).
PDF_RENDERER_DEFAULT=react-pdf npm run snapshot:pdf-renderers
# Output: /tmp/smart-apply-pdf-snapshots/<timestamp>/{puppeteer,react-pdf}/
# Open both folders in Preview and visually diff.
```

The lightweight validator at [`apps/api/scripts/validate-react-pdf-templates.ts`](../../apps/api/scripts/validate-react-pdf-templates.ts) is the **fast path** — it bypasses Nest bootstrap entirely and just calls each registered factory with sample data. Use it during inner-loop development. The full DB-bound `snapshot:pdf-renderers` is only for final visual sign-off against the Puppeteer original.

### 7. (Optional) Set the new template as the user-facing default

Once you've visually approved the output, you can make every request for that base design route through react-pdf without changing `PDF_RENDERER_DEFAULT` globally — the registry match alone is sufficient when `PDF_RENDERER_DEFAULT=react-pdf` is set on the env. To keep `puppeteer` as the env default but force a single template through react-pdf, route the per-call selector in `PdfService` to `ReactPdfRendererService.supports(...)` first. Do **not** delete the legacy template files in this PR — staged removal of Puppeteer is its own follow-up.

---

## Validation outputs to report back

When you're done, the assistant should report:

1. ✅ `tsc --noEmit` exit code (must be 0)
2. ✅ `eslint` exit code on touched files (must be 0; no warnings)
3. ✅ The four-line block from `validate-react-pdf-templates.ts` showing each factory rendering, with byte counts
4. (If full snapshot was run) The `/tmp/smart-apply-pdf-snapshots/<ts>/` path so the user can open and diff

Then propose a Conventional Commit, e.g. `feat(pdf-v2): port <design> to react-pdf renderer`, and remind the user that PR titles must follow the same format because release-please consumes them.

---

## Anti-patterns

- ❌ `import { Document, Page } from '@react-pdf/renderer'` — will crash with `ERR_REQUIRE_ESM`. Use the `rp` argument.
- ❌ Adding a `<resume>.location` access on `Education` because the legacy `.hbs` did it — TypeScript won't accept it; check the source type in `template-renderer.service.ts`.
- ❌ Hardcoding `bgSidebar` / `bgSecondary` per variant. Derive from `accentColor`.
- ❌ Registering the factory twice (once per language) — one entry per **base design**; language is a runtime prop via `meta.language`.
- ❌ Using percentages for `paddingTop` / `paddingBottom` on a `Page`. react-pdf's flex engine handles them poorly; use `inch()` / `px()`.
- ❌ Adding a long-lived branch like `feat/pdf-v2-staging` — this repo is trunk-based. Short-lived `feat/pdf-v2-<design>` branches only.

---

## Cross-references

- [`apps/api/src/pdf-v2/README`-equivalent files](../../apps/api/src/pdf-v2/) — `types.ts`, `react-pdf-loader.ts`, `template-registry.ts`, `i18n.ts`, `color-utils.ts`, `rich-text.tsx`
- Reference templates: [`classic-ats.tsx`](../../apps/api/src/pdf-v2/templates/classic-ats.tsx), [`harvard-classic.tsx`](../../apps/api/src/pdf-v2/templates/harvard-classic.tsx), [`elegant-sidebar.tsx`](../../apps/api/src/pdf-v2/templates/elegant-sidebar.tsx)
- Source of `ResumeTemplateData` / `CoverLetterTemplateData`: [`apps/api/src/pdf/template-renderer.service.ts`](../../apps/api/src/pdf/template-renderer.service.ts)
- Legacy Handlebars equivalents (for visual reference + color reverse-engineering): `apps/api/src/pdf/templates/<slug>/`
- [`docs/guides/REARCHITECTURE_PLAN.md`](../../docs/guides/REARCHITECTURE_PLAN.md) — overall Phase 1 → Phase 2 plan
- Repo conventions: [`.github/copilot-instructions.md`](../copilot-instructions.md) — Conventional Commits, lint policy, branching
