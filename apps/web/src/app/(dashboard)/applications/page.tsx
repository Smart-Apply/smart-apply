'use client';

import { useApplications } from '@/hooks/use-applications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import type { ApplicationStatus } from '@/types';

function getStatusInfo(status: ApplicationStatus) {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Ausstehend',
        icon: Clock,
        variant: 'secondary' as const,
        color: 'text-gray-600',
      };
    case 'GENERATING':
      return {
        label: 'Wird erstellt',
        icon: AlertCircle,
        variant: 'default' as const,
        color: 'text-blue-600',
      };
    case 'READY':
      return {
        label: 'Fertig',
        icon: CheckCircle,
        variant: 'default' as const,
        color: 'text-green-600',
      };
    case 'FAILED':
      return {
        label: 'Fehlgeschlagen',
        icon: XCircle,
        variant: 'destructive' as const,
        color: 'text-red-600',
      };
    default:
      return {
        label: status,
        icon: AlertCircle,
        variant: 'secondary' as const,
        color: 'text-gray-600',
      };
  }
}

export default function ApplicationsPage() {
  const { data: applications, isLoading } = useApplications();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bewerbungen</h1>
          <p className="mt-1 text-gray-500">
            Verwalte alle deine Bewerbungen an einem Ort
          </p>
        </div>
        <Button asChild>
          <Link href="/applications/new">
            <Plus className="mr-2 h-4 w-4" />
            Neue Bewerbung
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Lädt Bewerbungen...</p>
          </div>
        </div>
      ) : applications && applications.length > 0 ? (
        <div className="grid gap-4">
          {applications.map((application) => {
            const statusInfo = getStatusInfo(application.status);
            const StatusIcon = statusInfo.icon;

            return (
              <Card key={application.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">
                        {application.jobPosting?.title || `Bewerbung #${application.id}`}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {application.jobPosting?.company && (
                          <span className="font-medium">{application.jobPosting.company}</span>
                        )}
                        {application.jobPosting?.location && (
                          <span className="text-gray-500">
                            {' • '}
                            {application.jobPosting.location}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <Badge variant={statusInfo.variant} className="ml-4">
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {statusInfo.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Erstellt am{' '}
                      {new Date(application.createdAt).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="flex gap-2">
                      {application.status === 'READY' && (
                        <>
                          {application.coverLetterUrl && (
                            <Button asChild variant="outline" size="sm">
                              <a
                                href={application.coverLetterUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                Anschreiben
                              </a>
                            </Button>
                          )}
                          {application.resumeUrl && (
                            <Button asChild variant="outline" size="sm">
                              <a
                                href={application.resumeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                Lebenslauf
                              </a>
                            </Button>
                          )}
                        </>
                      )}
                      <Button asChild size="sm">
                        <Link href={`/applications/${application.id}`}>Details</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Noch keine Bewerbungen
              </h3>
              <p className="text-gray-500 mb-6">
                Erstelle deine erste Bewerbung mit KI-Unterstützung
              </p>
              <Button asChild>
                <Link href="/applications/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Erste Bewerbung erstellen
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
