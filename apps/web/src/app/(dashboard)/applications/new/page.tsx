'use client';

import { ApplicationWizard } from '@/components/forms/application-wizard';

export default function NewApplicationPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Neue Bewerbung erstellen</h1>
        <p className="mt-2 text-gray-600">
          Erstelle eine neue Bewerbung mit KI-Unterstützung in nur drei Schritten.
        </p>
      </div>

      <ApplicationWizard />
    </div>
  );
}
