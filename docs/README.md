# Smart Apply - Dokumentation

Übersicht über die gesamte Projektdokumentation, organisiert nach Kategorien.

## 📁 Ordnerstruktur

### 🔒 [security/](./security/)

Sicherheitsbezogene Dokumentation und Best Practices

- **SECURITY.md** - Umfassende Sicherheitsdokumentation
- **CORS_SECURITY.md** - CORS Konfiguration und Sicherheit
- **XSS_PROTECTION.md** - XSS-Schutzmaßnahmen
- **AUDIT_LOGGING.md** - Audit-Logging System
- **RATE_LIMITING.md** - Rate Limiting Strategie
- **CSP_BACKEND.md** - Content Security Policy
- **REFRESH_TOKENS.md** - Refresh Token Implementation

### ✨ [features/](./features/)

Feature-Dokumentation und technische Guides

- **TEMPLATE_GUIDE.md** - Template-System Anleitung (Neue Templates erstellen)
- **PDF_GENERATION.md** - PDF-Generierung System
- **PDF_IMPROVEMENTS.md** - PDF-Verbesserungen
- **PDF_DOWNLOAD_PREVIEW.md** - PDF Download & Preview
- **SSE_IMPLEMENTATION.md** - Server-Sent Events Implementation

### 🔧 [implementation/](./implementation/)

Implementierungs-Details und technische Summaries

- **WIZARD_IMPLEMENTATION.md** - Application Wizard Implementation
- **APPLICATIONS_DASHBOARD_IMPLEMENTATION.md** - Dashboard Implementation
- **IMPLEMENTATION_SUMMARY.md** - Allgemeine Implementation Summary
- **REFRESH_TOKEN_IMPLEMENTATION_SUMMARY.md** - Refresh Token Details
- **SSE_INTEGRATION_EXAMPLE.md** - SSE Integration Beispiele

### 📚 [guides/](./guides/)

Benutzer- und Entwickler-Guides

- **README-APPLICATION-WIZARD.md** - Application Wizard Benutzerguide
- **TESTING_GUIDE.md** - Testing Best Practices
- **AGENT_URL_PARSER.md** - URL Parser Agent Dokumentation
- **AZURE_AI_FOUNDRY_AGENTS.md** - Azure AI Foundry Agents Integration 🆕
- **MONOREPO_WORKSPACE.md** - Workspace Architecture Guide
- **MVP_EVALUATION.md** - MVP Evaluation Metrics
- **TEMPLATE_GUIDE.md** - Template System Guide

### 🔨 [scripts/](./scripts/)

Utility Scripts und Testing Tools

- **test-cors-manual.sh** - Manueller CORS Test

### 📦 [archive/](./archive/)

Ältere Projektdokumentation und historische Dateien

- **APPLICATIONS_UI_MOCKUP.md** - UI Mockup Designs
- **DELIVERY.md** - Delivery Notes
- **PR_SUMMARY.md** - Pull Request Summaries
- **STATUS.md** - Projekt Status (historisch)

---

## 🚀 Quick Links

### Für Entwickler

- [Template erstellen](./features/TEMPLATE_GUIDE.md) - Neue Templates hinzufügen
- [Testing Guide](./guides/TESTING_GUIDE.md) - Tests schreiben und ausführen
- [Wizard Implementation](./implementation/WIZARD_IMPLEMENTATION.md) - Application Wizard verstehen
- [Azure AI Foundry Agents](./guides/AZURE_AI_FOUNDRY_AGENTS.md) - AI Agents Integration 🆕

### Für DevOps

- [Security Overview](./security/SECURITY.md) - Sicherheitsmaßnahmen
- [Rate Limiting](./security/RATE_LIMITING.md) - Rate Limit Konfiguration
- [Audit Logging](./security/AUDIT_LOGGING.md) - Logging Setup

### Für Product/Design

- [Application Wizard Guide](./guides/README-APPLICATION-WIZARD.md) - Benutzerführung
- [UI Mockups](./archive/APPLICATIONS_UI_MOCKUP.md) - Design Konzepte

---

## 📖 Dokumentations-Guidelines

### Neue Dokumentation hinzufügen

1. **Sicherheit** → `security/` - Alles rund um Auth, CORS, XSS, CSP, etc.
2. **Features** → `features/` - Feature-Dokumentation, How-To Guides
3. **Implementation** → `implementation/` - Technische Details, Architektur
4. **Guides** → `guides/` - Benutzer- und Entwickler-Anleitungen
5. **Scripts** → `scripts/` - Utility Scripts, Testing Tools
6. **Archive** → `archive/` - Veraltete oder historische Dokumentation

### Naming Conventions

- **UPPERCASE_WITH_UNDERSCORES.md** für technische Docs
- **kebab-case.md** für User-Guides
- **PascalCase.md** für Feature-Spezifikationen

### Markdown Standards

- Verwende klare Überschriften (H1, H2, H3)
- Code-Beispiele mit Syntax Highlighting
- Inhaltsverzeichnis bei langen Dokumenten
- Datum bei zeitkritischen Informationen

---

## 🔄 Letzte Aktualisierung

**Datum:** 23. November 2025  
**Organisiert von:** AI Assistant  
**Struktur:** 6 Hauptkategorien + Archive
