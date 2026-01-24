# Template Guide - Neue Vorlagen hinzufügen

Diese Anleitung erklärt, wie du neue Templates mit komplett eigenem Design zum Smart Apply System hinzufügst.

## Übersicht

Das Template-System besteht aus drei Komponenten:

1. **HTML Template** (Handlebars `.hbs`) - Die Struktur des Dokuments
2. **CSS Styles** - Das visuelle Design
3. **Database Entry** - Metadaten und Registrierung

## Quick Start - Template-Variante erstellen

Für schnelle Farb-/Style-Varianten existierender Templates:

```bash
cd apps/api
npx tsx prisma/seed-templates.ts
```

Bearbeite `apps/api/prisma/seed-templates.ts` und füge hinzu:

```typescript
await prisma.template.upsert({
  where: { id: 'elegant-resume' },
  update: {},
  create: {
    id: 'elegant-resume',
    name: 'Elegant Resume',
    description: 'Sophisticated design with serif fonts',
    type: TemplateType.RESUME,
    category: 'Elegant',
    htmlTemplate: resumeHTML, // Verwendet existierendes Template
    cssStyles: baseResumeCSS.replace(/#0066cc/g, '#e11d48'), // Farbe ändern
    isActive: true,
    isDefault: false,
  },
});
```

## Komplett neues Design erstellen

### Schritt 1: HTML Template erstellen

Erstelle eine neue `.hbs` Datei in `apps/api/src/pdf/templates/`

**Beispiel:** `apps/api/src/pdf/templates/creative-resume.hbs`

```handlebars
<html>
  <head>
    <meta charset='UTF-8' />
  </head>
  <body>
    <div class='resume-container'>
      <!-- Header mit Name und Kontakt -->
      <header class='header'>
        <h1 class='name'>{{candidateName}}</h1>
        <div class='contact-info'>
          {{#if email}}<span>{{email}}</span>{{/if}}
          {{#if phone}}<span>{{phone}}</span>{{/if}}
          {{#if location}}<span>{{location}}</span>{{/if}}
        </div>
      </header>

      <!-- Zusammenfassung -->
      {{#if summary}}
        <section class='summary'>
          <h2>Profil</h2>
          <p>{{summary}}</p>
        </section>
      {{/if}}

      <!-- Skills -->
      {{#if skillCategories}}
        <section class='skills'>
          <h2>Kompetenzen</h2>
          {{#each skillCategories}}
            <div class='skill-category'>
              <h3>{{this.type}}</h3>
              <ul class='skill-list'>
                {{#each this.skills}}
                  <li>{{this}}</li>
                {{/each}}
              </ul>
            </div>
          {{/each}}
        </section>
      {{/if}}

      <!-- Berufserfahrung -->
      {{#if experiences}}
        <section class='experience'>
          <h2>Berufserfahrung</h2>
          {{#each experiences}}
            <div class='experience-item'>
              <div class='experience-header'>
                <h3>{{this.title}}</h3>
                <span class='date'>{{this.dateRange}}</span>
              </div>
              <div class='company'>{{this.company}} • {{this.location}}</div>
              {{#if this.achievements}}
                <ul class='achievements'>
                  {{#each this.achievements}}
                    <li>{{this}}</li>
                  {{/each}}
                </ul>
              {{/if}}
            </div>
          {{/each}}
        </section>
      {{/if}}

      <!-- Ausbildung -->
      {{#if education}}
        <section class='education'>
          <h2>Ausbildung</h2>
          {{#each education}}
            <div class='education-item'>
              <h3>{{this.degree}}</h3>
              <div class='institution'>{{this.institution}} • {{this.year}}</div>
              {{#if this.fieldOfStudy}}
                <div class='field'>{{this.fieldOfStudy}}</div>
              {{/if}}
            </div>
          {{/each}}
        </section>
      {{/if}}
    </div>
  </body>
</html>
```

### Schritt 2: CSS Styles erstellen

Erstelle eine neue `.css` Datei in `apps/api/src/pdf/styles/`

**Beispiel:** `apps/api/src/pdf/styles/creative-resume.css`

