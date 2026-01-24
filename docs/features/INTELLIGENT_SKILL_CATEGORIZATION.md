# Intelligente Skill-Kategorisierung mit LLM

## Übersicht

Das System verwendet jetzt ein Large Language Model (LLM), um Skills im Lebenslauf automatisch in logische, branchenspezifische Kategorien zu gruppieren. Dies ersetzt die vorherige statische Kategorisierung, bei der alle Skills unter "General" oder manuell gesetzten Kategorien erschienen.

## Features

### 🎯 Intelligente Kategorisierung

- **Branchenunabhängig**: Funktioniert für IT, Marketing, Healthcare, Finance, Sales und alle anderen Branchen
- **Kontextbasiert**: Analysiert den Kandidaten-Hintergrund (Jobtitel, Erfahrungen, Zusammenfassung)
- **Automatische Branchenerkennung**: Erkennt automatisch die Branche aus dem Profil
- **3-6 Kategorien**: Erstellt eine übersichtliche Anzahl an sinnvollen Kategorien

### 🚀 Performance

- **In-Memory Caching**: Skills werden nur einmal kategorisiert und dann gecached
- **Cache-Limit**: Maximal 100 Cache-Einträge zur Speicherschonung
- **Order-Independent**: Der Cache funktioniert unabhängig von der Skill-Reihenfolge

### 🔄 Fallback-Strategie

- **LLM-Fehler**: Falls das LLM nicht verfügbar ist, wird die alte Kategorisierung verwendet
- **Keine Skills**: Wenn keine Skills vorhanden sind, gibt es keine Kategorien
- **Robustheit**: Das System funktioniert auch bei LLM-Ausfällen weiter

## Beispiele

### IT/Software Developer

```json
{
  "skillCategories": [
    {
      "type": "Programming Languages",
      "skills": ["Java", "Python", "TypeScript"]
    },
    {
      "type": "Frontend Frameworks",
      "skills": ["React", "Vue.js", "Angular"]
    },
    {
      "type": "Cloud & DevOps",
      "skills": ["Azure", "Docker", "Kubernetes", "CI/CD"]
    },
    {
      "type": "Databases",
      "skills": ["PostgreSQL", "MongoDB", "Redis"]
    }
  ]
}
```

### Marketing Manager

```json
{
  "skillCategories": [
    {
      "type": "Digital Marketing",
      "skills": ["SEO", "SEM", "Google Ads", "Email Marketing"]
    },
    {
      "type": "Content Creation",
      "skills": ["Copywriting", "Video Production", "Graphic Design"]
    },
    {
      "type": "Analytics Tools",
      "skills": ["Google Analytics", "HubSpot", "Tableau"]
    },
    {
      "type": "Social Media Platforms",
      "skills": ["LinkedIn", "Instagram", "Facebook", "Twitter"]
    }
  ]
}
```

### Healthcare Professional

```json
{
  "skillCategories": [
    {
      "type": "Clinical Skills",
      "skills": ["Patient Care", "Vital Signs Monitoring", "IV Therapy"]
    },
    {
      "type": "Medical Equipment",
      "skills": ["EKG Machine", "Defibrillator", "Infusion Pumps"]
    },
    {
      "type": "Software Systems",
      "skills": ["EPIC", "Cerner", "Meditech"]
    },
    {
      "type": "Certifications",
      "skills": ["BLS", "ACLS", "PALS"]
    }
  ]
}
```

## Technische Details

### Architektur

```text
ApplicationsService
  ├─> categorizeSkillsWithLLM()
  │     ├─> Cache Check (in-memory Map)
  │     ├─> LLMService.categorizeSkills()
  │     │     └─> LLM Provider (Azure OpenAI / HuggingFace / Mock)
  │     └─> Cache Update
  │
  └─> buildResumeTemplateData(profile, skillCategories)
        └─> buildSkillCategoriesWithCustom()
              ├─> Use LLM categories (if provided)
              └─> Fallback to database categories
```

### LLM-Prompt

Das LLM erhält:

1. **Skills-Liste**: Alle Skills als komma-separierte Liste
2. **Kandidaten-Kontext**: Jobtitel + Firma oder Zusammenfassung
3. **Branche**: Automatisch erkannt (IT, Marketing, Healthcare, etc.) oder "auto-detect"

Das LLM gibt zurück:

- JSON-Array mit Kategorie-Namen und zugehörigen Skills
- Temperatur: 0.3 (niedriger für konsistente Kategorisierung)
- Max Tokens: 1000

### Code-Beispiel

```typescript
// LLM Service
const categories = await llmService.categorizeSkills({
  skills: ['Java', 'Python', 'React', 'Docker'],
  candidateContext: 'Senior Software Engineer with experience in TechCorp',
  industry: 'IT/Software Development'
});

// Result
[
  { type: "Programming Languages", skills: ["Java", "Python"] },
  { type: "Frontend Frameworks", skills: ["React"] },
  { type: "DevOps Tools", skills: ["Docker"] }
]
```

## Integration

Die Skill-Kategorisierung wird automatisch in folgenden Fällen durchgeführt:

1. **Application Creation** (`POST /api/v1/applications`)
   - Beim Erstellen einer neuen Bewerbung
   - Skills werden aus dem Profil geladen und kategorisiert

2. **Application with Generation** (`POST /api/v1/applications/generate`)
   - Beim Erstellen mit sofortiger Cover Letter/Resume-Generierung
   - Skills werden kategorisiert und in den Lebenslauf übernommen

