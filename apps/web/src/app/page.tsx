'use client';

import { Button } from '@/components/ui/button';
import { FileText, Sparkles, Zap, ArrowRight, Shield, Clock } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const features = [
    {
      icon: Sparkles,
      title: 'KI-gestützte Optimierung',
      description: 'Nutze Azure OpenAI für perfekt auf die Stelle zugeschnittene Bewerbungen',
    },
    {
      icon: Zap,
      title: 'Schnelle Erstellung',
      description: 'Erstelle in wenigen Minuten professionelle Anschreiben und Lebensläufe',
    },
    {
      icon: Shield,
      title: 'Sicher & Privat',
      description: 'Deine Daten werden verschlüsselt und sicher in Azure gespeichert',
    },
    {
      icon: Clock,
      title: 'Zeitersparnis',
      description: 'Spare bis zu 80% der Zeit bei der Bewerbungserstellung',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <FileText className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Smart Apply</span>
          </Link>
          <nav className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => router.push('/login')}>
              Anmelden
            </Button>
            <Button onClick={() => router.push('/register')}>
              Registrieren
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm text-blue-700">
              <Sparkles className="mr-2 h-4 w-4" />
              KI-gestützte Bewerbungen
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Erstelle perfekte Bewerbungen mit{' '}
              <span className="text-blue-600">künstlicher Intelligenz</span>
            </h1>
            <p className="mb-8 text-lg text-gray-600 sm:text-xl">
              Smart Apply nutzt modernste KI-Technologie, um maßgeschneiderte
              Anschreiben und Lebensläufe zu erstellen, die genau auf die
              jeweilige Stellenanzeige zugeschnitten sind.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="w-full sm:w-auto" onClick={() => router.push('/register')}>
                Jetzt starten
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => router.push('/login')}>
                Anmelden
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container pb-24">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            Warum Smart Apply?
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title}>
                  <CardHeader>
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-gray-50 py-16">
          <div className="container text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900">
              Bereit für deine nächste Bewerbung?
            </h2>
            <p className="mb-8 text-lg text-gray-600">
              Erstelle noch heute deinen kostenlosen Account und starte mit
              KI-gestützten Bewerbungen.
            </p>
            <Button size="lg" onClick={() => router.push('/register')}>
              Kostenlos registrieren
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-gray-600">
          © {new Date().getFullYear()} Smart Apply. Alle Rechte vorbehalten.
        </div>
      </footer>
    </div>
  );
}