```css
/* Creative Resume Styles */
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Montserrat', sans-serif;
  font-size: 11pt;
  line-height: 1.6;
  color: #2d3748;
  background: white;
}

.resume-container {
  max-width: 210mm;
  margin: 0 auto;
  padding: 20mm;
}

/* Header mit kreativen Akzenten */
.header {
  text-align: center;
  padding: 30px 0;
  margin-bottom: 40px;
  border-bottom: 4px solid #8b5cf6;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 10px;
  padding: 40px;
}

.name {
  font-size: 32pt;
  font-weight: 700;
  margin-bottom: 15px;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.contact-info {
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
  font-size: 10pt;
  opacity: 0.95;
}

.contact-info span::before {
  content: '•';
  margin: 0 8px;
  opacity: 0.7;
}

.contact-info span:first-child::before {
  display: none;
}

/* Sections */
section {
  margin-bottom: 35px;
  page-break-inside: avoid;
}

h2 {
  font-size: 16pt;
  font-weight: 700;
  color: #667eea;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 20px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
}

h3 {
  font-size: 12pt;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 5px;
}

/* Summary */
.summary p {
  font-size: 11pt;
  line-height: 1.7;
  color: #4a5568;
  text-align: justify;
}

/* Skills - Kreatives Grid Layout */
.skills {
  background: #f7fafc;
  padding: 25px;
  border-radius: 8px;
  border-left: 4px solid #8b5cf6;
}

.skill-category {
  margin-bottom: 20px;
}

.skill-category:last-child {
  margin-bottom: 0;
}

.skill-category h3 {
  color: #667eea;
  font-size: 11pt;
  margin-bottom: 10px;
}

.skill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  list-style: none;
}

.skill-list li {
  background: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 9pt;
  color: #4a5568;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* Experience */
.experience-item {
  margin-bottom: 25px;
  padding-left: 20px;
  border-left: 3px solid #cbd5e0;
  position: relative;
}

.experience-item::before {
  content: '';
  position: absolute;
  left: -7px;
  top: 5px;
  width: 12px;
  height: 12px;
  background: #8b5cf6;
  border-radius: 50%;
  box-shadow:
    0 0 0 3px white,
    0 0 0 5px #e2e8f0;
}

.experience-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 5px;
}

.date {
  font-size: 9pt;
  color: #718096;
  font-weight: 500;
}

.company {
  font-size: 10pt;
  color: #667eea;
  margin-bottom: 10px;
  font-weight: 500;
}

.achievements {
  list-style: none;
  margin-top: 10px;
}

.achievements li {
  position: relative;
  padding-left: 20px;
  margin-bottom: 6px;
  font-size: 10pt;
  color: #4a5568;
}

.achievements li::before {
  content: '▸';
  position: absolute;
  left: 0;
  color: #8b5cf6;
  font-weight: bold;
}

/* Education */
.education-item {
  margin-bottom: 20px;
  padding: 15px;
  background: #f7fafc;
  border-radius: 6px;
  border-left: 3px solid #667eea;
}

.institution {
  font-size: 10pt;
  color: #718096;
  margin-bottom: 5px;
}

.field {
  font-size: 9pt;
  color: #a0aec0;
  font-style: italic;
}

/* Print optimizations */
@media print {
  .resume-container {
    padding: 15mm;
  }

  section {
    page-break-inside: avoid;
  }
}

/* A4 Page */
@page {
  size: A4;
  margin: 0;
}
```

### Schritt 3: Template im Seed-Script registrieren

Bearbeite `apps/api/prisma/seed-templates.ts`:

```typescript
// Am Anfang der Datei - Helper Functions erweitern
function readTemplateFile(filename: string): string {
  const filePath = path.join(__dirname, '../src/pdf/templates', filename);
  return fs.readFileSync(filePath, 'utf-8');
}

function readCSSFile(filename: string): string {
  const filePath = path.join(__dirname, '../src/pdf/styles', filename);
  return fs.readFileSync(filePath, 'utf-8');
}

// In der seedTemplates() Funktion
async function seedTemplates() {
  console.log('🎨 Seeding templates...');

  // Neue Templates laden
  const creativeResumeHTML = readTemplateFile('creative-resume.hbs');
  const creativeResumeCSS = readCSSFile('creative-resume.css');

  // Template in Datenbank einfügen
  await prisma.template.upsert({
    where: { id: 'creative-resume-v2' },
    update: {},
    create: {
      id: 'creative-resume-v2',
      name: 'Creative Resume',
      description: 'Bold, colorful design perfect for creative professionals',
      type: TemplateType.RESUME,
      category: 'Creative',
      htmlTemplate: creativeResumeHTML,
      cssStyles: creativeResumeCSS,
      isActive: true,
      isDefault: false,
    },
  });

  console.log('✅ Creative Resume template seeded');
}
```

### Schritt 4: Template in Datenbank laden

```bash
cd apps/api
npx tsx prisma/seed-templates.ts
```

Das war's! Das neue Template ist jetzt verfügbar. 🎉

## Template-Daten Struktur

Templates erhalten automatisch Beispieldaten bei der Preview-Generierung:

### Cover Letter Daten

```typescript
{
  candidateName: 'Max Mustermann',
  email: 'max.mustermann@example.com',
  phone: '+49 123 456789',
  location: 'Berlin, Deutschland',
  linkedin: 'linkedin.com/in/maxmustermann',
  date: '23. November 2025',
  companyName: 'Beispiel GmbH',
  recipientName: 'Frau Schmidt',
  content: '<p>Bewerbungstext...</p>',
  closingPhrase: 'Mit freundlichen Grüßen'
}
```

### Resume Daten

