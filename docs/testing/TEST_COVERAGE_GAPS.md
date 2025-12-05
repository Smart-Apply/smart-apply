# Test Coverage Gap Analysis

## 📊 Aktueller Status

### Vorhandene Tests
**Unit Tests:** 28 Tests (verteilt in src/)
**Integration Tests:** 3 Tests (PDF, Applications)
**E2E Tests:** 11 Test-Suites in test/e2e/
**Gesamt:** ~130 Tests

### Broken Tests (zu fixen)
1. ❌ `jobs.service.spec.ts` - Missing TemplatesService mock
2. ❌ `config/env.schema.spec.ts` - TypeScript error (missing parameter)
3. ❌ `docx.parser.spec.ts` - mammoth.extractRawText undefined
4. ❌ `language-detection.spec.ts` - Missing TemplatesService mock
5. ❌ `summary-translation.integration.spec.ts` - Missing TemplatesService mock
6. ❌ `pdf-ats.integration.spec.ts` - Puppeteer timeouts (8 failed tests)

---

## 🔴 KRITISCH: Fehlende Unit Tests (Priorität 1)

### 1. Auth Module (🔐 Business-Kritisch)

#### auth.service.ts
- [x] register() - ERSTELLT ✅
- [x] login() - ERSTELLT ✅
- [x] validateUser() - ERSTELLT ✅
- [ ] logout()
- [ ] refreshTokens()
- [ ] updateUserProfile()
- [ ] changePassword()
- [ ] deleteAccount()
- [ ] revokeRefreshToken()
- [ ] revokeAllRefreshTokens()

**Benötigte Tests:** ~50 Unit Tests

#### session.service.ts
- [ ] createSession()
- [ ] deleteSession()
- [ ] deleteAllUserSessions()
- [ ] getUserSessions()
- [ ] validateSession()
- [ ] cleanupExpiredSessions()

**Benötigte Tests:** ~20 Unit Tests

#### auth.controller.ts
- [ ] register() - Controller logic
- [ ] login() - Controller logic
- [ ] me() - Controller logic
- [ ] logout() - Controller logic
- [ ] refreshTokens() - Controller logic

**Benötigte Tests:** ~15 Unit Tests

#### Guards & Strategies
- [ ] jwt.strategy.ts
- [ ] jwt-auth.guard.ts
- [ ] local.strategy.ts (if exists)

**Benötigte Tests:** ~10 Unit Tests

---

### 2. Profile Module (👤 Business-Kritisch)

#### profile.service.ts
- [ ] getProfile()
- [ ] updateProfile() - with differential updates
- [ ] updateSkills() - upsert logic
- [ ] updateExperiences() - upsert logic
- [ ] updateEducation() - upsert logic
- [ ] updateCertificates() - upsert logic
- [ ] updateProjects() - upsert logic
- [ ] updateLanguages() - upsert logic
- [ ] deleteOrphanedRelations()

**Benötigte Tests:** ~40 Unit Tests

#### profile.controller.ts
- [ ] getProfile() - Controller logic
- [ ] updateProfile() - Controller logic
- [ ] Authorization checks

**Benötigte Tests:** ~10 Unit Tests

---

### 3. Applications Module (📝 Business-Kritisch)

#### applications.service.ts
- [x] create() - VORHANDEN (zu fixen: TemplatesService mock)
- [x] findAll() - VORHANDEN
- [x] findOne() - VORHANDEN
- [ ] updateApplication()
- [ ] deleteApplication()
- [x] detectLanguage() - VORHANDEN (zu fixen)
- [x] translateSummary() - VORHANDEN (zu fixen)
- [ ] generateTitle()
- [ ] extractKeywords()
- [ ] calculateATSScore()
- [ ] getApplicationFiles() - SAS URLs

**Benötigte Tests:** ~30 Unit Tests (+ Fix 10 existing)

#### applications.controller.ts
- [ ] create() - Controller logic
- [ ] findAll() - Controller logic
- [ ] findOne() - Controller logic
- [ ] getFiles() - SAS URL generation
- [ ] downloadCoverLetter()
- [ ] downloadResume()
- [ ] Authorization checks

**Benötigte Tests:** ~20 Unit Tests

