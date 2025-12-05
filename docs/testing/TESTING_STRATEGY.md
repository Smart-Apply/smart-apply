# Testing Strategy - Smart Apply Backend

## 🎯 Ziel: 100% Code Coverage für Business-Kritische Funktionalität

### Test-Pyramide

```
       /\
      /  \     E2E Tests (10%)
     /____\    - Vollständige User Journeys
    /      \   - Auth → Profile → Applications → PDF Download
   /        \  
  /__________\ Integration Tests (30%)
 /            \ - Module-Interaktionen (LLM+PDF, Storage+Blob)
/______________\ Unit Tests (60%)
                - Services, Guards, Decorators, Utils
```

## 📁 Test-Ordnerstruktur (Best Practices)

```
apps/api/
├── src/
│   └── [module]/
│       ├── __tests__/
│       │   ├── unit/
│       │   │   ├── [module].service.unit.spec.ts
│       │   │   ├── [module].controller.unit.spec.ts
│       │   │   └── [module].util.unit.spec.ts
│       │   └── integration/
│       │       └── [module].integration.spec.ts
│       ├── [module].service.ts
│       └── [module].controller.ts
└── test/
    ├── e2e/
    │   ├── auth/
    │   ├── features/
    │   └── security/
    ├── fixtures/
    ├── helpers/
    └── jest-e2e.json
```

## 🏷️ Naming Conventions

### Unit Tests
- **Pattern:** `[entity].[component].unit.spec.ts`
- **Beispiele:**
  - `auth.service.unit.spec.ts`
  - `applications.service.unit.spec.ts`
  - `jwt-auth.guard.unit.spec.ts`
  - `sanitize.decorator.unit.spec.ts`

### Integration Tests
- **Pattern:** `[feature].integration.spec.ts`
- **Beispiele:**
  - `application-pipeline.integration.spec.ts`
  - `llm-pdf.integration.spec.ts`
  - `storage-blob.integration.spec.ts`
  - `summary-translation.integration.spec.ts`

### E2E Tests
- **Pattern:** `[feature].e2e.spec.ts`
- **Beispiele:**
  - `auth.e2e.spec.ts`
  - `applications.e2e.spec.ts`
  - `csrf.e2e.spec.ts`

## 🎭 Test-Kategorien

### 1. Unit Tests (60% Coverage Target)
**Was wird getestet:**
- Einzelne Services/Controller isoliert
- Guards, Decorators, Pipes
- Utility Functions
- DTO Validation

**Mocking:**
- Alle externen Dependencies gemockt
- Prisma, Storage, LLM, Jobs gemockt
- Schnelle Ausführung (< 5ms pro Test)

**Beispiel Module:**
- `auth.service.unit.spec.ts` (login, register, JWT generation)
- `profile.service.unit.spec.ts` (CRUD operations)
- `applications.service.unit.spec.ts` (create, findAll)
- `llm.service.unit.spec.ts` (provider selection, error handling)
- `pdf.service.unit.spec.ts` (template rendering)
- `storage.service.unit.spec.ts` (upload, download, delete)
- `jobs.service.unit.spec.ts` (publish, subscribe, status)
- `keywords.service.unit.spec.ts` (extraction, matching, scoring)

### 2. Integration Tests (30% Coverage Target)
**Was wird getestet:**
- Interaktion zwischen 2-3 Modulen
- Echte Datenbank-Operationen (TestDB)
- Provider-Integration (In-Memory Queue)
- Pipeline-Workflows

**Mocking:**
- Nur externe APIs gemockt (Azure OpenAI, Blob)
- Echte Prisma-DB (Test-Container oder SQLite)
- Echte Queue-Provider (In-Memory)

**Beispiel Tests:**
- `application-pipeline.integration.spec.ts` (create → queue → generate → upload)
- `llm-pdf-generation.integration.spec.ts` (LLM → Handlebars → Puppeteer)
- `storage-blob.integration.spec.ts` (upload → retrieve SAS → download)
- `summary-translation.integration.spec.ts` (detect language → translate)
- `pdf-ats-validation.integration.spec.ts` (generate → validate ATS score)

