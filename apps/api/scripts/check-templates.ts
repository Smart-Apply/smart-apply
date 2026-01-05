import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.resumeTemplate.findMany({
    where: { type: 'resume' },
    select: { id: true, name: true, htmlTemplate: true }
  });
  
  console.log('Checking templates in database:\n');
  
  for (const t of templates) {
    const hasTranslateLang = t.htmlTemplate.includes('translateLang');
    const hasRawThisName = t.htmlTemplate.includes('{{this.name}}') || 
                           t.htmlTemplate.includes('{{ this.name }}');
    
    // Extract the languages section to see what's there
    const langMatch = t.htmlTemplate.match(/{{#each languages}}[\s\S]*?{{\/each}}/);
    const langSection = langMatch ? langMatch[0].substring(0, 200) : 'NOT FOUND';
    
    console.log(`📄 ${t.name}`);
    console.log(`   translateLang helper: ${hasTranslateLang ? '✅' : '❌'}`);
    console.log(`   raw {{this.name}}: ${hasRawThisName ? '❌ PROBLEM' : '✅ OK'}`);
    console.log(`   Languages section: ${langSection}`);
    console.log('');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
