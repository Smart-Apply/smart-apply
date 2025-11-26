# Azure AI Foundry Agents - Quick Start

## ✅ Setup (Einmalig)

### 1. Dependencies installieren
```bash
cd apps/api
npm install
```

Dies installiert `@azure/ai-agents` SDK.

### 2. Azure Authentication konfigurieren

Du brauchst Azure CLI für `DefaultAzureCredential`:

```bash
# Azure CLI installieren (falls noch nicht vorhanden)
brew install azure-cli   # macOS
# oder: https://docs.microsoft.com/cli/azure/install-azure-cli

# Login
az login

# Subscription setzen (falls mehrere vorhanden)
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

### 3. Environment Variables setzen

Bearbeite `.env`:

```bash
# Azure AI Foundry Projekt
PROJECT_ENDPOINT=https://smart-apply-test-ai.services.ai.azure.com/api/projects/smartApplytest

# Model Deployment (schon vorhanden)
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1

# LLM Provider auf azure-ai-foundry setzen
LLM_PROVIDER=azure-ai-foundry
```

### 4. Agents erstellen

```bash
cd apps/api
npm run create-agents
```

**Output:**
```
🚀 Creating Azure AI Foundry Agents...

📍 Project Endpoint: https://smart-apply-test-ai...
🤖 Model Deployment: gpt-4.1

✅ Connected to Azure AI Foundry

📝 Creating CV Writer Agent...
✅ CV Writer Agent created: agent_ABC123

✉️  Creating CL Writer Agent...
✅ CL Writer Agent created: agent_XYZ789

═══════════════════════════════════════
✅ AGENTS CREATED SUCCESSFULLY!
═══════════════════════════════════════

📋 Add these to your .env file:

CV_WRITER_AGENT_ID=agent_ABC123
CL_WRITER_AGENT_ID=agent_XYZ789

═══════════════════════════════════════
```

### 5. Agent IDs in .env eintragen

Kopiere die IDs aus dem Output:

```bash
# In .env hinzufügen:
CV_WRITER_AGENT_ID=agent_ABC123
CL_WRITER_AGENT_ID=agent_XYZ789
```

### 6. Backend starten

```bash
npm run start:dev
```

**Erwartete Logs:**
```
[LLMModule] Using LLM provider: azure-ai-foundry
[AzureAIFoundryProvider] Azure AI Foundry Agents Client initialized successfully
```

---

## 🧪 Testen

### 1. E2E Test
```bash
cd apps/api
npm run test:e2e -- applications.e2e-spec.ts
```

### 2. Manueller Test über API

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@smartapply.com",
    "password": "Demo123!"
  }' \
  -c cookies.txt

# Application erstellen (nutzt Agents)
curl -X POST http://localhost:3000/api/v1/applications \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "jobPostingId": "YOUR_JOB_POSTING_ID"
  }' | jq
```

### 3. Logs beobachten

Im Terminal solltest du sehen:
```
[LLMService] Generating cover letter...
[AzureAIFoundryProvider] Calling CL Writer Agent for cover letter generation
[AzureAIFoundryProvider] Created thread abc-123-def for CL Writer
[AzureAIFoundryProvider] Successfully generated content with CL Writer
[AzureAIFoundryProvider] Deleted thread abc-123-def

[LLMService] Generating resume...
[AzureAIFoundryProvider] Calling CV Writer Agent for resume generation
[AzureAIFoundryProvider] Created thread xyz-789-ghi for CV Writer
[AzureAIFoundryProvider] Successfully generated content with CV Writer
[AzureAIFoundryProvider] Deleted thread xyz-789-ghi
```

---

## 🔧 Troubleshooting

### Problem: "DefaultAzureCredential failed to retrieve token"

**Lösung:**
```bash
# Azure CLI login überprüfen
az account show

# Erneut einloggen
az login

# Subscription setzen
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

### Problem: "PROJECT_ENDPOINT not configured"

**Lösung:**
Stelle sicher dass in `.env`:
```bash
PROJECT_ENDPOINT=https://smart-apply-test-ai.services.ai.azure.com/api/projects/smartApplytest
```

### Problem: "Agent IDs not configured"

**Lösung:**
1. Agents erstellen: `npm run create-agents`
2. IDs aus Output kopieren und in `.env` eintragen:
   ```bash
   CV_WRITER_AGENT_ID=agent_...
   CL_WRITER_AGENT_ID=agent_...
   ```
3. Backend neu starten

### Problem: "Agents client not initialized, using fallback"

Das ist OK! Das System nutzt automatisch Azure OpenAI als Fallback. 

**Prüfen:**
- Sind alle Environment Variables gesetzt?
- Ist Azure CLI eingeloggt? (`az account show`)
- Backend-Logs beim Start anschauen

### Problem: Agents werden erstellt, aber API nutzt sie nicht

**Lösung:**
```bash
# .env prüfen
LLM_PROVIDER=azure-ai-foundry  # MUSS gesetzt sein!
CV_WRITER_AGENT_ID=agent_...
CL_WRITER_AGENT_ID=agent_...
PROJECT_ENDPOINT=https://...

# Backend neu starten
npm run start:dev
```

---

## 📊 Wie funktioniert es?

### Agent Lifecycle pro Request

```
1. User erstellt Application
   ↓
2. LLMService erkennt: Cover Letter + Resume nötig
   ↓
3. AzureAIFoundryProvider prüft: Welcher Agent?
   ├─ Cover Letter → CL Writer Agent
   └─ Resume → CV Writer Agent
   ↓
4. Für jeden Agent:
   a. Thread erstellen
   b. User-Message senden (Prompt)
   c. Agent Run starten (createAndPoll)
   d. Auf Antwort warten (polling alle 2s)
   e. Assistant-Message auslesen
   f. Thread löschen (cleanup)
   ↓
5. Content zurück an Application Service
   ↓
6. PDFs generieren (im Background)
```

### Fallback-Logik

```
Wenn Agent-Call fehlschlägt:
  ├─ Timeout (>60s)
  ├─ Authentication Error
  ├─ Agent nicht gefunden
  └─ Sonstige Fehler
       ↓
  Log Warning: "Falling back to Azure OpenAI"
       ↓
  Nutze Azure OpenAI (single LLM)
       ↓
  Application wird trotzdem erstellt ✅
```

---

## 🎯 Nächste Schritte

### Development
- [x] Agents erstellt
- [x] Environment konfiguriert
- [x] Backend läuft mit Agents
- [ ] E2E Tests erfolgreich
- [ ] Manuelle Tests durchgeführt

### Optional: Agents löschen

Falls du Agents löschen willst:

```bash
# Azure AI Foundry Portal öffnen
# https://ai.azure.com/

# Navigiere zu: Projects → smartApplytest → Agents
# Lösche Agents manuell

# Oder via Code (erweitere create-agents.ts):
await client.deleteAgent(agentId);
```

---

## 📚 Referenzen

- **Azure AI Foundry Agents Docs**: https://ai.azure.com/doc/azure/ai-foundry/agents/quickstart
- **@azure/ai-agents SDK**: https://www.npmjs.com/package/@azure/ai-agents
- **DefaultAzureCredential**: https://learn.microsoft.com/azure/developer/javascript/sdk/authentication/local-development-environment-service-principal
- **Issue #155**: https://github.com/Ar1anit/smart-apply/issues/155

---

**Erstellt**: 26. November 2025  
**Version**: 1.0 (Azure AI Agents SDK)
