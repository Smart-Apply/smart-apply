'use client';

import { useState, useEffect } from 'react';
import { useApplications } from '@/hooks/use-applications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CenteredLoader } from '@/components/shared/loading';
import { ApplicationCardSkeleton } from '@/components/shared/skeletons';
import { Plus, FileText, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
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

type FilterStatus = 'all' | ApplicationStatus;

export default function ApplicationsPage() {
  const router = useRouter();
  const { data: applications, isLoading, refetch } = useApplications();
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh polling for applications with PENDING or GENERATING status
  useEffect(() => {
    if (!applications) return;

    const hasActiveApplications = applications.some(
      (app) => app.status === 'PENDING' || app.status === 'GENERATING'
    );

    if (hasActiveApplications) {
      const interval = setInterval(() => {
        refetch();
      }, 10000); // Poll every 10 seconds

      return () => clearInterval(interval);
    }
  }, [applications, refetch]);

  // Filter applications by status
  const filteredApplications = applications?.filter((app) => {
    if (selectedFilter === 'all') return true;
    return app.status === selectedFilter;
  }) || [];

  // Sort by date (most recent first)
  const sortedApplications = [...filteredApplications].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Count applications by status
  const statusCounts = {
    all: applications?.length || 0,
    PENDING: applications?.filter((app) => app.status === 'PENDING').length || 0,
    GENERATING: applications?.filter((app) => app.status === 'GENERATING').length || 0,
    READY: applications?.filter((app) => app.status === 'READY').length || 0,
    FAILED: applications?.filter((app) => app.status === 'FAILED').length || 0,
  };

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bewerbungen</h1>
          <p className="mt-1 text-gray-500">
            Verwalte alle deine Bewerbungen an einem Ort
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Button onClick={() => router.push('/applications/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Bewerbung
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <ApplicationCardSkeleton />
          <ApplicationCardSkeleton />
          <ApplicationCardSkeleton />
        </div>
      ) : applications && applications.length > 0 ? (
        <Tabs defaultValue="all" value={selectedFilter} onValueChange={(value) => setSelectedFilter(value as FilterStatus)}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">
              Alle <Badge variant="secondary" className="ml-2">{statusCounts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="PENDING">
              Ausstehend <Badge variant="secondary" className="ml-2">{statusCounts.PENDING}</Badge>
            </TabsTrigger>
            <TabsTrigger value="GENERATING">
              In Bearbeitung <Badge variant="secondary" className="ml-2">{statusCounts.GENERATING}</Badge>
            </TabsTrigger>
            <TabsTrigger value="READY">
              Fertig <Badge variant="secondary" className="ml-2">{statusCounts.READY}</Badge>
            </TabsTrigger>
            <TabsTrigger value="FAILED">
              Fehlgeschlagen <Badge variant="secondary" className="ml-2">{statusCounts.FAILED}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedFilter} className="mt-0">
            {sortedApplications.length > 0 ? (
              <div className="grid gap-4">
                {sortedApplications.map((application) => {
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
                            <StatusIcon className={`mr-1 h-3 w-3 ${application.status === 'GENERATING' ? 'animate-spin' : ''}`} />
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
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(application.coverLetterUrl, '_blank')}
                                  >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Anschreiben
                                  </Button>
                                )}
                                {application.resumeUrl && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(application.resumeUrl, '_blank')}
                                  >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Lebenslauf
                                  </Button>
                                )}
                              </>
                            )}
                            <Button size="sm" onClick={() => router.push(`/applications/${application.id}`)}>
                              Details
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
                      Keine Bewerbungen gefunden
                    </h3>
                    <p className="text-gray-500">
                      Es gibt keine Bewerbungen mit dem Status &quot;{getStatusInfo(selectedFilter as ApplicationStatus).label}&quot;
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
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
              <Button onClick={() => router.push('/applications/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Erste Bewerbung erstellen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
