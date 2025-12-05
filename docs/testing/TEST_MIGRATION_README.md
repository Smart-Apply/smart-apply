# Test Migration & Coverage Improvement Guide

## 🎯 Ziel

100% Code Coverage für business-kritische Funktionalitäten durch:
1. **Reorganisation** bestehender Tests nach Best Practices
2. **Ergänzung** fehlender Unit/Integration/E2E Tests
3. **Behebung** gebrochener Tests
4. **Optimierung** der Test-Ausführung

---

## 📁 Neue Test-Struktur

```
apps/api/
├── src/
│   └── [module]/
│       ├── __tests__/
│       │   ├── unit/               # Isolierte Service/Controller Tests
│       │   │   └── *.unit.spec.ts
│       │   └── integration/        # Module-Interaktions Tests
│       │       └── *.integration.spec.ts
│       └── [module].service.ts
├── test/
│   ├── e2e/                        # End-to-End HTTP Tests
│   │   ├── auth/
│   │   ├── features/
│   │   └── security/
│   ├── fixtures/                   # Shared test data
│   │   ├── profile.fixture.ts
│   │   └── application.fixture.ts
│   ├── helpers/                    # Test utilities
│   │   ├── test-db.helper.ts
│   │   ├── auth.helper.ts
│   │   └── mock.helper.ts
│   ├── jest-unit.json             # Unit test config
│   ├── jest-integration.json      # Integration test config
│   └── jest-e2e.json              # E2E test config
└── TESTING_STRATEGY.md             # Detailed strategy doc
```

---

## 🚀 Quick Start

### 1. Migration durchführen

```bash
# Make script executable
chmod +x scripts/migrate-tests.sh

# Run migration
./scripts/migrate-tests.sh
```

**Was passiert:**
- Erstellt `__tests__/unit` und `__tests__/integration` Ordner in allen Modulen
- Verschiebt bestehende Tests in neue Struktur
- Benennt Tests nach Best Practices um (`.unit.spec.ts`, `.integration.spec.ts`)

### 2. Tests ausführen

```bash
# Alle Unit Tests
npm run test:unit

# Alle Integration Tests
npm run test:integration

# Alle E2E Tests
npm run test:e2e

# Alle Tests mit Coverage
npm run test:all:cov

# Watch Mode für TDD
npm run test:unit:watch
```

### 3. Coverage Report anzeigen

```bash
# Nach test:unit:cov
open coverage/unit/lcov-report/index.html

# Nach test:all:cov
open coverage/lcov-report/index.html
```

---

## 🔧 Broken Tests fixen

### Problem 1: Missing TemplatesService Mock

**Betroffene Tests:**
- `jobs.service.spec.ts`
- `language-detection.spec.ts`
- `summary-translation.integration.spec.ts`

**Lösung:**
```typescript
import { TemplatesService } from '@/templates/templates.service';

// Im TestingModule providers array:
{
  provide: TemplatesService,
  useValue: {
    findById: jest.fn().mockResolvedValue({
      id: 'template-id',
      name: 'Modern Professional',
      cssFile: 'modern-professional.css',
    }),
    findByLanguage: jest.fn().mockResolvedValue([]),
  },
}
```

### Problem 2: TypeScript Error in env.schema.spec.ts

**Fehler:**
```
Expected 1 arguments, but got 0.
```

**Lösung:**
```typescript
// Vorher
expect(() => validateEnv()).toThrow();

// Nachher
expect(() => validateEnv({
  JWT_SECRET: 'short',
  // ... other required env vars
})).toThrow();
```

### Problem 3: Puppeteer Timeouts

**Fehler:**
```
Puppeteer initialization failed: read ECONNRESET
```

**Lösung:**
```typescript
// Erhöhe Timeout für PDF-Tests
jest.setTimeout(30000);

// Oder mocke Puppeteer für schnellere Tests
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn(),
      pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
    }),
    close: jest.fn(),
  }),
}));
```

### Problem 4: DOCX Parser Error

**Fehler:**
```
Cannot read properties of undefined (reading 'extractRawText')
```

**Lösung:**
```typescript
// Mock mammoth library
jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockResolvedValue({
    value: 'Extracted text from DOCX',
  }),
}));
```

---

## 📊 Coverage-Ziele

### Business-Kritische Module (Priorität 1)

| Modul | Ziel | Aktuell | Fehlend |
|-------|------|---------|---------|
| Auth | 95% | ~15% | 80% |
| Profile | 88% | ~0% | 88% |
| Applications | 95% | ~30% | 65% |
| LLM | 85% | ~40% | 45% |
| PDF | 87% | ~50% | 37% |

### High-Priority Module (Priorität 2)

| Modul | Ziel | Aktuell | Fehlend |
|-------|------|---------|---------|
| Storage | 78% | ~0% | 78% |
| Jobs | 78% | ~60% | 18% |
| Keywords | 83% | ~70% | 13% |

**Durchschnitt-Ziel:** ≥ **85% Code Coverage**

---

## ✅ Test-Qualität Checklist

### Unit Tests
- [ ] Alle Public Methods getestet
- [ ] Success Cases abgedeckt
- [ ] Error Cases abgedeckt
- [ ] Edge Cases abgedeckt (null, undefined, empty arrays)
- [ ] Mocks für alle Dependencies
- [ ] Schnelle Ausführung (< 5ms pro Test)
- [ ] Keine echten DB/API Calls
- [ ] AAA Pattern (Arrange-Act-Assert)

### Integration Tests
- [ ] Module-Interaktionen getestet
- [ ] Real Database (Test DB or SQLite)
- [ ] Real Queue Provider (In-Memory)
- [ ] Nur externe APIs gemockt
- [ ] Pipeline-Flows von Start bis Ende
- [ ] Timeouts angemessen (30s)