### 3. E2E Tests (10% Coverage Target)
**Was wird getestet:**
- Vollständige User Journeys über HTTP
- Authentifizierung + Authorization
- Security Features (CSRF, Rate Limiting, XSS)
- Error Handling & Edge Cases

**Mocking:**
- Minimal (nur externe APIs wenn nötig)
- Echte DB (Test-Container)
- Echte Queue (In-Memory)

**Beispiel Journeys:**
- `auth-flow.e2e.spec.ts` (register → login → me → logout)
- `application-creation.e2e.spec.ts` (login → create profile → post job → create app → download PDF)
- `security.e2e.spec.ts` (CSRF, rate limiting, XSS sanitization)

## 🔍 Coverage Targets (Business-Kritisch)

| Module | Unit | Integration | E2E | Gesamt |
|--------|------|-------------|-----|--------|
| Auth | 95% | 90% | 100% | **95%** |
| Profile | 90% | 85% | 90% | **88%** |
| Applications | 95% | 90% | 100% | **95%** |
| LLM | 90% | 85% | 80% | **85%** |
| PDF | 85% | 90% | 85% | **87%** |
| Storage | 85% | 80% | 70% | **78%** |
| Jobs | 85% | 80% | 70% | **78%** |
| Keywords | 90% | 85% | 75% | **83%** |

**Durchschnitt:** ≥ **85% Code Coverage** für alle kritischen Module

## 🛠️ Test Helpers & Utilities

### Shared Test Utilities
```typescript
// test/helpers/test-db.helper.ts
export class TestDbHelper {
  async clearDatabase(): Promise<void>
  async seedTestData(): Promise<TestData>
}

// test/helpers/auth.helper.ts
export class AuthHelper {
  async createTestUser(): Promise<{ user, token }>
  async getAuthHeader(token: string): Headers
}

// test/helpers/mock.helper.ts
export class MockHelper {
  createMockPrismaService()
  createMockLLMService()
  createMockStorageService()
}
```

### Test Fixtures
```typescript
// test/fixtures/profile.fixture.ts
export const mockProfile = { ... }
export const mockExperiences = [ ... ]

// test/fixtures/application.fixture.ts
export const mockJobPosting = { ... }
export const mockApplication = { ... }
```

## 📊 Coverage Report Commands

```bash
# Alle Tests mit Coverage
npm run test:cov

# Nur Unit Tests
npm run test:unit

# Nur Integration Tests
npm run test:integration

# Nur E2E Tests
npm run test:e2e

# Coverage Report anzeigen
open coverage/lcov-report/index.html
```

## ✅ Test Quality Checklist

### Unit Tests
- [ ] Alle Service-Methoden getestet (Success + Error Cases)
- [ ] Guards mit verschiedenen Szenarien (authorized, unauthorized, invalid token)
- [ ] Decorators mit edge cases (null, undefined, invalid input)
- [ ] DTO Validierung (valid, invalid, missing fields)
- [ ] Error Handling (try-catch, custom exceptions)

### Integration Tests
- [ ] Pipeline-Flows von Start bis Ende
- [ ] Database Transactions (rollback on error)
- [ ] Queue Job Processing (success, retry, failure)
- [ ] Provider Switching (mock → azure)
- [ ] Async Operations (promises, timeouts)

### E2E Tests
- [ ] Authentication Flow (register, login, refresh, logout)
- [ ] Authorization (protected routes, user isolation)
- [ ] Security Headers (CORS, CSP, Helmet)
- [ ] Rate Limiting (auth strict, default limits)
- [ ] Input Sanitization (XSS, SQL Injection)
- [ ] Error Responses (400, 401, 403, 404, 429, 500)

## 🐛 Debugging Failed Tests

