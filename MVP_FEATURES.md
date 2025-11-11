# 🚀 Smart Apply – MVP Feature List (Architecture-Aligned)

| Category | Feature | Description | Implemented | Needed for MVP | Phase |
|-----------|----------|--------------|--------------|----------------|--------|
| **Auth** | User Registration & Login | Email/password signup with JWT auth guard | ✅ Done | 🔄 Frontend forms for register/login | MVP |
| **Auth** | Authenticated API Access | Protect routes using JWT & guards | ✅ Done | — | MVP |
| **Profile** | Profile CRUD | Manage user info (name, contact, summary) | ✅ Done | 🔄 UI integration (view/edit form) | MVP |
| **Profile** | Experience / Education / Projects / Certificates | Structured profile sections with 1-N relations | ✅ Done | 🔄 Basic UI for editing/adding | MVP |
| **Profile** | Profile Persistence | Store profile data in PostgreSQL | ✅ Done | — | MVP |
| **Job Postings** | Job Parsing via URL | Parse job data from LinkedIn / Indeed | ✅ Done | 🔄 Minimal UI to input and show parsed data | MVP |
| **Job Postings** | Manual Job Input | Paste job description manually if parsing fails | 🧩 Partial | 🔄 Extend controller + simple UI | MVP |
| **Job Postings** | Job Storage | Save parsed or pasted job postings in DB | ✅ Done | — | MVP |
| **Applications** | Create Application | Start generation pipeline with `jobPostingId` | ✅ Done | 🔄 Frontend action (Generate button) | MVP |
| **Applications** | Application Queue (Service Bus) | Background job processing for generation | ✅ Done | — | MVP |
| **Applications** | Application Status Updates | Track `PENDING → GENERATING → READY → FAILED` | ✅ Done | 🔄 Display on UI | MVP |
| **Applications** | Application List | List all user applications | 🧩 Controller ready | 🔄 UI (table or list view) | MVP |
| **Applications** | Application Detail View | Show job + generated CL + CV + status | ✅ Done | 🔄 UI layout | MVP |
| **AI / LLM** | Cover Letter Generation | Generate personalized text using template | ✅ Done | 🔄 Polish prompt template | MVP |
| **AI / LLM** | Resume Generation | Generate resume markdown from profile | ✅ Done | 🔄 Polish prompt template | MVP |
| **AI / LLM** | Template Rendering Engine | Handlebars/Markdown template rendering | ✅ Done | — | MVP |
| **PDF** | PDF Generation | Puppeteer converts markdown → PDF | ✅ Done | — | MVP |
| **PDF** | PDF Styling Templates | Default HTML/CSS for layout | ✅ Done | 🔄 Review visual consistency | MVP |
| **Storage** | Azure Blob Upload | Upload PDFs & generate SAS URLs | ✅ Done | — | MVP |
| **Storage** | File Retrieval | Return time-limited URLs for user download | ✅ Done | 🔄 Frontend download buttons | MVP |
| **Frontend / UX** | Dashboard | Overview of all applications | 🧩 Partial | 🔄 Implement basic list view | MVP |
| **Frontend / UX** | Form Wizard | Step 1: Profile → Step 2: Job → Step 3: Generate | 🧩 Partial | 🔄 Implement flow | MVP |
| **Frontend / UX** | Loading & Error States | Indicate generation progress & errors | 🧩 Partial | 🔄 Implement | MVP |
| **Frontend / UX** | Download PDFs | Buttons for CL/CV | 🧩 Partial | 🔄 Add to detail view | MVP |
| **System / DevOps** | Environment Config & Key Vault | Managed secrets for DB, LLM, Blob, Service Bus | ✅ Done | — | MVP |
| **System / DevOps** | Rate Limiting | Prevent abuse of free tier | ✅ Done | — | MVP |
| **System / DevOps** | Logging & Error Tracking | Centralized error filter + logs | ✅ Done | — | MVP |
| **System / DevOps** | Swagger Docs | Document all public endpoints | 🧩 Optional | 🔄 Enable for dev/testing | MVP |
| **Security** | Strong JWT Secret | Generate secure JWT secret (64+ chars) | ⚠️ Partial | 🔴 Critical for Production | MVP |
| **Security** | Restrictive CORS | Limit origins to frontend domain only | ⚠️ Partial | 🔴 Critical for Production | MVP |
| **Security** | HttpOnly Cookies | Move JWT from localStorage to secure cookies | ❌ Not yet | 🔴 Critical (XSS protection) | MVP |
| **Security** | Password Strength Validation | Enforce strong passwords (8+ chars, mixed case, numbers, symbols) | ⚠️ Partial | 🟡 High Priority | MVP |
| **Security** | Strict Rate Limiting | Limit auth endpoints to 5 attempts/15min | ⚠️ Partial | 🟡 High Priority | MVP |
| **Security** | CSRF Protection | Add CSRF tokens for state-changing requests | ❌ Not yet | 🟡 High Priority | MVP |
| **Security** | Input Sanitization (XSS) | Sanitize user inputs (DOMPurify frontend, backend validation) | ❌ Not yet | 🟡 High Priority | MVP |
| **Security** | Token Refresh Strategy | Implement refresh tokens (avoid 7-day expiration logout) | ❌ Not yet | 🟡 High Priority | MVP |
| **Security** | Security Headers (Frontend) | Add CSP, X-Frame-Options in Next.js config | ❌ Not yet | 🟢 Medium Priority | MVP |
| **Security** | Audit Logging | Log security events (failed logins, suspicious activity) | ❌ Not yet | 🟢 Medium Priority | Post-MVP |
| **Security** | Content Security Policy (CSP) | Prevent XSS with strict CSP headers | ❌ Not yet | 🟢 Medium Priority | Post-MVP |
| **Security** | Session Management | Track active sessions for multi-device logout | ❌ Not yet | 🟢 Low Priority | Post-MVP |
| **Security** | Two-Factor Authentication (2FA) | TOTP-based 2FA (Google Authenticator) | ❌ Not yet | 🟢 Low Priority | Post-MVP |
| **Post-MVP** | ATS Keyword Matching | Evaluate profile/job overlap semantically | ❌ Not yet | — | Phase 2 |
| **Post-MVP** | Gmail/Outlook Integration | Track application responses | ❌ Not yet | — | Phase 2 |
| **Post-MVP** | Analytics Dashboard | Show metrics (applications, success rates) | ❌ Not yet | — | Phase 2 |
| **Post-MVP** | White-Label / API Tier | Partner integrations (job boards, agencies) | ❌ Not yet | — | Phase 3 |
| **Post-MVP** | Mobile App | React Native / PWA | ❌ Not yet | — | Phase 3 |

