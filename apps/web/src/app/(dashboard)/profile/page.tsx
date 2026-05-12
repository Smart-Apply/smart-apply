'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useProfile, useUpdateProfile } from '@/hooks/use-profile';
import { useAuthStore } from '@/stores/auth-store';
import { calculateProfileStrength } from '@/lib/profile-utils';
import { getLanguageLevelLabel } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProfileSkeleton } from '@/components/shared/skeletons';
import { sanitizeUrl } from '@/lib/sanitize';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { AnalyticsOverview } from '@/types';
import {
  MapPin,
  Phone,
  Mail,
  Linkedin,
  Briefcase,
  Plus,
  Upload,
  X,
  Star,
  Pencil,
  Languages,
  Code2,
  BarChart3,
  Award,
  Loader2,
  FolderKanban,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/format-date';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useParseResume } from '@/hooks/use-parse-resume';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FileUpload } from '@/components/ui/file-upload';
import type { UpdateProfileDto } from '@/types';

const SKILL_SUGGESTIONS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'PHP', 'Ruby',
  'Swift', 'Kotlin', 'React', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'Node.js', 'NestJS',
  'Express', 'Django', 'Flask', 'Spring Boot', 'Laravel', '.NET', 'Ruby on Rails',
  'HTML', 'CSS', 'Tailwind CSS', 'SASS', 'Bootstrap',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Firebase', 'Supabase',
  'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud', 'Terraform', 'CI/CD',
  'Git', 'GitHub', 'GitLab', 'Jira', 'Confluence',
  'REST API', 'GraphQL', 'gRPC', 'WebSockets',
  'Linux', 'Bash', 'PowerShell',
  'Figma', 'Adobe XD', 'Photoshop', 'Illustrator',
  'Agile', 'Scrum', 'Kanban', 'Projektmanagement',
  'SAP', 'Salesforce', 'Power BI', 'Tableau', 'Excel', 'Microsoft Office',
  'Machine Learning', 'Data Science', 'TensorFlow', 'PyTorch',
  'Verhandlungsführung', 'Kommunikation', 'Teamführung', 'Kundenbetreuung',
];

