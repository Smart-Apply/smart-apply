'use client';

import { useEffect, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useProfile, useUpdateProfile } from '@/hooks/use-profile';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkillsManager } from '@/components/forms/skills-manager';
import { LanguagesManager } from '@/components/forms/languages-manager';
import { ExperienceManager } from '@/components/forms/experience-manager';
import { EducationManager } from '@/components/forms/education-manager';
import { CertificatesManager } from '@/components/forms/certificates-manager';
import { ProjectsManager } from '@/components/forms/projects-manager';
import { ArrowLeft, Loader2, User, Briefcase, GraduationCap, Code, Award, Save } from 'lucide-react';
import type { Skill, Experience, Education, Certificate, Project, Language } from '@/types';

// Validation schema for basic profile info
const profileFormSchema = z.object({
  firstName: z.string().min(2, 'Vorname muss mindestens 2 Zeichen lang sein'),
  lastName: z.string().min(2, 'Nachname muss mindestens 2 Zeichen lang sein'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedIn: z.string().url('Ungültige URL').optional().or(z.literal('')),
  website: z.string().url('Ungültige URL').optional().or(z.literal('')),
  summary: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

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

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      location: '',
      linkedIn: '',
      website: '',
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
        location: profile.location || '',
        linkedIn: profile.linkedinUrl || '',
        website: profile.portfolioUrl || '',
        summary: profile.summary || '',
      });
    }
  }, [user, profile, form]);

  // Sync skills, experiences, education, certificates, and projects from profile
  useEffect(() => {
    if (profile) {
      startTransition(() => {
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
      });
    }
  }, [profile?.skills, profile?.experiences, profile?.education, profile?.certificates, profile?.projects, profile?.languages]);

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      const skillsForUpdate = skills.map(({ id, name, level }) => ({ ...(id && { id }), name, level }));
      const experiencesForUpdate = experiences.map(({ id, title, company, location, startDate, endDate, description, current }) => ({
        ...(id && { id }), title, company, location, startDate, endDate, description, current
      }));
      const educationForUpdate = education.map(({ id, degree, institution, fieldOfStudy, startYear, endYear, gpa, description }) => ({
        ...(id && { id }), degree, institution, fieldOfStudy,
        startYear: startYear ? `${startYear}-01-01` : undefined,
        endYear: endYear ? `${endYear}-01-01` : undefined,
        gpa, description,
      }));
      const certificatesForUpdate = certificates.map(({ id, name, issuer, dateObtained, url }) => ({
        ...(id && { id }), name, issuer, dateObtained: dateObtained || undefined, url: url || undefined,
      }));
      const projectsForUpdate = projects.map(({ id, name, description, technologies, url, startDate, endDate }) => ({
        ...(id && { id }), name, description, technologies, url, startDate, endDate,
      }));
      const languagesForUpdate = languages.map(({ id, name, level }) => ({ ...(id && { id }), name, level }));

      await updateProfile.mutateAsync({
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        phone: data.phone?.trim() || undefined,
        location: data.location?.trim() || undefined,
        linkedinUrl: data.linkedIn?.trim() || undefined,
        portfolioUrl: data.website?.trim() || undefined,
        summary: data.summary?.trim() || undefined,
        skills: skills.length > 0 ? skillsForUpdate : undefined,
        experiences: experiences.length > 0 ? experiencesForUpdate : undefined,
        education: education.length > 0 ? educationForUpdate : undefined,
        certificates: certificates.length > 0 ? certificatesForUpdate : undefined,
        projects: projects.length > 0 ? projectsForUpdate : undefined,
        languages: languages.length > 0 ? languagesForUpdate : undefined,
      });

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
        <Button onClick={form.handleSubmit(onSubmit)} disabled={updateProfile.isPending} className="shadow-lg shadow-primary/20">
          {updateProfile.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Speichern
        </Button>
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
                            <Input placeholder="+49 123 456789" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Standort</FormLabel>
                          <FormControl>
                            <Input placeholder="Berlin, Deutschland" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="linkedIn"
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
                      name="website"
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
