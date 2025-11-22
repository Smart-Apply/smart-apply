'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { useCreateApplication } from '@/hooks/use-applications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CenteredLoader } from '@/components/shared/loading';
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
  Eye,
  Package,
} from 'lucide-react';
import Link from 'next/link';
import type { ApplicationGenerationStatus } from '@/types';
import { toast } from 'sonner';
import { PDFPreviewModal } from '@/components/pdf/pdf-preview-modal';
import { handleDownload, handleZipDownload, generateFilename } from '@/lib/pdf-utils';
import { EditableTitle } from '@/components/applications/editable-title';
import { StatusDropdown } from '@/components/applications/status-dropdown';

// Local alias for generation status
type ApplicationStatus = ApplicationGenerationStatus;

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
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const applicationId = params.id as string;
  const createApplication = useCreateApplication();
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    filename: string;
    title: string;
  } | null>(null);
  const [isDownloading, setIsDownloading] = useState<{
    coverLetter?: boolean;
    resume?: boolean;
    both?: boolean;
  }>({});
  
  // Track previous status to detect changes
  const prevStatusRef = useRef<ApplicationStatus | null>(null);

  // Main query: Load full application details (no polling)
  const { data: application, isLoading, error, refetch } = useQuery({
    queryKey: ['applications', applicationId],
    queryFn: () => api.applications.getById(applicationId),
    enabled: isAuthenticated && !!applicationId,
  });

  // Status polling: Lightweight status checks (600/min rate limit)
  const { data: statusData } = useQuery({
    queryKey: ['applications', applicationId, 'status'],
    queryFn: () => api.applications.getStatus(applicationId),
    enabled: isAuthenticated && !!applicationId && (application?.status === 'PENDING' || application?.status === 'GENERATING'),
    refetchInterval: (query) => {
      // Poll every 10 seconds if status is PENDING or GENERATING
      const status = query.state.data?.status;
      return status === 'PENDING' || status === 'GENERATING' ? 10000 : false;
    },
  });

  // Update main application status when status poll detects change
  useEffect(() => {
    if (statusData && application && statusData.status !== application.status) {
      // Status changed - refetch full application details
      refetch();
    }
  }, [statusData, application, refetch]);

  // Detect status changes and show toast notifications
  useEffect(() => {
    if (!application) return;
    
    const prevStatus = prevStatusRef.current;
    const currentStatus = application.status;
    
    // Only show toast if status actually changed
    if (prevStatus && prevStatus !== currentStatus) {
      const jobTitle = application.jobPosting?.title || 'Bewerbung';
      
      if (currentStatus === 'READY') {
        toast.success('Bewerbung fertig! 🎉', {
          description: `${jobTitle} ist bereit zum Download.`,
          duration: 5000,
        });
      } else if (currentStatus === 'FAILED') {
        toast.error('Generierung fehlgeschlagen', {
          description: `${jobTitle} konnte nicht erstellt werden.`,
          duration: 6000,
        });
      } else if (currentStatus === 'GENERATING') {
        toast.info('Generierung gestartet', {
          description: `${jobTitle} wird jetzt erstellt...`,
          duration: 4000,
        });
      }
    }
    
    // Update tracking
    prevStatusRef.current = currentStatus;
  }, [application]);

  const { data: files, refetch: refetchFiles } = useQuery({
    queryKey: ['applications', applicationId, 'files'],
    queryFn: () => api.applications.getFiles(applicationId),
    enabled: isAuthenticated && !!applicationId && application?.status === 'READY',
  });

  const handleExpiredUrl = () => {
    // Refetch files when URL has expired
    queryClient.invalidateQueries({ queryKey: ['applications', applicationId, 'files'] });
    refetchFiles();
  };

  const handleDownloadCoverLetter = async () => {
    if (!application || !isAuthenticated) return;
    
    setIsDownloading((prev) => ({ ...prev, coverLetter: true }));
    try {
      const filename = generateFilename(
        'cover-letter',
        application?.jobPosting?.company,
        application?.jobPosting?.title
      );
      const url = `${process.env.NEXT_PUBLIC_API_URL}/applications/${application.id}/download/cover-letter`;
      await handleDownload(url, filename, handleExpiredUrl);
    } finally {
      setIsDownloading((prev) => ({ ...prev, coverLetter: false }));
    }
  };

  const handleDownloadResume = async () => {
    if (!application || !isAuthenticated) return;
    
    setIsDownloading((prev) => ({ ...prev, resume: true }));
    try {
      const filename = generateFilename(
        'resume',
        application?.jobPosting?.company,
        application?.jobPosting?.title
      );
      const url = `${process.env.NEXT_PUBLIC_API_URL}/applications/${application.id}/download/resume`;
      await handleDownload(url, filename, handleExpiredUrl);
    } finally {
      setIsDownloading((prev) => ({ ...prev, resume: false }));
    }
  };

  const handleDownloadBoth = async () => {
    if (!files?.coverLetter || !files?.resume) return;
    
    setIsDownloading((prev) => ({ ...prev, both: true }));
    try {
      const coverLetterFilename = generateFilename(
        'cover-letter',
        application?.jobPosting?.company,
        application?.jobPosting?.title
      );
      const resumeFilename = generateFilename(
        'resume',
        application?.jobPosting?.company,
        application?.jobPosting?.title
      );
      
      const company = application?.jobPosting?.company || 'company';
      const zipFilename = `${company.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-bewerbung.zip`;
      
      await handleZipDownload(
        [
          { url: files.coverLetter.url, filename: coverLetterFilename },
          { url: files.resume.url, filename: resumeFilename },
        ],
        zipFilename,
        handleExpiredUrl
      );
    } finally {
      setIsDownloading((prev) => ({ ...prev, both: false }));
    }
  };

  const handlePreviewCoverLetter = async () => {
    if (!application?.id || !isAuthenticated) return;

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/applications/${application.id}/download/cover-letter`;
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch PDF');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      setPreviewFile({
        url: blobUrl,
        filename: generateFilename(
          'cover-letter',
          application?.jobPosting?.company,
          application?.jobPosting?.title
        ),
        title: 'Anschreiben',
      });
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Fehler beim Laden der Vorschau');
    }
  };

  const handlePreviewResume = async () => {
    if (!application?.id || !isAuthenticated) return;

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/applications/${application.id}/download/resume`;
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch PDF');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      setPreviewFile({
        url: blobUrl,
        filename: generateFilename(
          'resume',
          application?.jobPosting?.company,
          application?.jobPosting?.title
        ),
        title: 'Lebenslauf',
      });
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Fehler beim Laden der Vorschau');
    }
  };

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
    return <CenteredLoader message="Lädt Bewerbung..." />;
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
              <Button onClick={() => router.push('/applications')}>
                Zu Bewerbungen
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

      {/* Application Header with Editable Title and Status */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <EditableTitle
            applicationId={applicationId}
            initialTitle={application.title}
            fallbackId={applicationId}
          />
        </div>
        <StatusDropdown
          applicationId={applicationId}
          currentStatus={application.applicationStatus}
          variant="dropdown"
        />
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
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Deine Bewerbung wurde erstellt. Passe nun deinen Lebenslauf und dein Anschreiben an.
                </p>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => router.push(`/applications/${applicationId}/edit`)}
                  className="mt-2"
                >
                  Unterlagen anpassen & Export starten
                </Button>
              </div>
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
                  {application.errorMessage && (
                    <span className="block mt-1 font-mono text-xs text-red-700 bg-red-50 p-2 rounded">
                      {application.errorMessage}
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
              loading={createApplication.isPending}
              className="flex-shrink-0"
            >
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Bewerbungsunterlagen
                </CardTitle>
                <CardDescription>
                  Deine generierten Bewerbungsunterlagen sind bereit zum Download
                </CardDescription>
              </div>
              {files?.coverLetter && files?.resume && (
                <Button
                  variant="outline"
                  onClick={handleDownloadBoth}
                  loading={isDownloading.both}
                >
                  <Package className="mr-2 h-4 w-4" />
                  Beide als ZIP
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {files?.coverLetter && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <FileText className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Anschreiben</p>
                      <p className="text-sm text-gray-500">PDF-Dokument</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Link läuft ab: {new Date(files.coverLetter.expiresAt).toLocaleTimeString('de-DE')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={handlePreviewCoverLetter}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Vorschau
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleDownloadCoverLetter}
                      loading={isDownloading.coverLetter}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              )}

              {files?.resume && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <FileText className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Lebenslauf</p>
                      <p className="text-sm text-gray-500">PDF-Dokument</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Link läuft ab: {new Date(files.resume.expiresAt).toLocaleTimeString('de-DE')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={handlePreviewResume}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Vorschau
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleDownloadResume}
                      loading={isDownloading.resume}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PDF Preview Modal */}
      {previewFile && (
        <PDFPreviewModal
          isOpen={!!previewFile}
          onClose={() => {
            // Cleanup blob URL if it was created
            if (previewFile.url.startsWith('blob:')) {
              URL.revokeObjectURL(previewFile.url);
            }
            setPreviewFile(null);
          }}
          url={previewFile.url}
          filename={previewFile.filename}
          title={previewFile.title}
          onExpired={handleExpiredUrl}
        />
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