#### application.processor.ts (Queue Worker)
- [ ] processApplication()
- [ ] handleApplicationCreated()
- [ ] Error handling & retries
- [ ] Status updates

**Benötigte Tests:** ~15 Unit Tests

---

### 4. LLM Module (🤖 Business-Kritisch)

#### llm.service.ts
- [x] generate() - PARTIAL (ATS tests vorhanden)
- [x] translate() - VORHANDEN
- [ ] generateCoverLetter()
- [ ] generateResume()
- [ ] detectLanguage()
- [ ] Provider switching (mock, azure, huggingface)
- [ ] Error handling & timeouts
- [ ] Retry logic

**Benötigte Tests:** ~25 Unit Tests (+ Fix 5 existing)

#### Providers
- [ ] mock-llm.provider.ts
- [ ] azure-openai.provider.ts (mocked API calls)
- [ ] huggingface.provider.ts (mocked API calls)

**Benötigte Tests:** ~15 Unit Tests per Provider = 45 Tests

---

### 5. PDF Module (📄 Business-Kritisch)

#### pdf.service.ts
- [x] generateCoverLetterPDF() - VORHANDEN (zu fixen: Puppeteer)
- [x] generateResumePDF() - VORHANDEN (zu fixen: Puppeteer)
- [ ] validateATS() - PARTIAL
- [ ] renderTemplate() - Handlebars
- [ ] optimizeForATS()
- [ ] Error handling

**Benötigte Tests:** ~20 Unit Tests (+ Fix 10 existing)

#### ats-validator.service.ts
- [x] validate() - VORHANDEN
- [x] checkFonts() - VORHANDEN
- [x] checkComplexity() - VORHANDEN
- [x] checkMetadata() - VORHANDEN
- [ ] generateReport()

**Benötigte Tests:** ~10 Unit Tests (+ enhance existing)

#### template-renderer.service.ts
- [x] render() - VORHANDEN
- [ ] Error handling for missing templates
- [ ] Variable injection

**Benötigte Tests:** ~5 Unit Tests (+ enhance existing)

---

### 6. Storage Module (💾 Priorität HOCH)

#### storage.service.ts
- [ ] upload() - Provider abstraction
- [ ] download() - Provider abstraction
- [ ] delete() - Provider abstraction
- [ ] getSignedUrl() - SAS generation
- [ ] exists()
- [ ] Provider switching (disk, azure-blob)

**Benötigte Tests:** ~20 Unit Tests

#### Providers
- [ ] disk-storage.provider.ts
- [ ] azure-blob-storage.provider.ts (mocked Azure SDK)

**Benötigte Tests:** ~20 Unit Tests

---

### 7. Jobs Module (🔄 Priorität HOCH)

#### jobs.service.ts
- [x] publishJob() - VORHANDEN (zu fixen: TemplatesService)
- [x] getJobStatus() - VORHANDEN
- [x] subscribeToQueue() - VORHANDEN
- [x] healthCheck() - VORHANDEN
- [ ] Provider switching (in-memory, service-bus)
- [ ] Error handling

**Benötigte Tests:** ~10 Unit Tests (+ Fix 5 existing)

#### Providers
- [x] in-memory-queue.provider.ts - VORHANDEN ✅
- [ ] service-bus.provider.ts (mocked Azure SDK)

**Benötigte Tests:** ~15 Unit Tests (1 provider done)

---

### 8. Keywords Module (🔍 Priorität HOCH)

#### keywords.service.ts
- [x] extractKeywords() - VORHANDEN ✅
- [x] matchKeywords() - VORHANDEN ✅
- [x] calculateScore() - VORHANDEN ✅
- [x] detectLanguage() - VORHANDEN ✅
- [ ] categorizeSkills()
- [ ] weightSkills()

**Benötigte Tests:** ~10 Unit Tests (+ enhance existing)

---

### 9. Job-Postings Module (📋 Priorität MITTEL)

#### job-postings.service.ts
- [x] parse() - VORHANDEN (basic)
- [ ] parseFromText()
- [ ] parseFromUrl()
- [ ] parseFromFile()
- [ ] normalizeJobPosting()
- [ ] extractRequirements()
- [ ] detectLanguage()

**Benötigte Tests:** ~20 Unit Tests (+ enhance existing)

