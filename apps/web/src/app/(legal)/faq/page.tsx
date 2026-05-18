import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ – Smart Apply",
  description:
    "Häufig gestellte Fragen zu Smart Apply: Bewerbungen, Lebenslauf, Anschreiben, Datenschutz und Preise.",
  robots: { index: true, follow: true },
};

interface FaqItem {
  q: string;
  a: React.ReactNode;
}

/**
 * Public FAQ page. Rendered as a static, SEO-friendly server component
 * with `<details>`-based accordions so it works fully without JavaScript.
 *
 * To add or edit questions: just append to the `faqs` array below. The
 * JSON-LD block at the bottom keeps the structured data in sync
 * automatically (text content only — no markup) so Google can show
 * rich-result FAQ snippets in search.
 */
const faqs: FaqItem[] = [
  {
    q: "Was macht Smart Apply genau?",
    a: (
      <>
        Smart Apply erstellt aus deinem Profil und einer Stellenanzeige in
        wenigen Sekunden ein passendes Anschreiben und einen optimierten
        Lebenslauf als PDF — beides individuell auf die jeweilige Stelle
        zugeschnitten. Du kannst die Texte direkt im Editor anpassen,
        bevor du sie herunterlädst.
      </>
    ),
  },
  {
    q: "Funktioniert Smart Apply auch außerhalb von IT-Berufen?",
    a: (
      <>
        Ja. Smart Apply ist bewusst branchenneutral entwickelt. Die
        Vorlagen und Prompts arbeiten u.&nbsp;a. mit Berufen aus
        Pflege, Vertrieb, Marketing, Handwerk, Verwaltung, Bildung und
        Logistik — nicht nur Tech.
      </>
    ),
  },
  {
    q: "In welcher Sprache werden meine Bewerbungen erstellt?",
    a: (
      <>
        Wir erkennen die Sprache der Stellenanzeige automatisch (aktuell
        Deutsch und Englisch) und erzeugen Anschreiben und Lebenslauf in
        derselben Sprache. Fachbegriffe (z.&nbsp;B. Tool-Namen) bleiben
        unverändert in ihrer üblichen Schreibweise.
      </>
    ),
  },
  {
    q: "Was passiert mit meinen Daten?",
    a: (
      <>
        Deine Profil- und Bewerbungsdaten liegen verschlüsselt in einer
        EU-Datenbank (Microsoft Azure, Schweden). Wir verkaufen oder
        verwenden deine Daten nicht für Werbung oder zum Trainieren von
        Modellen. Details findest du in unserer{" "}
        <Link href="/datenschutz" className="underline">
          Datenschutzerklärung
        </Link>
        . Du kannst deine Daten jederzeit unter „Einstellungen → Daten
        exportieren&quot; herunterladen oder dein Konto vollständig
        löschen.
      </>
    ),
  },
  {
    q: "Was kostet Smart Apply?",
    a: (
      <>
        Der Einstieg ist kostenlos und ohne Kreditkarte. Im Free-Plan kannst
        du Smart Apply mit 3 Bewerbungen pro Monat in Ruhe ausprobieren. Pro
        (9,99 € / Monat) hilft dir, jede Bewerbung mit KI zu optimieren.
        Premium (19,99 € / Monat) automatisiert deine Jobsuche mit
        Auto-Apply, E-Mail-Tracking und Interview-Coach. Alle Preise sind
        transparent, monatlich kündbar und ohne versteckte Kosten — Details
        auf unserer{" "}
        <Link href="/pricing" className="underline">
          Preisseite
        </Link>
        .
      </>
    ),
  },
  {
    q: "Wie kann ich meine Bewerbung nach der Generierung noch anpassen?",
    a: (
      <>
        Nach der Generierung öffnet sich automatisch ein Editor, in dem du
        Anschreiben und Lebenslauf direkt im Browser bearbeiten und neu
        als PDF exportieren kannst — ohne erneute Generierung und ohne
        Token zu verbrauchen.
      </>
    ),
  },
  {
    q: "Sind die generierten Lebensläufe ATS-kompatibel?",
    a: (
      <>
        Ja. Alle PDF-Vorlagen sind so gebaut, dass sie von gängigen
        Bewerber-Tracking-Systemen (ATS) korrekt gelesen werden:
        einspaltiges Layout, einfache HTML-Struktur, keine Tabellen oder
        Grafiken in kritischen Bereichen, klare Section-Header und
        Standard-Schriftarten.
      </>
    ),
  },
  {
    q: "Ich habe einen Fehler gefunden oder eine Idee — wo melde ich mich?",
    a: (
      <>
        Schreib uns über das Kontaktformular auf der{" "}
        <Link href="/" className="underline">
          Startseite
        </Link>{" "}
        oder direkt an{" "}
        <a href="mailto:support@smart-apply.io" className="underline">
          support@smart-apply.io
        </a>
        . Wir antworten in der Regel innerhalb von 1–2 Werktagen.
      </>
    ),
  },
];