```typescript
{
  candidateName: 'Max Mustermann',
  email: 'max.mustermann@example.com',
  phone: '+49 123 456789',
  location: 'Berlin, Deutschland',
  linkedin: 'linkedin.com/in/maxmustermann',
  github: 'github.com/maxmustermann',
  summary: 'Erfahrener Entwickler...',
  skillCategories: [
    {
      type: 'Programmiersprachen',
      skills: ['JavaScript', 'TypeScript', 'Python']
    }
  ],
  experiences: [
    {
      title: 'Senior Software Engineer',
      company: 'Tech Corp',
      location: 'Berlin',
      dateRange: '2020 - Heute',
      achievements: ['Achievement 1', 'Achievement 2']
    }
  ],
  education: [
    {
      degree: 'Bachelor of Science',
      institution: 'TU Berlin',
      year: '2018',
      fieldOfStudy: 'Informatik'
    }
  ]
}
```

## Best Practices

### 1. **Responsive für A4-Format**

```css
@page {
  size: A4;
  margin: 0;
}

.resume-container {
  max-width: 210mm; /* A4 Breite */
  padding: 20mm;
}
```

### 2. **Print-optimiert**

```css
@media print {
  section {
    page-break-inside: avoid; /* Keine Section-Umbrüche */
  }

  .experience-item {
    page-break-inside: avoid; /* Keine Item-Umbrüche */
  }
}
```

### 3. **Lesbare Schriftgrößen**

- Body Text: 10-11pt
- Überschriften H2: 14-16pt
- Überschriften H3: 11-13pt
- Kleintext: 9-10pt

### 4. **Konsistente Farben**

Definiere Farben einmal und verwende sie konsequent:

```css
:root {
  --primary-color: #667eea;
  --text-color: #2d3748;
  --gray-light: #f7fafc;
}
```

### 5. **Category Matching**

Verwende passende Categories für Auto-Matching:

- Professional → Professional
- Modern → Modern
- Creative → Creative
- Minimal → Minimal
- Technical → Technical

## Template-Kategorien

### Professional

- Klassisch, formal
- Dunkle Farben (Navy, Schwarz)
- Serifenschriften oder klassische Sans-Serif
- Konservatives Layout

### Modern

- Clean, zeitgemäß
- Helle Akzentfarben (Blau, Grün)
- Sans-Serif Schriften
- Viel Weißraum

### Creative

- Mutig, auffällig
- Lebendige Farben (Lila, Orange)
- Moderne Schriften
- Asymmetrisches Layout

### Minimal

- Reduziert, schlicht
- Monochromatisch
- Viel Weißraum
- Klare Hierarchie

### Technical

- Strukturiert, präzise
- Monospace-Elemente
- Code-inspiriertes Design
- Technische Akzente

## Preview-System

Previews werden automatisch:

1. Beim ersten Laden generiert (Puppeteer)
2. Im Storage gecacht (`uploads/templates/{id}/preview.png`)
3. Bei jedem weiteren Request aus dem Cache geladen
4. Mit 1-Tag Browser-Cache ausgeliefert

### Preview-Cache manuell löschen

```bash
rm -rf uploads/templates/*/preview.png
```

Beim nächsten Laden werden alle Previews neu generiert.

## Troubleshooting

### Template wird nicht angezeigt

1. ✅ Seed-Script erfolgreich ausgeführt?
2. ✅ `isActive: true` gesetzt?
3. ✅ Richtiger `TemplateType`?
4. ✅ Backend neu gestartet?

### Preview-Fehler

1. ✅ CSS-Syntax korrekt?
2. ✅ Handlebars-Syntax korrekt?
3. ✅ Alle verwendeten Felder in Beispieldaten vorhanden?
4. ✅ Puppeteer-Fehler in Backend-Logs prüfen

### Layout-Probleme im PDF

1. ✅ `page-break-inside: avoid` verwendet?
2. ✅ A4-Format berücksichtigt (210mm x 297mm)?
3. ✅ Ausreichend Padding/Margin?
4. ✅ Print-Media-Queries definiert?

## Beispiel: Vollständiges Template Set

Für ein konsistentes Design solltest du immer beide Templates erstellen:

```text
📁 templates/
  ├── elegant-cover-letter.hbs
  └── elegant-resume.hbs

📁 styles/
  ├── elegant-cover-letter.css
  └── elegant-resume.css
```

Mit derselben `category: 'Elegant'` werden sie automatisch zusammen verwendet.

## Nächste Schritte

1. **Teste dein Template** im Application Wizard
2. **Erstelle Varianten** durch CSS-Anpassungen
3. **Teile deine Templates** mit dem Team
4. **Optimiere Performance** durch CSS-Minimierung

## Support

Bei Fragen oder Problemen:

- Backend-Logs prüfen: `apps/api/` Terminal
- Frontend DevTools: Console für Fehler
- Seed-Script neu ausführen bei Datenbankproblemen

Happy Templating! 🎨✨
