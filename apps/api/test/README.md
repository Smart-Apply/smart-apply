# Test-Struktur

Organisierte Test-Suite für Smart Apply Backend API. Migriert von Jest auf
**Vitest 2.1** (Mai 2026, Phase 5 des [Rearchitecture Plan](../../docs/guides/REARCHITECTURE_PLAN.md)).

## 📁 Ordnerstruktur

```
apps/api/
├── vitest.config.mts                # Vitest Config (alle Suites)
├── .swcrc                           # SWC Config (Decorator Metadata)
├── src/
│   ├── auth/__tests__/unit/         # Unit Tests (.unit.spec.ts)
│   └── applications/__tests__/      # Unit + Integration Tests
└── test/
    ├── e2e/                         # End-to-End Tests
    │   ├── auth/
    │   ├── features/
    │   ├── health/
    │   ├── performance/
    │   └── security/
    ├── fixtures/
    ├── helpers/
    │   ├── auth.helper.ts
    │   ├── mock.helper.ts
    │   └── test-db.helper.ts
    └── setup.ts                     # Vitest Setup (env vars)
```

## 🧪 Test-Kategorien

Suites werden über das Datei-Suffix gewählt:

| Suffix                  | Suite       | Speed | DB nötig? |
|-------------------------|-------------|-------|-----------|
| `*.unit.spec.ts`        | unit        | ms    | nein      |
| `*.integration.spec.ts` | integration | ms–s  | gemockt   |
| `*.e2e-spec.ts`         | e2e         | s     | ja        |

### E2E Tests (`test/e2e/`)
End-to-End Tests für API-Endpunkte mit echter Datenbank und vollem Request-Lifecycle.

- **auth/** — Login, Register, Refresh-Token Rotation, Sessions, Settings
- **features/** — Profile CRUD, Job Postings, Applications, Uploads, Pagination, Subscription
- **health/** — `/health` Terminus checks
- **performance/** — Compression, N+1 query prevention
- **security/** — Audit Logging, CORS, CSP, CSRF, Rate Limiting, XSS Sanitization

### Unit & Integration Tests (`src/**/__tests__/`)
Unit Tests leben **neben dem Modul** in einem `__tests__/unit/` Unterordner. Integration Tests
(NestJS DI Container, gemockte Provider) leben in `__tests__/integration/`.

## 🚀 Tests ausführen

```bash
# Alle Suites
npm test                              # vitest run (alle Patterns)

# Einzelne Suite (Vitest filtert per Substring auf den Pfad)
pnpm test:unit                     # vitest run unit.spec
pnpm test:integration              # vitest run integration.spec
pnpm test:e2e                      # vitest run e2e-spec

# Watch
pnpm test:unit:watch
pnpm test:integration:watch
pnpm test:e2e:watch

# Coverage (v8 provider, HTML + lcov in coverage/)
pnpm test:cov
pnpm test:unit:cov
pnpm test:integration:cov

# Einzelne Datei (positional Argument = Substring-Filter)
npx vitest run pdf-download           # matcht src/.../pdf-download.unit.spec.ts
npx vitest run auth/auth.e2e          # matcht test/e2e/auth/auth.e2e-spec.ts
```

## 📝 Test-Conventions

### Naming
- **Unit Tests**: `*.unit.spec.ts` — isolierte Services/Funktionen, alles gemockt
- **Integration Tests**: `*.integration.spec.ts` — NestJS DI mit gemockten Providern
- **E2E Tests**: `*.e2e-spec.ts` — vollständige API-Flows gegen echte DB
- **Describe Blocks**: Feature- oder Endpoint-basiert
- **Test Cases**: Sollten mit "should" beginnen

### Vitest Globals
Mit `globals: true` in der Config sind `describe`, `it`, `expect`, `beforeAll`,
`beforeEach`, `afterAll`, `afterEach` und `vi` ohne Import verfügbar. Für Typen
(z.B. `Mock`, `MockInstance`) wird ein expliziter Import gebraucht:

```typescript
import type { Mock, MockInstance } from 'vitest';
```

`test/vitest-env.d.ts` enthält `/// <reference types="vitest/globals" />`,
damit der TS Compiler die Globals kennt — und der Rest der `@types/*`
Auto-Inclusion (`@types/multer`, `@types/express` etc.) bleibt unangetastet.

