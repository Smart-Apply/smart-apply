/**
 * Minimal i18n labels used by react-pdf templates.
 * Mirrors the `t` Handlebars helper in template-renderer.service.ts so the new
 * renderer produces identical section headers. Keep in sync when adding labels.
 */

type Lang = string;

const LABELS: Record<string, Record<string, string>> = {
  contact: {
    en: 'Contact',
    de: 'Kontakt',
    fr: 'Contact',
    es: 'Contacto',
    it: 'Contatto',
  },
  'resume.summary': {
    en: 'Professional Summary',
    de: 'Profil',
    fr: 'Résumé Professionnel',
    es: 'Resumen Profesional',
    it: 'Profilo Professionale',
  },
  'resume.skills': {
    en: 'Skills',
    de: 'Fähigkeiten',
    fr: 'Compétences',
    es: 'Habilidades',
    it: 'Competenze',
  },
  'resume.experience': {
    en: 'Professional Experience',
    de: 'Berufserfahrung',
    fr: 'Expérience Professionnelle',
    es: 'Experiencia Profesional',
    it: 'Esperienza Professionale',
  },
  'resume.education': {
    en: 'Education',
    de: 'Ausbildung',
    fr: 'Formation',
    es: 'Educación',
    it: 'Formazione',
  },
  'resume.certifications': {
    en: 'Certifications',
    de: 'Zertifikate',
    fr: 'Certifications',
    es: 'Certificaciones',
    it: 'Certificazioni',
  },
  'resume.languages': {
    en: 'Languages',
    de: 'Sprachen',
    fr: 'Langues',
    es: 'Idiomas',
    it: 'Lingue',
  },
  'resume.projects': {
    en: 'Key Projects',
    de: 'Wichtige Projekte',
    fr: 'Projets Clés',
    es: 'Proyectos Clave',
    it: 'Progetti Chiave',
  },
};

export function tLabel(key: string, lang: Lang | undefined): string {
  const normalizedLang = (lang || 'en').toLowerCase().slice(0, 2);
  const entry = LABELS[key];
  if (!entry) return key;
  return entry[normalizedLang] ?? entry.en ?? key;
}