#### Parsers
- [x] text.parser.ts - VORHANDEN ✅
- [x] url.parser.ts - VORHANDEN ✅
- [x] docx.parser.ts - VORHANDEN (zu fixen)
- [ ] pdf.parser.ts

**Benötigte Tests:** ~15 Unit Tests (+ fix DOCX parser)

---

### 10. Common Module (🛠️ Priorität MITTEL)

#### Guards
- [x] custom-throttler.guard.ts - VORHANDEN ✅
- [ ] jwt-auth.guard.ts (if separate)
- [ ] roles.guard.ts (if exists)

#### Decorators
- [ ] @Sanitize() decorator
- [ ] @UseThrottler() decorator
- [ ] @CurrentUser() decorator

#### Filters
- [ ] all-exceptions.filter.ts
- [ ] validation.filter.ts

#### Interceptors
- [ ] logging.interceptor.ts
- [ ] transform.interceptor.ts

**Benötigte Tests:** ~20 Unit Tests

---

### 11. Config Module (⚙️ Priorität NIEDRIG)

#### env.schema.ts
- [x] validateEnv() - VORHANDEN (zu fixen: TypeScript error)
- [ ] JWT validation
- [ ] CORS validation
- [ ] Provider validation

**Benötigte Tests:** ~10 Unit Tests (+ fix existing)

---

### 12. Templates Module (🎨 Priorität NIEDRIG)

#### templates.service.ts
- [ ] findById()
- [ ] findAll()
- [ ] findByLanguage()
- [ ] getDefaultTemplate()

**Benötigte Tests:** ~10 Unit Tests

---

## 🟡 MITTEL: Fehlende Integration Tests (Priorität 2)

### 1. Application Pipeline
- [ ] `application-pipeline.integration.spec.ts`
  - Full flow: create → queue → generate → upload → ready
  - Status transitions: PENDING → GENERATING → READY
  - Error handling: FAILED status
  - Retry logic

**Benötigte Tests:** ~15 Integration Tests

### 2. LLM + PDF Pipeline
- [ ] `llm-pdf-generation.integration.spec.ts`
  - LLM generates content → PDF service renders → Storage uploads
  - Language detection → Template selection → PDF generation
  - ATS validation after generation

**Benötigte Tests:** ~10 Integration Tests

### 3. Storage + Azure Blob
- [ ] `storage-blob.integration.spec.ts`
  - Upload to Blob → Retrieve SAS URL → Download
  - Provider switching: disk → azure-blob
  - Error handling: connection failures

**Benötigte Tests:** ~10 Integration Tests

### 4. Jobs + Service Bus
- [ ] `jobs-servicebus.integration.spec.ts`
  - Publish to Service Bus → Worker processes → Status update
  - Provider switching: in-memory → service-bus
  - Error handling & retries

**Benötigte Tests:** ~10 Integration Tests

### 5. Keywords + ATS Scoring
- [ ] `keywords-ats.integration.spec.ts`
  - Extract keywords → Match with job posting → Calculate score
  - Language detection → Keyword extraction
  - Weighted scoring

**Benötigte Tests:** ~8 Integration Tests

### 6. Auth + Sessions
- [ ] `auth-sessions.integration.spec.ts`
  - Login → Create session → Refresh token → Logout
  - Multi-device sessions
  - Session cleanup cron

**Benötigte Tests:** ~10 Integration Tests

---

## 🟢 NIEDRIG: Fehlende E2E Tests (Priorität 3)

E2E Tests sind bereits gut abgedeckt (11 test suites in test/e2e/):
- ✅ auth/auth.e2e-spec.ts
- ✅ auth/auth-refresh.e2e-spec.ts
- ✅ auth/sessions.e2e-spec.ts
- ✅ auth/settings.e2e-spec.ts
- ✅ features/applications.e2e-spec.ts
- ✅ features/job-postings.e2e-spec.ts
- ✅ features/profile.e2e-spec.ts
- ✅ features/uploads.e2e-spec.ts
- ✅ security/audit-logging.e2e-spec.ts
- ✅ security/cors.e2e-spec.ts
- ✅ security/csp-headers.e2e-spec.ts
- ✅ security/csrf.e2e-spec.ts
- ✅ security/rate-limit.e2e-spec.ts
- ✅ security/xss-sanitization.e2e-spec.ts

