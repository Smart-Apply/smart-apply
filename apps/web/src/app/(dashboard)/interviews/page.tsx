'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useInterviewSessions, useInterviewStats, useStartInterview } from '@/hooks/use-interviews';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StartInterviewDialog } from '@/components/interviews/start-interview-dialog';
import { InterviewStatsCards } from '@/components/interviews/interview-stats-cards';
import { InterviewProgressChart } from '@/components/interviews/interview-progress-chart';
import {
  MessageSquare,
  Play,
  Trophy,
  TrendingUp,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { InterviewSession, InterviewSessionStatus } from '@/types';

const statusConfig: Record<
  InterviewSessionStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  IN_PROGRESS: { label: 'Laufend', variant: 'default' },
  COMPLETED: { label: 'Abgeschlossen', variant: 'secondary' },
  ABANDONED: { label: 'Abgebrochen', variant: 'destructive' },
};

const difficultyLabels = {
  EASY: 'Einsteiger',
  MEDIUM: 'Standard',
  HARD: 'Experte',
};

const typeLabels = {
  BEHAVIORAL: 'Verhalten',
  TECHNICAL: 'Technisch',
  CASE_STUDY: 'Fallstudie',
  MIXED: 'Gemischt',
};

function SessionCard({ session }: { session: InterviewSession }) {
  const router = useRouter();
  const config = statusConfig[session.status];

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push(`/interviews/${session.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {session.jobTitle || 'Allgemeines Interview'}
            </CardTitle>
            {session.company && (
              <CardDescription>{session.company}</CardDescription>
            )}
          </div>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="outline">{typeLabels[session.type]}</Badge>
          <Badge variant="outline">{difficultyLabels[session.difficulty]}</Badge>
          {session.industry && <Badge variant="outline">{session.industry}</Badge>}
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              {session.answeredCount}/{session.maxQuestions} Fragen
            </span>
            {session.overallScore !== undefined && session.overallScore !== null && (
              <span className="flex items-center gap-1">
                <Trophy className="h-4 w-4 text-yellow-500" />
                {session.overallScore}/100
              </span>
            )}
          </div>
          <span>
            {new Date(session.startedAt).toLocaleDateString('de-DE')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function InterviewsPage() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');

  const statusFilter = activeTab === 'all' ? undefined : (activeTab as InterviewSessionStatus);
  const { data: sessionsData, isLoading: sessionsLoading } = useInterviewSessions({
    status: statusFilter,
  });
  const { data: stats, isLoading: statsLoading } = useInterviewStats();
  const startInterview = useStartInterview();

  const handleStartInterview = async (data: Parameters<typeof startInterview.mutateAsync>[0]) => {
    const session = await startInterview.mutateAsync(data);
    setDialogOpen(false);
    router.push(`/interviews/${session.id}`);
  };

  return (
    <div className="container max-w-7xl py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interview Coach</h1>
          <p className="text-muted-foreground">
            Üben Sie Vorstellungsgespräche mit KI-gestütztem Feedback
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Play className="h-4 w-4" />
          Neues Interview starten
        </Button>
      </div>

      {/* Stats Overview */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <InterviewStatsCards stats={stats} />
      ) : null}

      {/* Progress Chart */}
      {stats && stats.completedSessions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Fortschritt
            </CardTitle>
            <CardDescription>
              Ihre Entwicklung über die letzten Interviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InterviewProgressChart stats={stats} />
          </CardContent>
        </Card>
      )}

      {/* Sessions List */}
      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="IN_PROGRESS" className="gap-1">
              <Loader2 className="h-3 w-3" />
              Laufend
            </TabsTrigger>
            <TabsTrigger value="COMPLETED" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Abgeschlossen
            </TabsTrigger>
            <TabsTrigger value="ABANDONED" className="gap-1">
              <XCircle className="h-3 w-3" />
              Abgebrochen
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {sessionsLoading ? (
              <SessionsSkeleton />
            ) : !sessionsData?.sessions?.length ? (
              <EmptyState
                icon={MessageSquare}
                title="Keine Interview-Sessions"
                description={
                  activeTab === 'all'
                    ? 'Starten Sie Ihr erstes KI-Interview, um Ihre Fähigkeiten zu verbessern.'
                    : 'Keine Sessions mit diesem Status gefunden.'
                }
                action={
                  activeTab === 'all'
                    ? {
                        label: 'Interview starten',
                        onClick: () => setDialogOpen(true),
                      }
                    : undefined
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sessionsData.sessions.map((session: InterviewSession) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Start Interview Dialog */}
      <StartInterviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onStart={handleStartInterview}
        isLoading={startInterview.isPending}
      />
    </div>
  );
}
