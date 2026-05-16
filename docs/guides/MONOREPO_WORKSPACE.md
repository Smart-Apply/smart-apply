# Smart Apply — Monorepo Workspace (pnpm)

pnpm-Workspaces-basiertes Monorepo für Smart Apply (Backend + Frontend + Shared Types).

> Migriert von npm Workspaces auf **pnpm 11.1** (Mai 2026, Phase 5 des [Rearchitecture Plan](./REARCHITECTURE_PLAN.md)).

## 📁 Struktur

```text
smart-apply/
├── package.json              # Workspace-Root (Orchestrator, root devDeps)
├── pnpm-workspace.yaml       # Workspace-Manifest (welche Pakete gehören dazu)
├── pnpm-lock.yaml            # EINZIGE Lockfile-Quelle der Wahrheit
├── .npmrc                    # pnpm-Settings (auto-install-peers, hoist patterns)
├── turbo.json                # Turborepo Task-Graph
├── apps/
│   ├── api/                  # @smart-apply/api (NestJS Backend)
│   │   ├── package.json
│   │   ├── src/
│   │   ├── test/
│   │   └── prisma/
│   └── web/                  # @smart-apply/web (Next.js Frontend)
│       ├── package.json
│       └── src/
├── packages/
│   └── shared/               # @smart-apply/shared (geteilte DTOs / Types)
│       ├── package.json
│       ├── src/
│       └── dist/             # tsc Output (von api + web als JS importiert)
└── node_modules/             # pnpm-managed: alles via Symlinks aus dem Store
```

## 🎯 Workspace-Konzept

### Warum pnpm?
- **Strict hoisting** — kein "phantom dependency" Fehler in Production
- **Content-addressed Store** — eine globale Kopie pro Paket-Version,
  Workspaces ziehen Symlinks. Ergebnis: viel kleineres `node_modules` (~40%
  weniger Plattenplatz) und ~5× schnellere Installs.
- **Workspace-Filter** (`--filter @smart-apply/api...`) — präzise Builds,
  perfekt für Docker-Layer-Caching.
- **`pnpm deploy`** — produktionsreife isolierte Tree-Ausgabe ohne
  Workspace-Symlinks. Das nutzen wir im [Dockerfile](../../infra/Dockerfile).

### Root `package.json`
- **packageManager:** `pnpm@11.1.2` — Corepack respektiert das.
- **devDependencies:** TypeScript, ESLint, Prettier, Vitest, Turborepo,
  `@nestjs/*` (CLI), `tsx`, … alles was *root-Scripts* oder die Build-Pipeline
  braucht.
- **scripts:** Orchestrierungs-Aliases (`api:dev`, `web:dev`, …) als
  `pnpm --filter <name>` Wrapper, plus Turborepo-Tasks (`dev`, `build`, `lint`,
  `test`, `test:unit`, `typecheck`).
- **pnpm.overrides:** Pinning für transitive Deps (lodash, postcss,
  fast-xml-builder, …).
- **pnpm.peerDependencyRules:** Peer-Whitelist für `@angular-devkit/core`.

### `pnpm-workspace.yaml`
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### `.npmrc`
```ini
auto-install-peers=true        # pnpm 8+ default; matched what npm did
strict-peer-dependencies=false # equivalent of npm's --legacy-peer-deps
public-hoist-pattern[]=*types*
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
```

## 🚀 Commands

### Setup (einmal pro Maschine)

```bash
corepack enable
corepack prepare pnpm@11.1.2 --activate
pnpm install
```

### Development

```bash
# Alle Apps starten (Turborepo, parallel)
pnpm dev

# Nur Backend
pnpm api:dev          # alias für pnpm --filter @smart-apply/api start:dev

# Nur Frontend
pnpm web:dev

# Shared Package im Watch-Mode
pnpm shared:watch
```

### Build

```bash
# Alle Apps + Shared (Turborepo cached)
pnpm build

# Nur Backend
pnpm build:api        # turbo run build --filter=@smart-apply/api

# Nur Frontend
pnpm build:web

# Nur das, was sich seit HEAD^1 geändert hat
pnpm build:changed
```

### Testing

