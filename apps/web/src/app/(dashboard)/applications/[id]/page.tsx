'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { useCreateApplication } from '@/hooks/use-applications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  FileText,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Briefcase,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import type { ApplicationStatus } from '@/types';
import { toast } from 'sonner';

function getStatusInfo(status: ApplicationStatus) {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Ausstehend',
        icon: Clock,
        variant: 'secondary' as const,
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
      };
    case 'GENERATING':
      return {
        label: 'Wird erstellt',
        icon: AlertCircle,
        variant: 'default' as const,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
      };
    case 'READY':
      return {
        label: 'Fertig',
        icon: CheckCircle,
        variant: 'default' as const,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
      };
    case 'FAILED':
      return {
        label: 'Fehlgeschlagen',
        icon: XCircle,
        variant: 'destructive' as const,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
      };
    default:
      return {
        label: status,
        icon: AlertCircle,
        variant: 'secondary' as const,
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
      };
  }
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const applicationId = params.id as string;
  const createApplication = useCreateApplication();

  const { data: application, isLoading, error } = useQuery({
    queryKey: ['applications', applicationId],
    queryFn: () => api.applications.getById(token!, applicationId),
    enabled: !!token && !!applicationId,
    refetchInterval: (data) => {
      // Poll every 5 seconds if status is PENDING or GENERATING
      return data?.status === 'PENDING' || data?.status === 'GENERATING' ? 5000 : false;
    },
  });

  const { data: files } = useQuery({
    queryKey: ['applications', applicationId, 'files'],
    queryFn: () => api.applications.getFiles(token!, applicationId),
    enabled: !!token && !!applicationId && application?.status === 'READY',
  });

  const handleGenerateAgain = async () => {
    if (!application?.jobPostingId) {
      toast.error('Job-Posting-ID nicht gefunden');
      return;
    }

    try {
      const newApplication = await createApplication.mutateAsync({
        jobPostingId: application.jobPostingId,
      });
      toast.success('Neue Bewerbung wird erstellt...');
      router.push(`/applications/${newApplication.id}`);
    } catch {
      toast.error('Fehler beim Erstellen der neuen Bewerbung');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Lädt Bewerbung...</p>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/applications')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zu Bewerbungen
        </Button>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Bewerbung nicht gefunden
              </h3>
              <p className="text-gray-500 mb-6">
                Die angeforderte Bewerbung existiert nicht oder du hast keine Berechtigung.
              </p>
              <Button asChild>
                <Link href="/applications">Zu Bewerbungen</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = getStatusInfo(application.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/applications')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zu Bewerbungen
        </Button>
      </div>

      {/* Status Banner */}
      <div className={`rounded-lg ${statusInfo.bgColor} p-4`}>
        <div className="flex items-center gap-3">
          <StatusIcon className={`h-6 w-6 ${statusInfo.color}`} />
          <div className="flex-1">
            <h3 className={`font-medium ${statusInfo.color}`}>
              Status: {statusInfo.label}
            </h3>
            {application.status === 'PENDING' && (
              <p className="text-sm text-gray-600 mt-1">
                Deine Bewerbung wird in die Warteschlange eingereiht...
              </p>
            )}
            {application.status === 'GENERATING' && (
              <p className="text-sm text-gray-600 mt-1">
                Die KI erstellt gerade dein Anschreiben und deinen Lebenslauf. Dies kann
                einige Minuten dauern.
              </p>
            )}
            {application.status === 'READY' && (
              <p className="text-sm text-gray-600 mt-1">
                Deine Bewerbungsunterlagen sind fertig zum Download!
              </p>
            )}
            {application.status === 'FAILED' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Bei der Erstellung ist ein Fehler aufgetreten.
                  {application.error && (
                    <span className="block mt-1 font-mono text-xs text-red-700 bg-red-50 p-2 rounded">
                      {application.error}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
          {application.status === 'READY' && (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle className="mr-1 h-3 w-3" />
              Fertig
            </Badge>
          )}
          {application.status === 'FAILED' && (
            <Button
              variant="default"
              size="sm"
              onClick={handleGenerateAgain}
              disabled={createApplication.isPending}
              className="flex-shrink-0"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${createApplication.isPending ? 'animate-spin' : ''}`} />
              Erneut generieren
            </Button>
          )}
        </div>
      </div>

      {/* Job Posting Details */}
      {application.jobPosting && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Stellenanzeige
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-xl font-bold">{application.jobPosting.title}</h3>
              <p className="text-gray-600 mt-1">{application.jobPosting.company}</p>
              {application.jobPosting.location && (
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {application.jobPosting.location}
                </p>
              )}
            </div>

            {application.jobPosting.description && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Beschreibung</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {application.jobPosting.description}
                  </p>
                </div>
              </>
            )}

            {application.jobPosting.requirements &&
              application.jobPosting.requirements.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Anforderungen</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {application.jobPosting.requirements.map((req, index) => (
                        <li key={index} className="text-sm text-gray-600">
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {application.status === 'READY' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bewerbungsunterlagen
            </CardTitle>
            <CardDescription>
              Deine generierten Bewerbungsunterlagen sind bereit zum Download
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {files?.coverLetter && (
                <a
                  href={files.coverLetter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Anschreiben</p>
                    <p className="text-sm text-gray-500">PDF-Dokument</p>
                  </div>
                  <Download className="h-5 w-5 text-gray-400" />
                </a>
              )}

              {files?.resume && (
                <a
                  href={files.resume}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Lebenslauf</p>
                    <p className="text-sm text-gray-500">PDF-Dokument</p>
                  </div>
                  <Download className="h-5 w-5 text-gray-400" />
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Application Info */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Erstellt am</span>
            <span className="font-medium">
              {new Date(application.createdAt).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Zuletzt aktualisiert</span>
            <span className="font-medium">
              {new Date(application.updatedAt).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Bewerbungs-ID</span>
            <span className="font-mono text-xs">{application.id}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
