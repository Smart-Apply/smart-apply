# 🧭 Smart Apply – Pricing Model (Free, Pro, Premium)

Dieses Dokument beschreibt das vollständige Pricing-Modell für Smart Apply basierend auf den geplanten Features. Die Struktur ist darauf ausgelegt, Free-User effizient zu konvertieren und Premium-Value klar hervorzuheben.

---

## 🟩 Free Tier (0 € / Monat)

### ⭐ Ziel

Niedrige Einstiegshürde, sofortiger Mehrwert, klar erkennbare Grenzen.

### 🎁 Features

- **3 KI-Anschreiben pro Monat**
- **3 KI-Lebensläufe pro Monat**
- **Job-Parsing**
  - Bis zu **10 URLs pro Monat**
- **Standard-Template**
- **Keine PDF-Exports**
- **1 gespeichertes Profil**
- **Manuelles Bewerbungstracking**
- **Werbung sichtbar**

---

## 🟦 Pro Tier (9,99 € / Monat)

### ⭐ Ziel für Pro

Komplette Bewerbungsunterstützung – ideal für aktive Jobsuchende.

### 🎁 Features für Pro

- **Unbegrenzte KI-Anschreiben**
- **Unbegrenzte KI-Lebensläufe**
- **PDF-Export (Cover Letter & Resume)**
- **Mehrere professionelle Templates**
- **ATS-Optimierung & Keyword-Matching**
- **Unbegrenztes Job-Parsing**
- **Bewerbungsspeicherung & Verlauf**
- **Analytics (Keyword Score, ATS Score)**
- **Halbautomatisches Bewerbungstracking**
- **Keine Werbung**
- **Erweitertes Profil** (mehr Projekte, Erfahrungen etc.)
- **LinkedIn-Import**
- **Mehrsprachige Anschreiben (DE & EN)**

---

## 🟧 Premium Tier (17,99 € / Monat)

### ⭐ Ziel für Premium

Maximale Automatisierung und Erfolgschancen für anspruchsvolle Nutzer.

### 🎁 Features für Premium

- **Alles aus Pro**
- **Premium-Templates & Custom Branding**  
  (eigene Farben, Layout, Branding)
- **Automatisches Bewerbungstracking**  
  (Gmail/Outlook E-Mail Parsing)
- **Auto-Apply Bewerbungsagent**
- **Semantische Keyword-Erkennung**  
  (Synonyme, Bedeutungsräume, Embeddings)
- **Interview Coach (KI-basiert)**
- **Advanced Analytics**  
  (Erfolgsquoten, Unternehmensvergleich, Trendanalyse)
- **Mehrsprachige Anschreiben (alle verfügbaren Sprachen)**
- **Queue-Priorisierung (schnellere Verarbeitung)**
- **Premium Support**

---

# 📦 Feature-Vergleich (Tabelle)

| Feature                   | Free     | Pro (9,99 €)    | Premium (17,99 €)            |
| ------------------------- | -------- | --------------- | ---------------------------- |
| KI-Anschreiben            | 3/Monat  | Unbegrenzt      | Unbegrenzt                   |
| KI-Lebenslauf             | 3/Monat  | Unbegrenzt      | Unbegrenzt                   |
| PDF-Export                | ❌       | ✅              | ✅                           |
| Templates                 | Standard | Mehrere         | Premium + Custom             |
| Branding                  | ❌       | ❌              | ✅                           |
| Job-Parsing               | 10/Monat | Unbegrenzt      | Unbegrenzt                   |
| ATS-Optimierung           | ❌       | ✅              | Advanced                     |
| Keyword Matching          | ❌       | Basic           | Semantisch                   |
| Bewerbungsspeicherung     | 1        | Unbegrenzt      | Unbegrenzt                   |
| Bewerbungstracking        | Manuell  | Halbautomatisch | Automatisch (E-Mail Parsing) |
| Bewerbungsagent           | ❌       | ❌              | ✅                           |
| LinkedIn-Import           | ❌       | ✅              | ✅                           |
| Mehrsprachige Anschreiben | ❌       | DE+EN           | Alle                         |
| Analytics                 | ❌       | Basic           | Advanced                     |
| Werbung                   | Ja       | Nein            | Nein                         |
| Support                   | Standard | Standard        | Premium                      |

---

## 🎯 Positionierung

- **Free** → Testen, Value spüren, Limitationen erleben
- **Pro** → Der Standard-Plan für alle aktiven Bewerber
- **Premium** → Automatisierung + Wettbewerbsvorteil + Zeitersparnis

---

## 📌 Hinweise für die Implementierung

- **Free-Limits** serverseitig in NestJS durch Rate-Limits / Counters
- **Pro/Premium** über Stripe Webhooks + Role-Based Access
- **Premium-Only Features** unbedingt UI-mäßig „gelockt“ anzeigen
- **Upgrade-Modals** triggered by:
  - PDF Download Klick im Free Tier
  - Mehr als 3 Generierungen
  - ATS-Score Feature öffnen

---