function InlineSkillInput({
  existingSkills,
  onAdd,
}: {
  existingSkills: string[];
  onAdd: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const existing = new Set(existingSkills.map((s) => s.toLowerCase()));

  const suggestions =
    value.trim().length > 0
      ? SKILL_SUGGESTIONS.filter(
          (s) =>
            s.toLowerCase().includes(value.toLowerCase()) && !existing.has(s.toLowerCase()),
        ).slice(0, 6)
      : SKILL_SUGGESTIONS.filter((s) => !existing.has(s.toLowerCase())).slice(0, 6);

  const submit = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (existing.has(trimmed.toLowerCase())) {
        toast.error('Dieser Skill existiert bereits');
        return;
      }
      onAdd(trimmed);
      setValue('');
      setHighlightIdx(-1);
      inputRef.current?.focus();
    },
    [existing, onAdd],
  );

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setValue('');
        setHighlightIdx(-1);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-5 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Skill hinzufügen
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative mt-4">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setHighlightIdx(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
                submit(suggestions[highlightIdx]);
              } else if (value.trim()) {
                submit(value);
              }
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlightIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightIdx((prev) => Math.max(prev - 1, -1));
            } else if (e.key === 'Escape') {
              setOpen(false);
              setValue('');
              setHighlightIdx(-1);
            }
          }}
          placeholder="z.B. React, Python, Projektmanagement…"
          className="h-9 text-sm"
        />
        <Button
          size="sm"
          disabled={!value.trim()}
          onClick={() => submit(value)}
          className="shrink-0"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Hinzufügen
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border bg-card p-1 shadow-md">
          <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Vorschläge
          </p>
          {suggestions.map((s, i) => (
            <button
              key={s}
              onMouseDown={(e) => {
                e.preventDefault();
                submit(s);
              }}
              onMouseEnter={() => setHighlightIdx(i)}
              className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                i === highlightIdx
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const LANGUAGE_SUGGESTIONS = [
  'Deutsch', 'Englisch', 'Französisch', 'Spanisch', 'Italienisch', 'Portugiesisch',
  'Niederländisch', 'Polnisch', 'Russisch', 'Türkisch', 'Arabisch', 'Chinesisch',
  'Japanisch', 'Koreanisch', 'Hindi', 'Griechisch', 'Tschechisch', 'Schwedisch',
  'Dänisch', 'Norwegisch', 'Finnisch', 'Rumänisch', 'Ungarisch', 'Kroatisch',
  'Serbisch', 'Ukrainisch', 'Bulgarisch', 'Hebräisch', 'Vietnamesisch', 'Thailändisch',
];

const LANGUAGE_LEVELS = [
  { value: 'NATIVE', label: 'Muttersprache' },
  { value: 'FLUENT', label: 'Fließend' },
  { value: 'ADVANCED', label: 'Fortgeschritten' },
  { value: 'INTERMEDIATE', label: 'Gut' },
  { value: 'BASIC', label: 'Grundkenntnisse' },
];

function InlineLanguageInput({
  existingLanguages,
  onAdd,
}: {
  existingLanguages: string[];
  onAdd: (name: string, level: string) => void;
}) {
  const [step, setStep] = useState<'closed' | 'name' | 'level'>('closed');
  const [name, setName] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const existing = new Set(existingLanguages.map((s) => s.toLowerCase()));

  const suggestions =
    name.trim().length > 0
      ? LANGUAGE_SUGGESTIONS.filter(
          (s) =>
            s.toLowerCase().includes(name.toLowerCase()) && !existing.has(s.toLowerCase()),
        ).slice(0, 6)
      : LANGUAGE_SUGGESTIONS.filter((s) => !existing.has(s.toLowerCase())).slice(0, 6);

  const selectLanguage = useCallback(
    (langName: string) => {
      const trimmed = langName.trim();
      if (!trimmed) return;
      if (existing.has(trimmed.toLowerCase())) {
        toast.error('Diese Sprache existiert bereits');
        return;
      }
      setName(trimmed);
      setStep('level');
      setHighlightIdx(-1);
    },
    [existing],
  );

  const addWithLevel = useCallback(
    (level: string) => {
      if (!name.trim()) return;
      onAdd(name.trim(), level);
      setName('');
      setStep('closed');
      setHighlightIdx(-1);
    },
    [name, onAdd],
  );

  const reset = useCallback(() => {
    setStep('closed');
    setName('');
    setHighlightIdx(-1);
  }, []);

  useEffect(() => {
    if (step === 'name') inputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        reset();
      }
    }
    if (step !== 'closed') document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [step, reset]);

  if (step === 'closed') {
    return (
      <button
        onClick={() => setStep('name')}
        className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Sprache hinzufügen
      </button>
    );
  }

  if (step === 'level') {
    return (
      <div ref={containerRef} className="mt-4 space-y-3">
        <p className="text-sm text-foreground">
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground"> — Wie gut sprichst du diese Sprache?</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_LEVELS.map((l) => (
            <button
              key={l.value}
              onClick={() => addWithLevel(l.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setStep('name'); setName(''); }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Zurück
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative mt-4">
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setHighlightIdx(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
              selectLanguage(suggestions[highlightIdx]);
            } else if (name.trim()) {
              selectLanguage(name);
            }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx((prev) => Math.max(prev - 1, -1));
          } else if (e.key === 'Escape') {
            reset();
          }
        }}
        placeholder="z.B. Englisch, Französisch…"
        className="h-9 text-sm"
      />

      {suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border bg-card p-1 shadow-md">
          <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Vorschläge
          </p>
          {suggestions.map((s, i) => (
            <button
              key={s}
              onMouseDown={(e) => {
                e.preventDefault();
                selectLanguage(s);
              }}
              onMouseEnter={() => setHighlightIdx(i)}
              className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                i === highlightIdx
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LanguageRow({
  lang,
  onRemove,
  onUpdateLevel,
}: {
  lang: { name: string; level?: string };
  onRemove: () => void;
  onUpdateLevel: (level: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setPicking(false);
      }
    }
    if (picking) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [picking]);

  const label = getLanguageLevelLabel(lang.level);

  if (picking) {
    return (
      <div ref={rowRef} className="space-y-2 rounded-lg bg-muted/40 p-2.5">
        <p className="text-sm font-medium text-foreground">{lang.name}</p>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGE_LEVELS.map((l) => (
            <button
              key={l.value}
              onClick={() => {
                onUpdateLevel(l.value);
                setPicking(false);
              }}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                lang.level === l.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="group/lang flex items-center justify-between text-sm">
      <span className="font-medium text-foreground">{lang.name}</span>
      <div className="flex items-center gap-2">
        {label ? (
          <button
            onClick={() => setPicking(true)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {label}
          </button>
        ) : (
          <button
            onClick={() => setPicking(true)}
            className="text-xs italic text-primary/60 transition-colors hover:text-primary"
          >
            Einstufung wählen
          </button>
        )}
        <button
          onClick={onRemove}
          className="rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/lang:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function CompanyMark({ name }: { name: string }) {
  const initials = name
    .split(/[\s]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0c1d3f] text-xs font-bold text-white">
      {initials}
    </div>
  );
}

function MiniDonut({ value }: { value: number }) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/40" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
        className="text-primary"
      />
      <text x="20" y="21" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-[11px] font-bold">
        {value}%
      </text>
    </svg>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: profile, isLoading, error } = useProfile();
  const updateProfile = useUpdateProfile();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [tipDismissed, setTipDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('profile-tip-dismissed') === 'true';
    }
    return false;
  });
  const [cvDialogOpen, setCvDialogOpen] = useState(false);
  const parseResume = useParseResume();

  const cvUploading = parseResume.isPending || updateProfile.isPending;

  const handleCvUpload = useCallback(
    async (file: File) => {
      try {
        const data = await parseResume.mutateAsync(file);
        const updateData: UpdateProfileDto = {};

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
          updateData.skills = data.skills.map((s) => ({ name: s.name, level: s.level }));
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

        await updateProfile.mutateAsync(updateData);
        toast.success('Lebenslauf erfolgreich importiert!');
        setCvDialogOpen(false);
        parseResume.reset();
      } catch {
        toast.error('Lebenslauf konnte nicht verarbeitet werden.');
      }
    },
    [parseResume, updateProfile],
  );

  const { data: analytics } = useQuery<AnalyticsOverview>({
    queryKey: ['analytics-overview'],
    queryFn: () => api.analytics.getOverview(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) return <ProfileSkeleton />;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        Profil konnte nicht geladen werden. Bitte versuche es später erneut.
      </div>
    );
  }

  const { score: profileStrength } = calculateProfileStrength(profile, user);

  const initials =
    `${user?.firstName?.charAt(0) ?? ''}${user?.lastName?.charAt(0) ?? ''}`
      .toUpperCase()
      .trim() || (user?.email?.charAt(0).toUpperCase() ?? '?');

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '';

  const location = [profile?.city, profile?.country].filter(Boolean).join(', ');
  const currentPosition = profile?.experiences?.[0]?.title;

  const linkedinDisplay = profile?.linkedinUrl
    ?.replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/$/, '');

  const handleAddSkill = useCallback(
    (name: string) => {
      const currentSkills = profile?.skills ?? [];
      const updatedSkills = [...currentSkills, { name }].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      updateProfile.mutate({ skills: updatedSkills });
    },
    [profile?.skills, updateProfile],
  );

  const handleRemoveSkill = useCallback(
    (name: string) => {
      const updatedSkills = (profile?.skills ?? []).filter(
        (s) => s.name.toLowerCase() !== name.toLowerCase(),
      );
      updateProfile.mutate({ skills: updatedSkills });
    },
    [profile?.skills, updateProfile],
  );

  const handleRemoveExperience = useCallback(
    (index: number) => {
      const updated = (profile?.experiences ?? []).filter((_, i) => i !== index);
      updateProfile.mutate({ experiences: updated });
    },
    [profile?.experiences, updateProfile],
  );

  const handleRemoveProject = useCallback(
    (index: number) => {
      const updated = (profile?.projects ?? []).filter((_, i) => i !== index);
      updateProfile.mutate({ projects: updated });
    },
    [profile?.projects, updateProfile],
  );

  const handleRemoveCertificate = useCallback(
    (index: number) => {
      const updated = (profile?.certificates ?? []).filter((_, i) => i !== index);
      updateProfile.mutate({ certificates: updated });
    },
    [profile?.certificates, updateProfile],
  );

  const handleRemoveLanguage = useCallback(
    (index: number) => {
      const updated = (profile?.languages ?? []).filter((_, i) => i !== index);
      updateProfile.mutate({ languages: updated });
    },
    [profile?.languages, updateProfile],
  );

  const handleAddLanguage = useCallback(
    (name: string, level: string) => {
      const currentLanguages = profile?.languages ?? [];
      const updatedLanguages = [...currentLanguages, { name, level }];
      updateProfile.mutate({ languages: updatedLanguages });
    },
    [profile?.languages, updateProfile],
  );

  const totalApps = analytics?.totals.applications ?? 0;
  const totalInterviews = analytics?.totals.interviews ?? 0;
  const responseRate = analytics ? Math.round(analytics.responseRate * 100) : 0;
  const interviewRate = analytics ? Math.round(analytics.interviewRate * 100) : 0;

  return (
    <div className="space-y-5 pb-10">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/dashboard" className="transition-colors hover:text-foreground">
            SmartApply
          </Link>
          <span>→</span>
          <span className="font-medium text-foreground">Mein Profil</span>
        </nav>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setCvDialogOpen(true)}
        >
          <Upload className="h-4 w-4" />
          CV hochladen
        </Button>
      </div>

      {/* ── Tip banner ── */}
      {!tipDismissed && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Star className="h-4 w-4 text-primary" />
          </div>
          <p className="flex-1 text-sm leading-relaxed">
            <span className="font-semibold">Tipp · So bearbeitest du dein Profil</span>{' '}
            Klicke auf jedes Feld um es zu ändern. Mit{' '}
            <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-xs">
              + hinzufügen
            </kbd>{' '}
            fügst du Einträge hinzu, mit{' '}
            <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-xs">
              −
            </kbd>{' '}
            löschst du sie.
          </p>
          <button
            onClick={() => {
              setTipDismissed(true);
              localStorage.setItem('profile-tip-dismissed', 'true');
            }}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* ════════ Left column (2/3) ════════ */}
        <div className="space-y-5 lg:col-span-2">
          {/* Profile info card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-start gap-4">
              <div className="relative shrink-0">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0c1d3f] text-xl font-bold text-white">
                  {initials}
                </div>
                <button
                  onClick={() => router.push('/profile/edit')}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white shadow-sm transition-colors hover:bg-muted"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{fullName}</h1>
                  <button
                    onClick={() => router.push('/profile/edit')}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Badge className="mt-1.5 border-green-200 bg-green-100 text-xs font-medium text-green-700 hover:bg-green-100">
                  ● Offen für neue Rollen
                </Badge>
                {location && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              {currentPosition && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex w-40 shrink-0 items-center gap-2 text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    <span>Aktuelle Position</span>
                  </div>
                  <span className="font-medium text-foreground">{currentPosition}</span>
                </div>
              )}
              {profile?.phone && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex w-40 shrink-0 items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>Telefon</span>
                  </div>
                  <span className="font-medium text-foreground">{profile.phone}</span>
                </div>
              )}
              {user?.email && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex w-40 shrink-0 items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>E-Mail</span>
                  </div>
                  <span className="font-medium text-foreground">{user.email}</span>
                </div>
              )}
              {profile?.linkedinUrl && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex w-40 shrink-0 items-center gap-2 text-muted-foreground">
                    <Linkedin className="h-4 w-4" />
                    <span>LinkedIn</span>
                  </div>
                  {sanitizeUrl(profile.linkedinUrl) ? (
                    <a
                      href={sanitizeUrl(profile.linkedinUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {linkedinDisplay}
                    </a>
                  ) : (
                    <span className="font-medium text-foreground">{linkedinDisplay}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Aktivität ── */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Aktivität</h2>
                <span className="text-sm text-muted-foreground">letzte 3 Monate</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
                <div className="flex-1">
                  <p className="text-2xl font-bold text-foreground">{totalApps}</p>
                  <p className="text-xs text-muted-foreground">Bewerbungen</p>
                </div>
                <MiniDonut value={responseRate} />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
                <div className="flex-1">
                  <p className="text-2xl font-bold text-foreground">{analytics?.totals.activelyTracked ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Profil-Aufrufe</p>
                </div>
                <MiniDonut value={interviewRate} />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
                <div className="flex-1">
                  <p className="text-2xl font-bold text-foreground">{totalInterviews}</p>
                  <p className="text-xs text-muted-foreground">Einladungen</p>
                </div>
                <MiniDonut value={analytics ? Math.round(analytics.offerRate * 100) : 0} />
              </div>
            </div>
          </div>

          {/* ── Fähigkeiten ── */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Fähigkeiten</h2>
                {(profile?.skills?.length ?? 0) > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {profile!.skills!.length} Skills
                  </span>
                )}
              </div>
            </div>

            {(profile?.skills?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile!.skills!.map((skill, i) => (
                  <span
                    key={i}
                    className="group relative inline-flex items-center rounded-md border border-primary bg-primary/10 py-1.5 pl-3 pr-7 text-xs font-medium text-primary transition-all duration-300 ease-in-out hover:bg-primary hover:text-primary-foreground"
                  >
                    {skill.name}
                    <button
                      onClick={() => handleRemoveSkill(skill.name)}
                      className="absolute right-1.5 shrink-0 rounded-full p-0.5 opacity-0 transition-all duration-300 ease-in-out group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Noch keine Fähigkeiten eingetragen.
              </p>
            )}

            <InlineSkillInput
              existingSkills={(profile?.skills ?? []).map((s) => s.name)}
              onAdd={handleAddSkill}
            />
          </div>

          {/* ── Berufserfahrung ── */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Berufserfahrung</h2>
                {(profile?.experiences?.length ?? 0) > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {profile!.experiences!.length} Stationen
                  </span>
                )}
              </div>
            </div>

            {(profile?.experiences?.length ?? 0) > 0 ? (
              <div className="space-y-6">
                {profile!.experiences!.map((exp, i) => (
                  <div key={i} className="group/exp flex gap-4">
                    <CompanyMark name={exp.company} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{exp.title}</p>
                          <p className="text-sm text-muted-foreground">{exp.company}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {formatDate(exp.startDate, 'MMM yyyy')}
                          </span>
                          <button
                            onClick={() => handleRemoveExperience(i)}
                            className="rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/exp:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {exp.description && (
                        <div
                          className="prose prose-sm mt-2 max-w-none text-sm leading-relaxed text-muted-foreground line-clamp-3"
                          dangerouslySetInnerHTML={{ __html: exp.description }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Noch keine Berufserfahrung eingetragen.
              </p>
            )}

            <button
              onClick={() => router.push('/profile/edit?tab=experience')}
              className="mt-5 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Berufserfahrung hinzufügen
            </button>
          </div>

          {/* ── Projekte ── */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Projekte</h2>
                {(profile?.projects?.length ?? 0) > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {profile!.projects!.length} Projekte
                  </span>
                )}
              </div>
            </div>

            {(profile?.projects?.length ?? 0) > 0 ? (
              <div className="space-y-5">
                {profile!.projects!.map((proj, i) => (
                  <div key={i} className="group/proj flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0c1d3f] text-xs font-bold text-white">
                      <FolderKanban className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{proj.name}</p>
                            {proj.url && (
                              <a
                                href={proj.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground transition-colors hover:text-primary"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          {proj.description && (
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                              {proj.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveProject(i)}
                          className="shrink-0 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/proj:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {proj.technologies && proj.technologies.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {proj.technologies.map((tech, ti) => (
                            <span
                              key={ti}
                              className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Noch keine Projekte eingetragen.
              </p>
            )}

            <button
              onClick={() => router.push('/profile/edit?tab=projects')}
              className="mt-5 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Projekt hinzufügen
            </button>
          </div>

          {/* ── Zertifikate ── */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Zertifikate</h2>
                {(profile?.certificates?.length ?? 0) > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {profile!.certificates!.length} Zertifikate
                  </span>
                )}
              </div>
            </div>

            {(profile?.certificates?.length ?? 0) > 0 ? (
              <div className="space-y-4">
                {profile!.certificates!.map((cert, i) => (
                  <div key={i} className="group/cert flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0c1d3f] text-xs font-bold text-white">
                      <Award className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{cert.name}</p>
                          <p className="text-sm text-muted-foreground">{cert.issuer}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {cert.dateObtained && (
                            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {formatDate(cert.dateObtained, 'MMM yyyy')}
                            </span>
                          )}
                          <button
                            onClick={() => handleRemoveCertificate(i)}
                            className="rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/cert:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {cert.credentialId && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          ID: {cert.credentialId}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Noch keine Zertifikate eingetragen.
              </p>
            )}

            <button
              onClick={() => router.push('/profile/edit?tab=certificates')}
              className="mt-5 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Zertifikat hinzufügen
            </button>
          </div>

        </div>

        {/* ════════ Right sidebar (1/3) ════════ */}
        <div className="space-y-5">
          {/* Profile strength – dark card */}
          <div className="rounded-2xl bg-[#0c1d3f] p-6 text-white shadow-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
              PROFILSTÄRKE
            </p>
            <p className="mb-3 text-5xl font-bold leading-none">
              {profileStrength}
              <span className="text-2xl">%</span>
            </p>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all duration-500"
                style={{ width: `${profileStrength}%` }}
              />
            </div>
            <p className="text-sm leading-relaxed text-gray-300">
              {profileStrength === 100
                ? 'Dein Profil ist vollständig.'
                : 'Ein vollständiges Profil verbessert deine generierten Bewerbungen.'}
            </p>
          </div>

          {/* ── Empfohlene Stellen ── */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Empfohlene Stellen</h2>
              <Link
                href="/job-search"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Alle anzeigen
              </Link>
            </div>

            <p className="py-4 text-center text-sm text-muted-foreground">
              Starte eine{' '}
              <Link href="/job-search" className="font-medium text-primary hover:underline">
                Job-Suche
              </Link>{' '}
              um Empfehlungen basierend auf deinem Profil zu erhalten.
            </p>
          </div>

          {/* ── Sprachen ── */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Sprachen</h2>
              </div>
            </div>

            {(profile?.languages?.length ?? 0) > 0 ? (
              <div className="space-y-2.5">
                {profile!.languages!.map((lang, i) => (
                  <LanguageRow
                    key={i}
                    lang={lang}
                    onRemove={() => handleRemoveLanguage(i)}
                    onUpdateLevel={(level) => {
                      const updated = [...(profile?.languages ?? [])];
                      updated[i] = { ...updated[i], level };
                      updateProfile.mutate({ languages: updated });
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="py-2 text-center text-sm text-muted-foreground">
                Noch keine Sprachen eingetragen.
              </p>
            )}

            <InlineLanguageInput
              existingLanguages={(profile?.languages ?? []).map((l) => l.name)}
              onAdd={handleAddLanguage}
            />
          </div>
        </div>
      </div>

      {/* ── CV Upload Dialog ── */}
      <Dialog
        open={cvDialogOpen}
        onOpenChange={(open) => {
          if (!cvUploading) {
            setCvDialogOpen(open);
            if (!open) parseResume.reset();
          }
        }}
      >
        <DialogContent showCloseButton={!cvUploading}>
          <DialogHeader>
            <DialogTitle>Lebenslauf hochladen</DialogTitle>
            <DialogDescription>
              Lade deinen Lebenslauf hoch — wir lesen ihn aus und füllen dein Profil
              automatisch aus.
            </DialogDescription>
          </DialogHeader>

          {cvUploading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">
                {parseResume.isPending
                  ? 'Lebenslauf wird analysiert…'
                  : 'Profil wird aktualisiert…'}
              </p>
              <p className="text-xs text-muted-foreground">
                Das kann einen Moment dauern.
              </p>
            </div>
          ) : (
            <FileUpload
              onFileSelect={handleCvUpload}
              onFileRemove={() => parseResume.reset()}
              hint="PDF oder DOCX, max. 10 MB"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