3. **Resume Update** (`PUT /api/v1/applications/:id/resume`)
   - Wenn der Benutzer den Lebenslauf manuell bearbeitet
   - Die Kategorien bleiben erhalten oder können manuell angepasst werden

## Logging

Das System loggt folgende Events:

```text
[ApplicationsService] Categorizing 12 skills for Senior Software Engineer with experience in TechCorp (Industry: IT/Software Development)
[ApplicationsService] LLM categorized skills into 4 categories
[ApplicationsService] Using cached skill categorization for 12 skills (bei Cache-Hit)
```

## Konfiguration

### Environment Variables

Keine zusätzlichen Environment Variables erforderlich. Die Feature nutzt die bestehende LLM-Konfiguration:

```bash
# LLM Provider (mock, azure-openai, huggingface)
LLM_PROVIDER=azure-openai

# Azure OpenAI (wenn azure-openai Provider)
AZURE_OPENAI_ENDPOINT=https://your-aoai.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
```

### Cache-Konfiguration

```typescript
// In ApplicationsService
private readonly skillCategorizationCache = new Map<string, ...>();

// Cache-Limit: 100 Einträge (ältester wird gelöscht)
if (this.skillCategorizationCache.size > 100) {
  const firstKey = this.skillCategorizationCache.keys().next().value;
  this.skillCategorizationCache.delete(firstKey);
}
```

## Testing

### Unit Tests

```typescript
describe('categorizeSkillsWithLLM', () => {
  it('should categorize IT skills into logical groups', async () => {
    const profile = {
      skills: [
        { name: 'Java' },
        { name: 'React' },
        { name: 'Docker' }
      ],
      experiences: [
        { title: 'Software Engineer', company: 'TechCorp' }
      ]
    };

    const categories = await service['categorizeSkillsWithLLM'](profile);

    expect(categories).toHaveLength(3);
    expect(categories[0].type).toBe('Programming Languages');
  });

  it('should use cache on subsequent calls', async () => {
    // First call
    await service['categorizeSkillsWithLLM'](profile);

    // Second call (should use cache)
    const spy = jest.spyOn(llmService, 'categorizeSkills');
    await service['categorizeSkillsWithLLM'](profile);

    expect(spy).not.toHaveBeenCalled();
  });
});
```

### E2E Tests

```bash
# Test application creation with skill categorization
cd apps/api
npm run test:e2e -- --testNamePattern="Application creation"
```

## Performance-Überlegungen

### Cache-Strategie

- **Memory Usage**: Ca. 1-2 KB pro Cache-Eintrag
- **Max Memory**: ~200 KB bei 100 Einträgen (vernachlässigbar)
- **Cache-Hit-Rate**: Hoch bei wiederholten Bewerbungen desselben Users

### LLM-Kosten

- **Tokens pro Request**: ~300-500 Tokens (Input) + ~200-300 Tokens (Output)
- **Kosten (GPT-4)**: ~$0.01 pro Kategorisierung
- **Einsparung durch Cache**: 90%+ bei typischer Nutzung

### Latenz

- **Mit Cache**: < 1ms
- **Ohne Cache (LLM-Call)**: 1-3 Sekunden (abhängig vom Provider)
- **Fallback**: < 1ms (sofort)

## Zukünftige Verbesserungen

### Phase 2 (Optional)

- [ ] **Persistent Cache**: Redis oder DB für Cache-Persistenz
- [ ] **User-Präferenzen**: Benutzer kann Kategorien manuell überschreiben
- [ ] **Feedback-Loop**: Benutzer-Feedback zur Verbesserung der Kategorisierung
- [ ] **Multi-Language**: Skill-Namen in verschiedenen Sprachen

### Phase 3 (Optional)

- [ ] **Job-Kontext**: Skills basierend auf Job Posting kategorisieren
- [ ] **Skill-Priorisierung**: Wichtigste Skills zuerst
- [ ] **Skill-Synonyme**: Gruppierung ähnlicher Skills (z.B. "React.js" und "ReactJS")

## Troubleshooting

### Problem: Skills erscheinen alle unter "Skills"

**Ursache**: LLM-Provider nicht verfügbar oder Fehler beim LLM-Call

**Lösung**:

1. Prüfe Logs für LLM-Fehler
2. Verifiziere `LLM_PROVIDER` Environment Variable
3. Teste LLM-Provider: `curl -X POST http://localhost:3000/api/v1/test-llm`

### Problem: Cache wächst zu groß

**Ursache**: Viele verschiedene Skill-Kombinationen

**Lösung**:

- Cache-Limit ist bereits auf 100 gesetzt (automatische Bereinigung)
- Bei Bedarf Limit anpassen oder Redis implementieren

### Problem: Kategorisierung ist inkonsistent

**Ursache**: LLM-Temperatur zu hoch oder unterschiedlicher Kontext

**Lösung**:

- Temperatur ist bereits auf 0.3 reduziert (niedriger = konsistenter)
- Stelle sicher, dass Profil-Daten konsistent sind

## Migration

### Bestehende Applications

- Alte Applications behalten ihre bestehenden Kategorien
- Neue Applications verwenden automatisch die LLM-Kategorisierung
- Keine Migration erforderlich

### Skill-Daten

- Das `category` Feld in der Datenbank wird weiterhin als Fallback verwendet
- Benutzer können weiterhin manuell Kategorien setzen
- LLM überschreibt nur, wenn keine manuellen Kategorien gesetzt sind

## Siehe auch

- [LLM Service Documentation](../guides/LLM_SERVICE.md)
- [Resume Template Documentation](../guides/TEMPLATE_GUIDE.md)
- [ATS Optimization](./ATS_OPTIMIZATION.md)