### Puppeteer Timeouts
```typescript
// Erhöhe Timeout für langsame Tests
jest.setTimeout(30000);

// Mock Puppeteer für schnellere Unit Tests
const mockPuppeteer = {
  launch: jest.fn().mockResolvedValue(mockBrowser),
};
```

### Database Errors
```typescript
// Verwende Test-Container oder SQLite
DATABASE_URL=postgresql://test:test@localhost:5433/test_db

// Cleanup nach jedem Test
afterEach(async () => {
  await prisma.application.deleteMany();
  await prisma.profile.deleteMany();
});
```

### Missing Dependencies
```typescript
// Alle Dependencies im TestingModule mocken
{
  provide: TemplatesService,
  useValue: {
    findById: jest.fn().mockResolvedValue(mockTemplate),
  },
}
```

## 📝 Test-Driven Development (TDD)

### Red-Green-Refactor Cycle
1. **Red:** Schreibe failing test first
2. **Green:** Implementiere minimalen Code zum Bestehen
3. **Refactor:** Optimiere Code ohne Tests zu brechen

### Beispiel Workflow
```typescript
// 1. RED: Test schreiben
it('should translate German summary to English', async () => {
  const result = await service.translateSummary('Ich bin Developer', 'en');
  expect(result).toBe('I am a Developer');
});

// 2. GREEN: Implementieren
async translateSummary(text: string, targetLang: string) {
  return await this.llmService.translate(text, targetLang);
}

// 3. REFACTOR: Optimieren
async translateSummary(text: string, targetLang: string) {
  if (!text || !targetLang) throw new BadRequestException();
  const cached = await this.cache.get(`${text}:${targetLang}`);
  if (cached) return cached;
  const result = await this.llmService.translate(text, targetLang);
  await this.cache.set(`${text}:${targetLang}`, result, 3600);
  return result;
}
```

## 🚀 Continuous Integration

### GitHub Actions Workflow
```yaml
- name: Run Unit Tests
  run: npm run test:unit --coverage
  
- name: Run Integration Tests
  run: npm run test:integration --coverage
  
- name: Run E2E Tests
  run: npm run test:e2e
  
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

### Coverage Badges
```markdown
[![Coverage](https://codecov.io/gh/smart-apply/api/branch/main/graph/badge.svg)](https://codecov.io/gh/smart-apply/api)
```

## 📚 Best Practices

1. **AAA Pattern:** Arrange → Act → Assert
2. **One Assert per Test:** Fokus auf einzelnes Behavior
3. **Descriptive Names:** `should_throw_error_when_profile_not_found`
4. **Mock External Dependencies:** Keine echten API-Calls
5. **Cleanup after Each:** Isolierte Tests ohne Side-Effects
6. **Fast Execution:** Unit Tests < 5ms, Integration < 100ms
7. **Deterministic:** Keine Flaky Tests (Random, Time)
8. **Test Coverage ≠ Quality:** Edge Cases sind wichtiger als %

## 🔄 Migration Plan

### Phase 1: Reorganisation (diese Session)
- [ ] Tests nach neuer Struktur verschieben
- [ ] Umbenennen nach Naming Conventions
- [ ] Fehlende Mocks hinzufügen
- [ ] Broken Tests fixen

### Phase 2: Coverage-Ausbau (nächste Session)
- [ ] Fehlende Unit Tests für alle Services
- [ ] Integration Tests für alle Pipelines
- [ ] E2E Tests für alle User Journeys
- [ ] Edge Cases & Error Handling

### Phase 3: Optimierung (kontinuierlich)
- [ ] Performance-Optimierung (parallele Ausführung)
- [ ] Flaky Tests eliminieren
- [ ] Coverage Badges hinzufügen
- [ ] CI/CD Integration

---

**Ziel:** Mindestens **85% Code Coverage** für alle business-kritischen Module mit qualitativ hochwertigen, wartbaren Tests.