### Fehlende E2E Tests:
- [ ] Complete application flow (register → profile → job → apply → download)
- [ ] PDF download & preview workflow
- [ ] Error scenarios (500, 400, 404 responses)
- [ ] Multi-language application flow (DE/EN)

**Benötigte Tests:** ~10 E2E Tests

---

## 📈 Zusammenfassung

### Fehlende Tests nach Priorität

| Priorität | Kategorie | Anzahl Tests | Geschätzter Aufwand |
|-----------|-----------|--------------|---------------------|
| **🔴 KRITISCH** | Unit Tests (Auth, Profile, Apps, LLM, PDF) | ~400 | 10-15 Tage |
| **🟡 MITTEL** | Unit Tests (Storage, Jobs, Keywords, etc.) | ~150 | 5-7 Tage |
| **🟡 MITTEL** | Integration Tests | ~63 | 3-5 Tage |
| **🟢 NIEDRIG** | E2E Tests | ~10 | 1-2 Tage |
| **Broken Tests** | Fixes für vorhandene Tests | ~40 | 1-2 Tage |

**GESAMT:** ~663 neue Tests + 40 Fixes = **~700 Tests**
**GESAMTAUFWAND:** ~20-30 Arbeitstage

### Coverage-Ziele

| Modul | Aktuell (geschätzt) | Ziel | Fehlende Tests |
|-------|---------------------|------|----------------|
| Auth | 15% | 95% | ~95 |
| Profile | 0% | 88% | ~50 |
| Applications | 30% | 95% | ~50 |
| LLM | 40% | 85% | ~45 |
| PDF | 50% | 87% | ~35 |
| Storage | 0% | 78% | ~40 |
| Jobs | 60% | 78% | ~25 |
| Keywords | 70% | 83% | ~20 |
| Job-Postings | 40% | 75% | ~35 |
| Common | 10% | 70% | ~20 |

**Durchschnitt aktuell:** ~30%
**Durchschnitt Ziel:** ~85%

---

## 🎯 Empfohlene Vorgehensweise

### Phase 1: Broken Tests fixen (2 Tage)
1. TemplatesService Mocks hinzufügen (10 Tests)
2. TypeScript Fehler beheben (env.schema.spec.ts)
3. Puppeteer Timeouts lösen (PDF tests)
4. DOCX Parser fixen (mammoth integration)

### Phase 2: Critical Unit Tests (10-15 Tage)
1. **Auth Module** (95% target) - 3 Tage
   - auth.service.ts (50 tests)
   - session.service.ts (20 tests)
   - Guards & Strategies (10 tests)

2. **Profile Module** (88% target) - 2 Tage
   - profile.service.ts (40 tests)
   - Differential updates logic

3. **Applications Module** (95% target) - 3 Tage
   - applications.service.ts (30 tests)
   - application.processor.ts (15 tests)
   - Controller tests (20 tests)

4. **LLM Module** (85% target) - 3 Tage
   - llm.service.ts (25 tests)
   - Provider tests (45 tests)

5. **PDF Module** (87% target) - 2 Tage
   - pdf.service.ts (20 tests)
   - ATS validation (10 tests)

### Phase 3: High-Priority Unit Tests (5-7 Tage)
6. **Storage Module** (78% target) - 2 Tage
7. **Jobs Module** (78% target) - 2 Tage
8. **Keywords Module** (83% target) - 1 Tag
9. **Job-Postings Module** (75% target) - 2 Tage

### Phase 4: Integration Tests (3-5 Tage)
10. Application Pipeline (2 Tage)
11. LLM + PDF + Storage (2 Tage)
12. Jobs + Service Bus (1 Tag)

### Phase 5: E2E Tests (1-2 Tage)
13. Complete user journeys
14. Error scenarios

---

## 🛠️ Tools & Commands

```bash
# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only e2e tests
npm run test:e2e

# Run all tests with coverage
npm run test:all:cov

# Open coverage report
open coverage/lcov-report/index.html

# Run specific test file
npm run test:unit -- auth.service.unit.spec.ts

# Watch mode for TDD
npm run test:unit:watch
```

---

**Stand:** 5. Dezember 2025
**Dokument aktualisieren nach:** Jeder abgeschlossenen Phase