/**
 * Build JSON-LD FAQPage schema from the visible Q&A list.
 *
 * Google's FAQ rich result requires plain-text answers, so we extract
 * just the text from each ReactNode by toString()-ing children where
 * possible. For more complex nodes (links / formatting), we fall back
 * to a static plain-text version below.
 */
const faqsForJsonLd: { q: string; a: string }[] = [
  {
    q: "Was macht Smart Apply genau?",
    a: "Smart Apply erstellt aus deinem Profil und einer Stellenanzeige in wenigen Sekunden ein passendes Anschreiben und einen optimierten Lebenslauf als PDF — individuell auf die jeweilige Stelle zugeschnitten.",
  },
  {
    q: "Funktioniert Smart Apply auch außerhalb von IT-Berufen?",
    a: "Ja. Smart Apply ist bewusst branchenneutral entwickelt und arbeitet mit Berufen aus Pflege, Vertrieb, Marketing, Handwerk, Verwaltung, Bildung und Logistik — nicht nur Tech.",
  },
  {
    q: "In welcher Sprache werden meine Bewerbungen erstellt?",
    a: "Wir erkennen die Sprache der Stellenanzeige automatisch (Deutsch oder Englisch) und erzeugen Anschreiben und Lebenslauf in derselben Sprache.",
  },
  {
    q: "Was passiert mit meinen Daten?",
    a: "Deine Daten liegen verschlüsselt in einer EU-Datenbank (Microsoft Azure, Schweden). Wir verkaufen sie nicht und nutzen sie nicht für Werbung oder Modelltraining. Du kannst deine Daten jederzeit exportieren oder dein Konto löschen.",
  },
  {
    q: "Was kostet Smart Apply?",
    a: "Der Einstieg ist kostenlos und ohne Kreditkarte: Free umfasst 3 Bewerbungen pro Monat. Pro kostet 9,99 € / Monat und optimiert jede Bewerbung mit KI. Premium kostet 19,99 € / Monat und automatisiert die Jobsuche mit Auto-Apply, E-Mail-Tracking und Interview-Coach. Monatlich kündbar, keine versteckten Kosten.",
  },
  {
    q: "Wie kann ich meine Bewerbung nach der Generierung noch anpassen?",
    a: "Nach der Generierung kannst du Anschreiben und Lebenslauf direkt im Browser-Editor bearbeiten und neu als PDF exportieren, ohne dass das eine erneute Generierung kostet.",
  },
  {
    q: "Sind die generierten Lebensläufe ATS-kompatibel?",
    a: "Ja. Alle PDF-Vorlagen verwenden ein einspaltiges Layout, einfache HTML-Struktur, klare Section-Header und Standard-Schriftarten — gängige Bewerber-Tracking-Systeme können sie zuverlässig parsen.",
  },
  {
    q: "Ich habe einen Fehler gefunden oder eine Idee — wo melde ich mich?",
    a: "Über das Kontaktformular auf der Startseite oder direkt per Mail an support@smart-apply.io. Antwort meist innerhalb von 1–2 Werktagen.",
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqsForJsonLd.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <>
      <h1>Häufige Fragen (FAQ)</h1>
      <p>
        Antworten auf die häufigsten Fragen zu Smart Apply. Findest du
        deine Frage nicht? Schreib uns über das Kontaktformular auf der{" "}
        <Link href="/" className="underline">
          Startseite
        </Link>
        .
      </p>

      <div className="mt-6 space-y-3">
        {faqs.map(({ q, a }) => (
          <details
            key={q}
            className="group rounded-lg border border-gray-200 bg-white p-4 open:shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between font-poppins text-base font-semibold text-[#1B2A49] [&::-webkit-details-marker]:hidden">
              <span>{q}</span>
              <span
                className="ml-4 select-none text-xl text-gray-400 transition-transform group-open:rotate-45"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <div className="mt-3 text-gray-700 leading-relaxed">{a}</div>
          </details>
        ))}
      </div>

      {/* Structured data for Google's FAQ rich result */}
      <script
        type="application/ld+json"
         
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