### Struktur
```typescript
describe('FeatureName (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Setup
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('POST /endpoint', () => {
    it('should handle success case', async () => {
      // Test
    });

    it('should handle error case', async () => {
      // Test
    });
  });
});
```

### Best Practices
1. **Isolierte Tests** — jeder Test soll unabhängig laufen können
2. **Cleanup** — Datenbank nach jedem Test aufräumen (E2E)
3. **Fixtures** — Verwende Test-Fixtures aus `fixtures/`
4. **Mocking** — `vi.fn()`, `vi.spyOn()`, `vi.mock('module-name')`
5. **Assertions** — spezifische Assertions (`expect().toBe()`, nicht nur `toBeTruthy()`)

## 🔧 Konfiguration

### `vitest.config.mts`
Eine Config für alle Suites. Wichtige Punkte:
- `unplugin-swc` transpiliert TS und emittiert `design:*` Decorator-Metadaten
  (das braucht NestJS DI; esbuild kann das nicht).
- `vite-tsconfig-paths` löst den `@/*` Alias aus `tsconfig.json` auf.
- `pool: 'forks'` + `singleFork: true` — sequentielle Ausführung, weil
  Integration/E2E DB-Zugriff serialisiert annimmt.
- `globals: true` — Jest-kompatible globale APIs.

### `setup.ts`
Setzt Test-Environment-Variablen bevor `AppModule` lädt:
- `JWT_SECRET` (64+ Zeichen Test-Wert)
- `DATABASE_URL` (Default: lokale Test-DB)
- `STORAGE_DRIVER=disk`, `LLM_PROVIDER=mock`, `JOBS_DRIVER=in-memory`
- `NODE_ENV=test`
- Hohe Rate-Limit Werte (effektiv deaktiviert)

## 📊 Test-Status

Aktuelle Suite (Stand Mai 2026):
- **Unit**: 4 Dateien — passing ✅
- **Integration**: 1 Datei — failing (TemplatesService DI mismatch, pre-existing tech debt)
- **E2E**: 21 Dateien — brauchen reale DB, in CI nicht ausgeführt

> **Hinweis:** CI markiert die `unit-tests` Job aktuell als `continue-on-error: true`,
> weil ein Teil der bestehenden Tests nicht zum Code-Stand passt. Siehe
> [`.github/copilot-instructions.md`](../../.github/copilot-instructions.md#test-suite-status).

## 🎯 Neue Tests hinzufügen

### Unit Test (neben dem Modul)
```bash
mkdir -p apps/api/src/<module>/__tests__/unit
touch apps/api/src/<module>/__tests__/unit/<feature>.unit.spec.ts
```

### Integration Test
```bash
mkdir -p apps/api/src/<module>/__tests__/integration
touch apps/api/src/<module>/__tests__/integration/<feature>.integration.spec.ts
```

### E2E Test
```bash
touch apps/api/test/e2e/features/<new-feature>.e2e-spec.ts
```

### Test Fixture
```bash
cp sample.pdf apps/api/test/fixtures/
```

## 🐛 Debugging

### Einzelnen Test debuggen
```bash
node --inspect-brk node_modules/.bin/vitest run --pool=forks --poolOptions.forks.singleFork=true <pattern>
```

Oder direkt im VS Code: Vitest Extension installieren, Breakpoint setzen, Test
über das Code-Lens "Debug Test" starten.

### Logs anzeigen
Tests verwenden Winston Logger. Logs erscheinen in der Console wenn
`LOG_LEVEL=debug` gesetzt ist.

### Test-Datenbank
E2E Tests verwenden eine separate Test-Datenbank
(`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartapply_test`
default in `setup.ts`).

---

**Letzte Aktualisierung:** 16. Mai 2026 (Vitest-Migration, Phase 5)
**Maintainer:** Smart Apply Team
