'use client';

import { useParams, useRouter } from 'next/navigation';
import { useInterviewSession } from '@/hooks/use-interviews';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { InterviewChat, InterviewFeedbackDisplay } from '@/components/interviews';
import { ArrowLeft, MessageSquare, Trophy } from 'lucide-react';

const statusConfig = {
  IN_PROGRESS: { label: 'Laufend', variant: 'default' as const },
  COMPLETED: { label: 'Abgeschlossen', variant: 'secondary' as const },
  ABANDONED: { label: 'Abgebrochen', variant: 'destructive' as const },
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

export default function InterviewSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const { data: session, isLoading, refetch } = useInterviewSession(sessionId);

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container max-w-4xl py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Interview-Session nicht gefunden.</p>
            <Button
              variant="outline"
              onClick={() => router.push('/interviews')}
              className="mt-4"
            >
              Zurück zur Übersicht
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = statusConfig[session.status];
  const isCompleted = session.status === 'COMPLETED';
  const isInProgress = session.status === 'IN_PROGRESS';

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/interviews')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">
              {session.jobTitle || 'Allgemeines Interview'}
            </h1>
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>
          {session.company && (
            <p className="text-muted-foreground">{session.company}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline">{typeLabels[session.type]}</Badge>
            <Badge variant="outline">{difficultyLabels[session.difficulty]}</Badge>
            {session.industry && <Badge variant="outline">{session.industry}</Badge>}
            <Badge variant="outline" className="gap-1">
              <MessageSquare className="h-3 w-3" />
              {session.answeredCount}/{session.maxQuestions} Fragen
            </Badge>
            {session.overallScore !== undefined && session.overallScore !== null && (
              <Badge variant="outline" className="gap-1">
                <Trophy className="h-3 w-3 text-yellow-500" />
                {session.overallScore}/100 Punkte
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {isInProgress ? (
        <InterviewChat 
          session={session} 
          onComplete={() => refetch()} 
          onAbandon={() => router.push('/interviews')} 
        />
      ) : isCompleted && session.feedback ? (
        <InterviewFeedbackDisplay session={session} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Interview beendet</CardTitle>
            <CardDescription>
              Diese Interview-Session wurde {session.status === 'ABANDONED' ? 'abgebrochen' : 'beendet'}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                {session.status === 'ABANDONED'
                  ? 'Sie können ein neues Interview starten, um zu üben.'
                  : 'Sehen Sie sich Ihr Feedback und die Ergebnisse an.'}
              </p>
              <Button onClick={() => router.push('/interviews')}>
                Zur Übersicht
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
