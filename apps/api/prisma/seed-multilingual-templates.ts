import { PrismaClient, TemplateType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Supported languages
const LANGUAGES = ['de', 'en', 'fr', 'es', 'it'] as const;
type Language = typeof LANGUAGES[number];

// Template designs (categories)
const TEMPLATE_DESIGNS = [
  {
    category: 'Professional',
    name: { en: 'Modern Professional', de: 'Modern Professionell', fr: 'Professionnel Moderne', es: 'Profesional Moderno', it: 'Professionale Moderno' },
    description: {
      en: 'Clean design with navy blue accents. Perfect for corporate and professional roles.',
      de: 'Sauberes Design mit marineblauen Akzenten. Perfekt für Unternehmens- und professionelle Rollen.',
      fr: 'Design épuré avec des accents bleu marine. Parfait pour les rôles professionnels et d\'entreprise.',
      es: 'Diseño limpio con acentos azul marino. Perfecto para roles corporativos y profesionales.',
      it: 'Design pulito con accenti blu navy. Perfetto per ruoli aziendali e professionali.',
    },
    styleFolder: 'modern-professional',
    isDefault: true,
  },
  {
    category: 'Minimal',
    name: { en: 'Elegant Minimal', de: 'Elegant Minimalistisch', fr: 'Minimaliste Élégant', es: 'Minimalista Elegante', it: 'Minimalista Elegante' },
    description: {
      en: 'Sophisticated, understated design with elegant typography and whitespace.',
      de: 'Raffiniertes, dezentes Design mit eleganter Typografie und Weißraum.',
      fr: 'Design sophistiqué et discret avec typographie élégante et espaces blancs.',
      es: 'Diseño sofisticado y discreto con tipografía elegante y espacios en blanco.',
      it: 'Design sofisticato e discreto con tipografia elegante e spazi bianchi.',
    },
    styleFolder: 'elegant-minimal',
    isDefault: false,
  },
  {
    category: 'Technical',
    name: { en: 'Tech Modern', de: 'Tech Modern', fr: 'Tech Moderne', es: 'Tech Moderno', it: 'Tech Moderno' },
    description: {
      en: 'Developer-focused design with subtle tech aesthetics. Great for software roles.',
      de: 'Entwicklerorientiertes Design mit subtiler Tech-Ästhetik. Ideal für Software-Rollen.',
      fr: 'Design axé sur les développeurs avec une esthétique tech subtile. Idéal pour les rôles logiciels.',
      es: 'Diseño centrado en desarrolladores con estética tecnológica sutil. Ideal para roles de software.',
      it: 'Design incentrato sugli sviluppatori con estetica tech sottile. Ideale per ruoli software.',
    },
    styleFolder: 'tech-modern',
    isDefault: false,
  },
  {
    category: 'Executive',
    name: { en: 'Executive Classic', de: 'Exekutiv Klassisch', fr: 'Classique Exécutif', es: 'Clásico Ejecutivo', it: 'Classico Esecutivo' },
    description: {
      en: 'Traditional, authoritative design for senior and executive positions.',
      de: 'Traditionelles, autoritäres Design für leitende und exekutive Positionen.',
      fr: 'Design traditionnel et autoritaire pour les postes de direction et exécutifs.',
      es: 'Diseño tradicional y autoritario para puestos directivos y ejecutivos.',
      it: 'Design tradizionale e autorevole per posizioni dirigenziali ed esecutive.',
    },
    styleFolder: 'executive-classic',
    isDefault: false,
  },
];

// Helper function to read template files
function readTemplateFile(filename: string): string {
  const filePath = path.join(__dirname, '../src/pdf/templates', filename);
  return fs.readFileSync(filePath, 'utf-8');
}

// Helper function to read CSS file from language-specific folder
function readCSSFile(styleFolder: string, language: Language): string {
  const filePath = path.join(__dirname, '../src/pdf/styles', styleFolder, `${language}.css`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  // Fallback to English if language-specific CSS not found
  const fallbackPath = path.join(__dirname, '../src/pdf/styles', styleFolder, 'en.css');
  console.warn(`CSS file not found for ${styleFolder}/${language}.css, using fallback: en.css`);
  return fs.readFileSync(fallbackPath, 'utf-8');
}

async function seedMultilingualTemplates() {
  console.log('🎨 Seeding multilingual templates...');

  // Read HTML templates (shared across all languages)
  const coverLetterHTML = readTemplateFile('cover-letter-ats.hbs');
  const resumeHTML = readTemplateFile('resume-ats.hbs');

  let totalCreated = 0;

  // ==================================================
  // SEED TEMPLATES FOR EACH DESIGN AND LANGUAGE
  // ==================================================

  for (const design of TEMPLATE_DESIGNS) {
    // Generate separate base template IDs for each type (Cover Letter and Resume)
    const coverLetterBaseId = uuidv4();
    const resumeBaseId = uuidv4();

    console.log(`\n📁 Creating templates for design: ${design.category}`);

    for (const language of LANGUAGES) {
      const cssStyles = readCSSFile(design.styleFolder, language);

      // 1. Cover Letter Template
      const coverLetterId = `${design.category.toLowerCase()}-cover-letter-${language}`;
      await prisma.template.upsert({
        where: { id: coverLetterId },
        update: {
          htmlTemplate: coverLetterHTML,
          cssStyles: cssStyles,
          name: design.name[language],
          description: design.description[language],
          language,
          baseTemplateId: coverLetterBaseId,
        },
        create: {
          id: coverLetterId,
          name: design.name[language],
          description: design.description[language],
          type: TemplateType.COVER_LETTER,
          category: design.category,
          language,
          baseTemplateId: coverLetterBaseId,
          htmlTemplate: coverLetterHTML,
          cssStyles: cssStyles,
          isActive: true,
          isDefault: design.isDefault && language === 'en', // Only English variant is default
        },
      });
      totalCreated++;

      // 2. Resume Template
      const resumeId = `${design.category.toLowerCase()}-resume-${language}`;
      await prisma.template.upsert({
        where: { id: resumeId },
        update: {
          htmlTemplate: resumeHTML,
          cssStyles: cssStyles,
          name: design.name[language],
          description: design.description[language],
          language,
          baseTemplateId: resumeBaseId,
        },
        create: {
          id: resumeId,
          name: design.name[language],
          description: design.description[language],
          type: TemplateType.RESUME,
          category: design.category,
          language,
          baseTemplateId: resumeBaseId,
          htmlTemplate: resumeHTML,
          cssStyles: cssStyles,
          isActive: true,
          isDefault: design.isDefault && language === 'en', // Only English variant is default
        },
      });
      totalCreated++;

      console.log(`  ✓ Created ${language.toUpperCase()} templates for ${design.category}`);
    }
  }

  console.log(`\n✅ Successfully created ${totalCreated} templates (${TEMPLATE_DESIGNS.length} designs × ${LANGUAGES.length} languages × 2 types)`);
}

seedMultilingualTemplates()
  .then(() => {
    console.log('🎉 Multilingual template seeding completed!');
  })
  .catch((error) => {
    console.error('❌ Error seeding multilingual templates:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
