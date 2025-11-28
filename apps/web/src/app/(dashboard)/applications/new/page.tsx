'use client';

import { ApplicationWizard } from '@/components/forms/application-wizard';

export default function NewApplicationPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Neue Bewerbung erstellen</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Erstelle in wenigen Schritten eine professionelle Bewerbung mit KI-Unterstützung.
        </p>
      </div>

      <ApplicationWizard />
    </div>
  );
}