### E2E Tests
- [ ] Complete User Journeys
- [ ] HTTP Requests über echte API
- [ ] Auth + Authorization
- [ ] Security Features (CSRF, Rate Limit)
- [ ] Error Responses (400, 401, 403, 404)
- [ ] Database Cleanup nach jedem Test

---

## 📝 Naming Conventions

### Unit Tests
```
[entity].[component].unit.spec.ts

Beispiele:
✅ auth.service.unit.spec.ts
✅ profile.controller.unit.spec.ts
✅ jwt-auth.guard.unit.spec.ts
✅ sanitize.decorator.unit.spec.ts

❌ auth.spec.ts (nicht spezifisch genug)
❌ authService.test.ts (falsches Pattern)
```

### Integration Tests
```
[feature].integration.spec.ts

Beispiele:
✅ application-pipeline.integration.spec.ts
✅ llm-pdf-generation.integration.spec.ts
✅ storage-blob.integration.spec.ts

❌ integration.spec.ts (nicht aussagekräftig)
❌ test.integration.spec.ts (zu generisch)
```

### E2E Tests
```
[feature].e2e.spec.ts

Beispiele:
✅ auth.e2e.spec.ts
✅ applications.e2e.spec.ts
✅ csrf.e2e.spec.ts

❌ auth.e2e-spec.ts (alter Style, akzeptiert aber deprecated)
```

---

## 🛠️ Test Helpers Nutzen

### Mock Helper
```typescript
import { MockHelper } from '@/test/helpers/mock.helper';

// In beforeEach:
const mockPrisma = MockHelper.createMockPrismaService();
const mockLLM = MockHelper.createMockLLMService();
const mockStorage = MockHelper.createMockStorageService();
```

### Auth Helper
```typescript
import { AuthHelper } from '@/test/helpers/auth.helper';

const authHelper = new AuthHelper();
const token = authHelper.generateToken('user-id-123');
const headers = authHelper.getAuthHeader(token);

// In E2E tests:
const response = await request(app.getHttpServer())
  .get('/api/v1/profile')
  .set(headers);
```

### Test DB Helper
```typescript
import { TestDbHelper } from '@/test/helpers/test-db.helper';

const dbHelper = new TestDbHelper(prisma);

beforeEach(async () => {
  await dbHelper.clearDatabase();
  await dbHelper.seedTestData();
});

afterAll(async () => {
  await dbHelper.cleanup();
});
```

### Fixtures
```typescript
import {
  mockProfile,
  mockSkills,
  mockExperiences,
} from '@/test/fixtures/profile.fixture';

import {
  mockJobPosting,
  mockApplication,
  mockCoverLetterContent,
} from '@/test/fixtures/application.fixture';

// Use in tests:
prisma.profile.findUnique = jest.fn().mockResolvedValue(mockProfile);
```

---

## 📈 TDD Workflow (Empfohlen)

### Red-Green-Refactor Cycle

```bash
# 1. RED: Test schreiben (failing)
npm run test:unit:watch

# In auth.service.unit.spec.ts:
it('should hash password with argon2', async () => {
  const result = await service.hashPassword('password');
  expect(result).not.toBe('password');
  expect(argon2.verify(result, 'password')).resolves.toBe(true);
});
```

```typescript
// 2. GREEN: Minimal code implementieren
async hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}
```

```typescript
// 3. REFACTOR: Code optimieren
async hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new BadRequestException('Password is required');
  }
  if (password.length < 8) {
    throw new BadRequestException('Password must be at least 8 characters');
  }
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}
```

---

## 🎯 Nächste Schritte

### Sofort (2 Tage)
1. ✅ Migrations-Skript ausführen
2. ⏳ Broken Tests fixen (TemplatesService, TypeScript, Puppeteer)
3. ⏳ Auth.service.unit.spec.ts als Template nutzen

### Phase 1 (10-15 Tage)
4. Auth Module Tests schreiben (95% target)
5. Profile Module Tests schreiben (88% target)
6. Applications Module Tests schreiben (95% target)
7. LLM Module Tests schreiben (85% target)
8. PDF Module Tests schreiben (87% target)

### Phase 2 (5-7 Tage)
9. Storage Module Tests schreiben
10. Jobs Module Tests erweitern
11. Keywords Module Tests erweitern
12. Job-Postings Module Tests schreiben

### Phase 3 (3-5 Tage)
13. Integration Tests schreiben (Pipeline-Flows)
14. E2E Tests erweitern (Complete Journeys)

### Phase 4 (Kontinuierlich)
15. Coverage Report überwachen
16. Flaky Tests eliminieren
17. Performance optimieren
18. CI/CD Integration

---

## 📚 Dokumente

- **TESTING_STRATEGY.md** - Umfassende Testing-Strategie
- **TEST_COVERAGE_GAPS.md** - Detaillierte Gap-Analyse
- **test/helpers/** - Reusable Test Utilities
- **test/fixtures/** - Shared Test Data

---

## 🤝 Best Practices

1. **Ein Test = Ein Assert** (meist)
2. **Descriptive Namen:** `should_throw_error_when_user_not_found`
3. **AAA Pattern:** Arrange → Act → Assert
4. **Fast Execution:** Unit < 5ms, Integration < 100ms
5. **No Flaky Tests:** Keine Random-Werte oder Time-Dependencies
6. **Mock External Deps:** Keine echten API-Calls in Unit Tests
7. **Cleanup after Each:** Isolierte Tests ohne Side-Effects
8. **TDD when possible:** Red → Green → Refactor

---

**Status:** Migration vorbereitet ✅  
**Nächster Schritt:** `./scripts/migrate-tests.sh` ausführen  
**Ziel:** 85%+ Coverage in 20-30 Arbeitstagen