```bash
pnpm test             # Turborepo: alle test:unit Tasks
pnpm test:unit        # Backend Unit-Tests (Vitest)
pnpm test:integration # Backend Integration-Tests
pnpm test:e2e         # Backend E2E-Tests (braucht echte DB)
pnpm test:all         # unit + integration + e2e sequenziell
pnpm test:cov         # Coverage-Report (v8 provider)
```

### Database (Prisma)

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm prisma:seed:templates
pnpm prisma:studio
```

### Linting

```bash
pnpm lint             # Turborepo: alle lint Tasks
```

## 📦 Dependency Management

### Installation

```bash
# Installiert alles (Root + Workspaces) basierend auf pnpm-lock.yaml
pnpm install

# Frozen — wie CI's `pnpm install --frozen-lockfile`. Failt wenn das
# Lockfile von den Manifesten abweicht.
pnpm install --frozen-lockfile
```

### Dependency hinzufügen / entfernen

```bash
# Backend-spezifisch
pnpm --filter @smart-apply/api add @nestjs/cache-manager
pnpm --filter @smart-apply/api add -D @types/some-lib   # devDep

# Frontend-spezifisch
pnpm --filter @smart-apply/web add react-icons

# Shared Package
pnpm --filter @smart-apply/shared add zod

# Im Root (für alle Workspaces verfügbare devDep, z.B. Tooling)
pnpm add -Dw prettier

# Entfernen
pnpm --filter @smart-apply/api remove some-package
```

> **Wichtig:** Nach jedem `pnpm add/remove` wird `pnpm-lock.yaml` aktualisiert
> — **immer committen** im selben PR wie die `package.json` Änderung. CI's
> `lint-and-typecheck` Job blockiert sonst.

### Workspace-Filter Cheat-Sheet

```bash
pnpm --filter @smart-apply/api <command>      # nur api
pnpm --filter @smart-apply/api... <command>   # api + dessen Workspace-Deps
pnpm --filter ...@smart-apply/api <command>   # api + alles was api importiert
pnpm --filter "./apps/*" <command>            # alle apps/*
pnpm -r <command>                             # in jedem Workspace ausführen
```

## 🔧 Wie pnpm Workspaces funktioniert

### Isolated node_modules (Default)

pnpm legt einen einzigen content-addressed Store unter `~/.local/share/pnpm/store`
an. Jeder Workspace bekommt ein eigenes `node_modules/` mit Symlinks zurück in
den Store. Workspace-Deps (`@smart-apply/shared`) sind Symlinks ins
Source-Verzeichnis — Änderungen sind sofort sichtbar, kein Build-Step zwischen
"shared geändert" und "api sieht's".

```bash
# Symlink-Struktur
apps/api/node_modules/@smart-apply/shared -> ../../../packages/shared
apps/api/node_modules/@nestjs/common      -> .pnpm/@nestjs+common@11.1.12/...
node_modules/.pnpm/@nestjs+common@11.1.12 -> store/.../node_modules/@nestjs/common
```

### Phantom Dependencies

npm/yarn hoisten alles in ein flaches `node_modules`, was bedeutet, dass Code
versehentlich Pakete importieren kann, die er nicht in seiner `package.json`
deklariert hat. Funktioniert in Dev, knallt in Production. pnpm verbietet das
per Default — wenn `apps/api` `lodash` importieren will, MUSS es in
`apps/api/package.json` deklariert sein.

Hoist-Ausnahmen für Tooling, das diese Annahme trotzdem braucht:
[`.npmrc`](../../.npmrc) `public-hoist-pattern[]=...`.

## 🎨 Vorteile gegenüber npm

| Aspekt | npm Workspaces | pnpm Workspaces |
|---|---|---|
| Install-Zeit (cold) | ~75 s | ~25 s |
| Install-Zeit (warm) | ~15 s | ~3 s |
| `node_modules` Größe | ~1.8 GB | ~1.1 GB |
| Phantom-Dep-Schutz | ❌ | ✅ |
| Workspace-Filter | `--workspace=apps/api` | `--filter @smart-apply/api` (+ transitive Modi) |
| Lockfile-Größe | ~21 k Zeilen YAML-äquivalent | ~9 k Zeilen |
| Produktions-Tree | Manuell prune + Symlink-Surgery | `pnpm deploy --prod` |

## 🚢 Deployment

### Backend (Fly.io)

Siehe [`infra/Dockerfile`](../../infra/Dockerfile). Kurzfassung:

1. **Builder stage** — `pnpm install --frozen-lockfile` (alle Workspaces, inkl.
   devDeps), `pnpm --filter @smart-apply/shared build`,
   `pnpm --filter @smart-apply/api prisma:generate`,
   `pnpm --filter @smart-apply/api build`, Prisma-Seed-Scripts via `tsc`
   kompilieren.
2. **Deployer stage** — `pnpm --filter @smart-apply/api deploy --prod /prod/api`
   erzeugt einen isolierten produktionsreifen Baum mit allen runtime-Deps und
   einer echten Kopie von `@smart-apply/shared` (kein Symlink mehr).
3. **Production stage** — `node:26-alpine`, COPY aus deployer + dist + Email-
   Templates + Prompts. Keine pnpm-Installation im finalen Image.

### Frontend (Cloudflare Workers via OpenNext)

```bash
# Staging (auto-deploy on push to main)
pnpm --filter @smart-apply/web cf:deploy:staging

