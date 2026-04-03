'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, Check, AlertCircle, ArrowRight, Pencil } from 'lucide-react';
import { useProfile, useUpdateProfile } from '@/hooks/use-profile';
import { useParseResume, sectionHasData, getSectionCount, getSectionLabel, type ImportableSection } from '@/hooks/use-parse-resume';
import { useAuthStore } from '@/stores/auth-store';
import { FileUpload } from '@/components/ui/file-upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CenteredLoader } from '@/components/shared/loading';
import { toast } from 'sonner';
import type { UpdateProfileDto } from '@/types';

const ALL_SECTIONS: ImportableSection[] = [
  'personal', 'summary', 'skills', 'experiences', 'education', 'certificates', 'projects', 'languages',
];

type OnboardingStep = 'upload' | 'preview' | 'manual';

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const parseResume = useParseResume();

  const [step, setStep] = useState<OnboardingStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Manual form state — pre-fill with user data
  const [manualFirstName, setManualFirstName] = useState(user?.firstName || '');
  const [manualLastName, setManualLastName] = useState(user?.lastName || '');
  const [manualSkills, setManualSkills] = useState('');
  const [manualSummary, setManualSummary] = useState('');

  // Redirect if profile is already filled
  const hasExistingProfile = !profileLoading && profile &&
    (profile.summary || (profile.skills && profile.skills.length > 0));

  useEffect(() => {
    if (hasExistingProfile) {
      router.replace('/dashboard');
    }
  }, [hasExistingProfile, router]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    parseResume.reset();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      await parseResume.mutateAsync(selectedFile);
      setStep('preview');
    } catch {
      // On parse failure, switch to manual with friendly message
      toast.error('Wir konnten deinen Lebenslauf nicht vollständig lesen. Bitte fülle die wichtigsten Felder manuell aus.');
      setStep('manual');
    }
  };

  const handleImportAndSave = async () => {
    if (!parseResume.data) return;

    const data = parseResume.data;
    const updateData: UpdateProfileDto = {};

    // Import all sections that have data
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.phone) updateData.phone = data.phone;
    if (data.street) updateData.street = data.street;
    if (data.postalCode) updateData.postalCode = data.postalCode;
    if (data.city) updateData.city = data.city;
    if (data.country) updateData.country = data.country;
    if (data.linkedinUrl) updateData.linkedinUrl = data.linkedinUrl;
    if (data.githubUrl) updateData.githubUrl = data.githubUrl;
    if (data.portfolioUrl) updateData.portfolioUrl = data.portfolioUrl;
    if (data.summary) updateData.summary = data.summary;
    if (data.skills && data.skills.length > 0) {
      updateData.skills = data.skills.map(s => ({ name: s.name, level: s.level }));
    }
    if (data.experiences && data.experiences.length > 0) {
      updateData.experiences = data.experiences;
    }
    if (data.education && data.education.length > 0) {
      updateData.education = data.education;
    }
    if (data.certificates && data.certificates.length > 0) {
      updateData.certificates = data.certificates;
    }
    if (data.projects && data.projects.length > 0) {
      updateData.projects = data.projects;
    }
    if (data.languages && data.languages.length > 0) {
      updateData.languages = data.languages;
    }

    try {
      await updateProfile.mutateAsync(updateData);
      toast.success('Profil erfolgreich erstellt!');
      router.push('/applications/new');
    } catch {
      toast.error('Fehler beim Speichern des Profils.');
    }
  };

  const handleManualSave = async () => {
    if (!manualFirstName.trim() && !manualLastName.trim()) {
      toast.error('Bitte gib mindestens deinen Namen ein.');
      return;
    }

    const skills = manualSkills
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({ name }));

    const updateData: UpdateProfileDto = {
      firstName: manualFirstName.trim() || undefined,
      lastName: manualLastName.trim() || undefined,
      summary: manualSummary.trim() || undefined,
      skills: skills.length > 0 ? skills : undefined,
    };

    try {
      await updateProfile.mutateAsync(updateData);
      toast.success('Profil erfolgreich erstellt!');
      router.push('/applications/new');
    } catch {
      toast.error('Fehler beim Speichern des Profils.');
    }
  };

  if (profileLoading) {
    return <CenteredLoader message="Lädt..." />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Willkommen bei Smart Apply{user?.firstName ? `, ${user.firstName}` : ''}!
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Lade deinen Lebenslauf hoch, um dein Profil automatisch auszufüllen — oder fülle die wichtigsten Daten manuell aus.
        </p>
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Lebenslauf hochladen</CardTitle>
                <CardDescription>
                  Wir analysieren deinen Lebenslauf und füllen dein Profil automatisch aus.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <FileUpload
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              isUploading={parseResume.isPending}
              error={(parseResume.error as Error | null)?.message}
              hint="PDF oder DOCX, max. 10 MB"
            />

            {parseResume.isPending && (
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">Lebenslauf wird analysiert...</p>
                  <p className="text-xs text-muted-foreground">Dies kann einige Sekunden dauern.</p>
                </div>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || parseResume.isPending}
              className="w-full"
              size="lg"
            >
              {parseResume.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird analysiert...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Lebenslauf analysieren
                </>
              )}
            </Button>

            <Separator />

            <button
              onClick={() => setStep('manual')}
              className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors py-2"
            >
              Kein Lebenslauf? <span className="underline font-medium">Manuell ausfüllen</span>
            </button>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview parsed data */}
      {step === 'preview' && parseResume.data && (
        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center dark:bg-green-900/50">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle>Lebenslauf analysiert</CardTitle>
                  <CardDescription>Wir haben folgende Daten erkannt:</CardDescription>
                </div>
              </div>
              <Badge variant="default" className="gap-1">
                <Check className="h-3 w-3" />
                Erfolgreich
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary of extracted data */}
            <div className="grid gap-3">
              {ALL_SECTIONS.map(section => {
                const hasData = sectionHasData(section, parseResume.data);
                const count = getSectionCount(section, parseResume.data);
                if (!hasData) return null;

                return (
                  <div
                    key={section}
                    className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50/50 p-3 dark:bg-green-950/20 dark:border-green-900/50"
                  >
                    <div className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium">{getSectionLabel(section)}</span>
                    </div>
                    {count !== null && count > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {count} {count === 1 ? 'Eintrag' : 'Einträge'}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Skills preview */}
            {parseResume.data.skills && parseResume.data.skills.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Erkannte Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {parseResume.data.skills.slice(0, 10).map((skill, i) => (
                    <Badge key={i} variant="secondary">{skill.name}</Badge>
                  ))}
                  {parseResume.data.skills.length > 10 && (
                    <Badge variant="outline">+{parseResume.data.skills.length - 10} weitere</Badge>
                  )}
                </div>
              </div>
            )}

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" onClick={() => { setStep('upload'); parseResume.reset(); setSelectedFile(null); }}>
                Zurück
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('manual')}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Anpassen
                </Button>
                <Button
                  onClick={handleImportAndSave}
                  disabled={updateProfile.isPending}
                  size="lg"
                >
                  {updateProfile.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Sieht gut aus!
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Manual quick-fill */}
      {step === 'manual' && (
        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Pencil className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Kurzprofil erstellen</CardTitle>
                <CardDescription>
                  Fülle nur die wichtigsten Felder aus. Du kannst später jederzeit mehr ergänzen.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Vorname <span className="text-red-500">*</span></Label>
                <Input
                  id="firstName"
                  value={manualFirstName}
                  onChange={e => setManualFirstName(e.target.value)}
                  placeholder="z.B. Anna"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Nachname <span className="text-red-500">*</span></Label>
                <Input
                  id="lastName"
                  value={manualLastName}
                  onChange={e => setManualLastName(e.target.value)}
                  placeholder="z.B. Müller"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="skills">
                Top-Skills
                <span className="text-muted-foreground font-normal ml-1">(kommagetrennt)</span>
              </Label>
              <Input
                id="skills"
                value={manualSkills}
                onChange={e => setManualSkills(e.target.value)}
                placeholder="z.B. Projektmanagement, Kommunikation, Excel"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Deine wichtigsten Fähigkeiten, getrennt durch Kommas.
              </p>
            </div>

            <div>
              <Label htmlFor="summary">Kurze Zusammenfassung</Label>
              <Textarea
                id="summary"
                value={manualSummary}
                onChange={e => setManualSummary(e.target.value)}
                placeholder="z.B. Erfahrene Projektmanagerin mit 5 Jahren Erfahrung in der Organisationsentwicklung..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                2-3 Sätze über deine Berufserfahrung.
              </p>
            </div>

            {/* Recommendation hint */}
            {(!manualSummary.trim() || !manualSkills.trim()) && (
              <div className="flex items-start gap-3 rounded-lg bg-amber-50/50 border border-amber-200 p-3 dark:bg-amber-950/20 dark:border-amber-900/50">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 dark:text-amber-400" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Zusammenfassung und Skills verbessern die Qualität deiner Bewerbungen deutlich.
                </p>
              </div>
            )}

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Zurück
              </Button>
              <Button
                onClick={handleManualSave}
                disabled={updateProfile.isPending || (!manualFirstName.trim() && !manualLastName.trim())}
                size="lg"
              >
                {updateProfile.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Profil erstellen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom links */}
      <div className="flex flex-col items-center gap-2 text-sm">
        <button
          onClick={() => router.push('/profile/edit')}
          className="text-primary hover:underline transition-colors"
        >
          Profil vollständig bearbeiten →
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Später ausfüllen
        </button>
      </div>
    </div>
  );
}