---

## 🔒 Security Status Summary

**Current Security Score: 6/10**

### Critical Issues (Must Fix Before Production) 🔴
1. **JWT Secret:** Currently uses weak default, needs 64+ char random string
2. **CORS Origins:** Not restrictive enough, allow only specific frontend URLs
3. **Token Storage:** localStorage is XSS-vulnerable, use HttpOnly cookies

### High Priority (MVP Launch) 🟡
4. **Password Strength:** Only requires 6+ chars, needs complexity rules
5. **Rate Limiting:** Too liberal, tighten auth endpoints to 5/15min
6. **CSRF Protection:** No CSRF tokens for state-changing operations
7. **XSS Protection:** Missing input sanitization (DOMPurify/validator)
8. **Refresh Tokens:** No refresh strategy, 7-day expiration forces logout

### Medium Priority (Post-Launch) 🟢
9. **CSP Headers:** No Content Security Policy
10. **Audit Logs:** No security event tracking
11. **Security Headers:** Missing frontend security headers

### Low Priority (Future) 🟢
12. **Session Management:** No multi-device session tracking
13. **2FA:** No two-factor authentication

---

✅ **Implementation Summary**
- Back-end foundation: 90% complete
- Security foundation: 60% complete (production-ready requires fixes)
- MVP gaps: front-end UX, security hardening, simple templates
- Infrastructure (Azure, LLM, Queue, Storage) already production-grade