# Prod (auf v*.*.* tag push)
pnpm --filter @smart-apply/web cf:deploy
```

OpenNext baut Next.js zu einem Worker-Bundle. Cloudflare Workers haben
isolierte node_modules von Haus aus, also passt das hervorragend zu pnpm's
Isolierungsmodell.

## 🔄 Workflow-Tipps

### Neue Dependency hinzufügen

1. **Frage:** Welcher Workspace braucht das Paket *zur Laufzeit*?
   - Beides → in **beide** Workspaces einzeln (`pnpm --filter ... add ...`).
     pnpm dedupliziert via Store, du verlierst keinen Plattenplatz.
   - Nur Backend → `pnpm --filter @smart-apply/api add ...`
   - Nur Frontend → `pnpm --filter @smart-apply/web add ...`
   - Nur Root-Tooling (Prettier, Turborepo) → `pnpm add -Dw ...`

2. **Beispiele:**
   - `class-validator` → `apps/api` (NestJS DTOs)
   - `react-icons` → `apps/web` (UI)
   - `zod` → beide Workspaces (Validierung in API + Frontend)
   - `prettier` → Root (`-Dw`)

### Troubleshooting

```bash
# node_modules komplett neu aufbauen
pnpm install --force

# nur Workspace-Symlinks neu verlinken (schneller als --force)
pnpm install

# Was bricht Lockfile-Sync?
pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts
git diff pnpm-lock.yaml | head -100

# Prisma Client neu generieren (NICHT bare `prisma generate`, siehe
# repo memory + apps/api/scripts/sanitize-prisma-client.js)
pnpm --filter @smart-apply/api prisma:generate

# TypeScript Errors? Shared zuerst bauen, dann der Rest
pnpm shared:build
pnpm build
```

## 🎯 Best Practices

1. **Immer vom Root ausführen:** `pnpm api:dev` statt `cd apps/api && pnpm start:dev`
2. **`--filter @smart-apply/<name>` nutzen** statt `cd` + Befehl
3. **Lockfile committen:** Bei jedem `package.json` Change auch
   `pnpm-lock.yaml` committen. CI failt sonst.
4. **Keine zirkulären Workspace-Imports:** Workspaces sollten sich nicht
   gegenseitig importieren — nur über `@smart-apply/shared` als zentraler Hub.
5. **Konsistente Versionen:** Wenn `apps/api` und `apps/web` beide `zod` nutzen,
   sollten sie dieselbe Major-Version verwenden. Lass dir Inkonsistenzen
   anzeigen: `pnpm list -r zod`.

## 📚 Weitere Ressourcen

- [pnpm Workspaces Docs](https://pnpm.io/workspaces)
- [pnpm vs npm vs yarn Benchmark](https://pnpm.io/benchmarks)
- [pnpm Deploy](https://pnpm.io/cli/deploy) (was der Dockerfile nutzt)
- [REARCHITECTURE_PLAN.md](./REARCHITECTURE_PLAN.md) — wieso wir migriert sind
- [CONTRIBUTING.md](../../CONTRIBUTING.md) — Branching, Commits, PR-Flow

---

**Stand:** 16. Mai 2026 (pnpm-Migration, Phase 5)
**Struktur:** pnpm Workspaces 11.1 + Turborepo 2.8
