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
import { SkillsManager } from '@/components/forms/skills-manager';
import { ExperienceManager } from '@/components/forms/experience-manager';
import { EducationManager } from '@/components/forms/education-manager';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { Skill, Experience, Education } from '@/types';

// Validation schema for basic profile info
const profileFormSchema = z.object({
  name: z.string().min(2, 'Name muss mindestens 2 Zeichen lang sein'),
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
  
  // State for skills, experiences, and education management
  const [skills, setSkills] = useState<Skill[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [education, setEducation] = useState<Education[]>([]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
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
        name: user.name || '',
        email: user.email || '',
        phone: profile.phone || '',
        location: profile.location || '',
        linkedIn: profile.linkedinUrl || '',
        website: profile.portfolioUrl || '',
        summary: profile.summary || '',
      });
    }
  }, [user, profile, form]);

  // Sync skills, experiences, and education from profile (separate effect to track changes properly)
  useEffect(() => {
    if (profile) {
      // Update state when profile data changes (after successful mutation)
      startTransition(() => {
        setSkills(profile.skills || []);
        setExperiences(profile.experiences || []);
        setEducation(profile.education || []);
      });
    }
    // Only re-run when skills, experiences, or education arrays change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.skills, profile?.experiences, profile?.education]);

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      // Map frontend field names to backend DTO field names
      // Keep IDs for differential updates (backend upserts based on ID presence)
      const skillsForUpdate = skills.map(({ id, name, level }) => ({
        ...(id && { id }), // Include ID if exists (for update), omit if new (for create)
        name,
        level,
      }));
      
      const experiencesForUpdate = experiences.map(({ id, title, company, location, startDate, endDate, description, current }) => ({
        ...(id && { id }), // Include ID if exists
        title,
        company,
        location, // Keep null as-is for explicit clearing
        startDate,
        endDate, // Keep null as-is for "current" jobs
        description, // Keep null as-is to allow clearing descriptions
        current,
      }));
      
      const educationForUpdate = education.map(({ id, degree, institution, fieldOfStudy, startYear, endYear, gpa, description }) => ({
        ...(id && { id }), // Include ID if exists (for update), omit if new (for create)
        degree,
        institution,
        fieldOfStudy,
        startYear,
        endYear,
        gpa,
        description,
      }));
      
      await updateProfile.mutateAsync({
        fullName: data.name || undefined,
        phone: data.phone?.trim() || undefined,
        location: data.location?.trim() || undefined,
        linkedinUrl: data.linkedIn?.trim() || undefined,
        portfolioUrl: data.website?.trim() || undefined,
        summary: data.summary?.trim() || undefined,
        skills: skills.length > 0 ? skillsForUpdate : undefined,
        experiences: experiences.length > 0 ? experiencesForUpdate : undefined,
        education: education.length > 0 ? educationForUpdate : undefined,
      });
      
      // Stay on edit page after save (data will refresh via React Query)
      // User can manually navigate back via Cancel button or back arrow
    } catch (error) {
      // Error is handled by the mutation hook (toast notification)
      console.error('Failed to update profile:', error);
    }
  };

  const handleCancel = () => {
    router.push('/profile');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/profile">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profil bearbeiten</h1>
            <p className="mt-1 text-gray-500">Lädt dein Profil...</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/profile">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profil bearbeiten</h1>
          <p className="mt-1 text-gray-500">Aktualisiere deine grundlegenden Informationen</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Grundinformationen</CardTitle>
          <CardDescription>
            Diese Informationen werden verwendet, um deine Bewerbungen zu personalisieren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Max Mustermann"
                          {...field}
                          disabled={updateProfile.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email (Read-only) */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-Mail *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="max@example.com"
                          {...field}
                          disabled
                          className="bg-gray-50"
                        />
                      </FormControl>
                      <FormDescription>
                        E-Mail kann nicht geändert werden
                      </FormDescription>
                    </FormItem>
                  )}
                />

                {/* Phone */}
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
                          disabled={updateProfile.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Location */}
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standort</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Berlin, Deutschland"
                          {...field}
                          disabled={updateProfile.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* LinkedIn */}
                <FormField
                  control={form.control}
                  name="linkedIn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn URL</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://linkedin.com/in/username"
                          {...field}
                          disabled={updateProfile.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Website */}
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website / Portfolio</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://example.com"
                          {...field}
                          disabled={updateProfile.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Summary (Full width) */}
              <FormField
                control={form.control}
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Professionelle Zusammenfassung</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Erzähle etwas über dich, deine Erfahrung und deine Ziele..."
                        className="min-h-[150px] resize-none"
                        {...field}
                        disabled={updateProfile.isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      Eine kurze Zusammenfassung deiner beruflichen Erfahrung und Ziele (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Skills Manager */}
              <SkillsManager
                skills={skills}
                onSkillsChange={setSkills}
                disabled={updateProfile.isPending}
              />

              {/* Experience Manager */}
              <ExperienceManager
                experiences={experiences}
                onExperiencesChange={setExperiences}
                disabled={updateProfile.isPending}
              />

              {/* Education Manager */}
              <EducationManager
                education={education}
                onEducationChange={setEducation}
                disabled={updateProfile.isPending}
              />

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateProfile.isPending}
                >
                  Abbrechen
                </Button>
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Speichern
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
