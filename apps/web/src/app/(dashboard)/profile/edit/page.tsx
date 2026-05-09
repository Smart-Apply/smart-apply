'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useProfile, useUpdateProfile } from '@/hooks/use-profile';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkillsManager } from '@/components/forms/skills-manager';
import { LanguagesManager } from '@/components/forms/languages-manager';
import { CertificatesManager } from '@/components/forms/certificates-manager';
import { ResumeImportDialog } from '@/components/forms/resume-import-dialog';
import { ArrowLeft, Loader2, User, Briefcase, GraduationCap, Code, Award, Save, Upload } from 'lucide-react';
import { profileFormSchema, type ProfileFormValues } from '@/lib/validation/profile-schema';
import type { Skill, Experience, Education, Certificate, Project, Language, ExtractedProfile } from '@/types';
import type { ImportableSection } from '@/hooks/use-parse-resume';
import { toastSuccess } from '@/lib/toast';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamic imports for form managers that use Tiptap editor (saves ~200KB)
// Only loaded when user navigates to profile edit page
const ExperienceManager = dynamic(
  () => import('@/components/forms/experience-manager').then(mod => ({ default: mod.ExperienceManager })),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false,
  }
);

const EducationManager = dynamic(
  () => import('@/components/forms/education-manager').then(mod => ({ default: mod.EducationManager })),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false,
  }
);

const ProjectsManager = dynamic(
  () => import('@/components/forms/projects-manager').then(mod => ({ default: mod.ProjectsManager })),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false,
  }
);

export default function ProfileEditPage() {
  const router = useRouter();
  const { data: profile, isLoading } = useProfile();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useUpdateProfile();

  // State for skills, experiences, education, certificates, and projects management
  const [skills, setSkills] = useState<Skill[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const dataInitializedRef = useRef(false);
  
  // Refs to track latest state values (prevent stale closure issues)
  const experiencesRef = useRef<Experience[]>([]);
  const educationRef = useRef<Education[]>([]);
  const certificatesRef = useRef<Certificate[]>([]);
  const projectsRef = useRef<Project[]>([]);
  
  // Update refs whenever state changes
  useEffect(() => { experiencesRef.current = experiences; }, [experiences]);
  useEffect(() => { educationRef.current = education; }, [education]);
  useEffect(() => { certificatesRef.current = certificates; }, [certificates]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      street: '',
      postalCode: '',
      city: '',
      country: '',
      linkedinUrl: '',
      githubUrl: '',
      portfolioUrl: '',
      summary: '',
    },
  });

  // Pre-populate form with existing data
  useEffect(() => {
    if (user && profile) {
      form.reset({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: profile.phone || '',
        street: profile.street || '',
        postalCode: profile.postalCode || '',
        city: profile.city || '',
        country: profile.country || '',
        linkedinUrl: profile.linkedinUrl || '',
        githubUrl: profile.githubUrl || '',
        portfolioUrl: profile.portfolioUrl || '',
        summary: profile.summary || '',
      });
    }
  }, [user, profile, form]);

  // Sync skills, experiences, education, certificates, and projects from profile
  // ONLY on initial load - never overwrite user's local changes
  useEffect(() => {
    if (profile && !dataInitializedRef.current) {
      setSkills(profile.skills || []);
      setExperiences(profile.experiences || []);
      setCertificates(profile.certificates || []);
      setProjects(profile.projects || []);
      setLanguages(profile.languages || []);

      const educationWithYears = (profile.education || []).map(edu => ({
        ...edu,
        startYear: edu.startYear ? new Date(edu.startYear).getFullYear() : undefined,
        endYear: edu.endYear ? new Date(edu.endYear).getFullYear() : null,
      }));
      setEducation(educationWithYears);
      dataInitializedRef.current = true;
    }
     
  }, [profile]);

  // Handle importing data from parsed resume
  const handleResumeImport = useCallback((data: ExtractedProfile, sections: ImportableSection[]) => {
    let importedCount = 0;

    sections.forEach((section) => {
      switch (section) {
        case 'personal':
          if (data.firstName) { form.setValue('firstName', data.firstName); importedCount++; }
          if (data.lastName) { form.setValue('lastName', data.lastName); importedCount++; }
          if (data.phone) { form.setValue('phone', data.phone); importedCount++; }
          if (data.street) { form.setValue('street', data.street); importedCount++; }
          if (data.postalCode) { form.setValue('postalCode', data.postalCode); importedCount++; }
          if (data.city) { form.setValue('city', data.city); importedCount++; }
          if (data.country) { form.setValue('country', data.country); importedCount++; }
          if (data.linkedinUrl) { form.setValue('linkedinUrl', data.linkedinUrl); importedCount++; }
          if (data.githubUrl) { form.setValue('githubUrl', data.githubUrl); importedCount++; }
          if (data.portfolioUrl) { form.setValue('portfolioUrl', data.portfolioUrl); importedCount++; }
          break;
        case 'summary':
          if (data.summary) { form.setValue('summary', data.summary); importedCount++; }
          break;
        case 'skills':
          if (data.skills && data.skills.length > 0) {
            setSkills(data.skills.map(s => ({ name: s.name, level: s.level })));
            importedCount += data.skills.length;
          }
          break;
        case 'experiences':
          if (data.experiences && data.experiences.length > 0) {
            setExperiences(data.experiences.map(e => ({
              title: e.title,
              company: e.company,
              location: e.location || null,
              startDate: e.startDate,
              endDate: e.endDate || null,
              description: e.description || null,
              current: e.current || false,
            })));
            importedCount += data.experiences.length;
          }
          break;
        case 'education':
          if (data.education && data.education.length > 0) {
            setEducation(data.education.map(edu => ({
              degree: edu.degree,
              institution: edu.institution,
              fieldOfStudy: edu.fieldOfStudy,
              startYear: edu.startYear ? parseInt(edu.startYear.split('-')[0]) : undefined,
              endYear: edu.endYear ? parseInt(edu.endYear.split('-')[0]) : null,
              gpa: edu.gpa,
              description: edu.description,
            })));
            importedCount += data.education.length;
          }
          break;
        case 'certificates':
          if (data.certificates && data.certificates.length > 0) {
            setCertificates(data.certificates.map(c => ({
              name: c.name,
              issuer: c.issuer,
              dateObtained: c.dateObtained,
              url: c.url,
            })));
            importedCount += data.certificates.length;
          }
          break;
        case 'projects':
          if (data.projects && data.projects.length > 0) {
            setProjects(data.projects.map(p => ({
              name: p.name,
              description: p.description ?? undefined,
              technologies: p.technologies,
              url: p.url,
            })));
            importedCount += data.projects.length;
          }
          break;
        case 'languages':
          if (data.languages && data.languages.length > 0) {
            setLanguages(data.languages.map(l => ({ name: l.name, level: l.level })));
            importedCount += data.languages.length;
          }
          break;
      }
    });

    toastSuccess(
      `${sections.length} Abschnitte mit insgesamt ${importedCount} Feldern importiert`,
    );
  }, [form]);

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      // Wait a tiny bit for any pending state updates to propagate
      // This ensures refs are up-to-date with the latest state changes
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Use refs to get the latest values (prevents stale closure issues)
      const latestExperiences = experiencesRef.current;
      const latestEducation = educationRef.current;
      const latestCertificates = certificatesRef.current;
      const latestProjects = projectsRef.current;
      
      const skillsForUpdate = skills.map(({ id, name, level }) => ({ ...(id && { id }), name, level }));
      const experiencesForUpdate = latestExperiences.map(({ id, title, company, location, startDate, endDate, description, current }) => ({
        ...(id && { id }), title, company, location, startDate, endDate, description, current
      }));
      const educationForUpdate = latestEducation.map(({ id, degree, institution, fieldOfStudy, startYear, endYear, gpa, description }) => ({
        ...(id && { id }), degree, institution, fieldOfStudy,
        startYear: startYear ? `${startYear}-01-01` : undefined,
        endYear: endYear ? `${endYear}-01-01` : undefined,
        gpa, description,
      }));
      const certificatesForUpdate = latestCertificates.map(({ id, name, issuer, dateObtained, url }) => ({
        ...(id && { id }), name, issuer, dateObtained: dateObtained || undefined, url: url || undefined,
      }));
      const projectsForUpdate = latestProjects.map(({ id, name, description, technologies, url, startDate, endDate }) => ({
        ...(id && { id }), name, description, technologies, url, startDate, endDate,
      }));
      const languagesForUpdate = languages.map(({ id, name, level }) => ({ ...(id && { id }), name, level }));

      const savedProfile = await updateProfile.mutateAsync({
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        phone: data.phone?.trim() || undefined,
        street: data.street?.trim() || undefined,
        postalCode: data.postalCode?.trim() || undefined,
        city: data.city?.trim() || undefined,
        country: data.country?.trim() || undefined,
        linkedinUrl: data.linkedinUrl?.trim() || undefined,
        githubUrl: data.githubUrl?.trim() || undefined,
        portfolioUrl: data.portfolioUrl?.trim() || undefined,
        summary: data.summary?.trim() || undefined,
        skills: skills.length > 0 ? skillsForUpdate : undefined,
        experiences: experiencesForUpdate.length > 0 ? experiencesForUpdate : undefined,
        education: educationForUpdate.length > 0 ? educationForUpdate : undefined,
        certificates: certificatesForUpdate.length > 0 ? certificatesForUpdate : undefined,
        projects: projectsForUpdate.length > 0 ? projectsForUpdate : undefined,
        languages: languages.length > 0 ? languagesForUpdate : undefined,
      });

      // Update local state with server response (includes IDs for new items)
      // This ensures new items get their database IDs
      setSkills(savedProfile.skills || []);
      setExperiences(savedProfile.experiences || []);
      setCertificates(savedProfile.certificates || []);
      setProjects(savedProfile.projects || []);
      setLanguages(savedProfile.languages || []);
      
      const educationWithYears = (savedProfile.education || []).map(edu => ({
        ...edu,
        startYear: edu.startYear ? new Date(edu.startYear).getFullYear() : undefined,
        endYear: edu.endYear ? new Date(edu.endYear).getFullYear() : null,
      }));
      setEducation(educationWithYears);

    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/profile')} className="rounded-full hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Profil bearbeiten</h1>
            <p className="text-muted-foreground">Aktualisiere deine Informationen</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ResumeImportDialog
            onImport={handleResumeImport}
            trigger={
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Lebenslauf importieren</span>
                <span className="sm:hidden">Import</span>
              </Button>
            }
          />
          <SubmitButton 
            onClick={form.handleSubmit(onSubmit)} 
            isLoading={updateProfile.isPending}
            loadingText="Speichere..."
            className="shadow-lg shadow-primary/20"
          >
            <Save className="mr-2 h-4 w-4" />
            Speichern
          </SubmitButton>
        </div>
      </div>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 lg:w-auto h-auto p-1 bg-muted/50 rounded-xl">
          <TabsTrigger value="basic" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2">Basis</TabsTrigger>
          <TabsTrigger value="experience" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2">Erfahrung</TabsTrigger>
          <TabsTrigger value="education" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2">Bildung</TabsTrigger>
          <TabsTrigger value="skills" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2">Skills</TabsTrigger>
          <TabsTrigger value="projects" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2">Projekte</TabsTrigger>
          <TabsTrigger value="certificates" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2">Zertifikate</TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            <TabsContent value="basic" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-border/50 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Grundinformationen
                  </CardTitle>
                  <CardDescription>Persönliche Daten und Kontaktinformationen</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vorname *</FormLabel>
                          <FormControl>
                            <Input placeholder="Max" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nachname *</FormLabel>
                          <FormControl>
                            <Input placeholder="Mustermann" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-Mail</FormLabel>
                          <FormControl>
                            <Input {...field} disabled className="bg-muted" />
                          </FormControl>
                          <FormDescription>E-Mail kann nicht geändert werden</FormDescription>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefon</FormLabel>
                          <FormControl>
                            <Input 
                              type="tel"
                              placeholder="+49 123 456789" 
                              {...field}
                              onChange={(e) => {
                                // Auto-format as user types
                                const value = e.target.value.replace(/\s/g, '');
                                if (value.length > 0 && !value.startsWith('+')) {
                                  field.onChange('+' + value);
                                } else {
                                  field.onChange(value);
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="street"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Straße und Hausnummer</FormLabel>
                          <FormControl>
                            <Input placeholder="Musterstraße 123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postleitzahl</FormLabel>
                          <FormControl>
                            <Input placeholder="47057" maxLength={5} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stadt</FormLabel>
                          <FormControl>
                            <Input placeholder="Duisburg" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Land <span className="text-muted-foreground text-xs font-normal">(optional)</span></FormLabel>
                          <FormControl>
                            <Input placeholder="z.B. Deutschland" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="linkedinUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>LinkedIn URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://linkedin.com/in/..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="githubUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GitHub URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://github.com/..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="portfolioUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website / Portfolio</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Über mich</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Erzähle kurz etwas über dich..."
                            className="min-h-[150px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Eine kurze Zusammenfassung für dein Profil.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="experience" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-border/50 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Berufserfahrung
                  </CardTitle>
                  <CardDescription>Füge deine bisherigen Arbeitsstellen hinzu</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExperienceManager
                    experiences={experiences}
                    onExperiencesChange={setExperiences}
                    disabled={updateProfile.isPending}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="education" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-border/50 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Ausbildung
                  </CardTitle>
                  <CardDescription>Deine schulische und akademische Laufbahn</CardDescription>
                </CardHeader>
                <CardContent>
                  <EducationManager
                    education={education}
                    onEducationChange={setEducation}
                    disabled={updateProfile.isPending}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="skills" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-border/50 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5 text-primary" />
                    Fähigkeiten & Sprachen
                  </CardTitle>
                  <CardDescription>Was kannst du besonders gut?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <SkillsManager
                    skills={skills}
                    onSkillsChange={setSkills}
                    disabled={updateProfile.isPending}
                  />
                  <LanguagesManager
                    languages={languages}
                    onLanguagesChange={setLanguages}
                    disabled={updateProfile.isPending}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="projects" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-border/50 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5 text-primary" />
                    Projekte
                  </CardTitle>
                  <CardDescription>Zeige deine besten Arbeiten</CardDescription>
                </CardHeader>
                <CardContent>
                  <ProjectsManager
                    projects={projects}
                    onProjectsChange={setProjects}
                    disabled={updateProfile.isPending}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="certificates" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-border/50 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Zertifikate
                  </CardTitle>
                  <CardDescription>Deine Qualifikationen und Urkunden</CardDescription>
                </CardHeader>
                <CardContent>
                  <CertificatesManager
                    certificates={certificates}
                    onCertificatesChange={setCertificates}
                    disabled={updateProfile.isPending}
                  />
                </CardContent>
              </Card>
            </TabsContent>

          </form>
        </Form>
      </Tabs>
    </div>
  );
}
