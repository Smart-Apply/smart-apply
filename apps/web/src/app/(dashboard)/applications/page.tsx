'use client';

import { useState, useEffect, useRef } from 'react';
import { useApplications, useDeleteApplication } from '@/hooks/use-applications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CenteredLoader } from '@/components/shared/loading';
import { ApplicationCardSkeleton } from '@/components/shared/skeletons';
import { Plus, FileText, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ApplicationGenerationStatus } from '@/types';
import { StatusDropdown } from '@/components/applications/status-dropdown';
import { APPLICATION_ID_DISPLAY_LENGTH } from '@/lib/constants';

// Local type alias for PDF generation status to maintain backward compatibility
// with existing helper functions (getStatusInfo) that expect ApplicationStatus
type ApplicationStatus = ApplicationGenerationStatus;

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
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState<{ id: string; title: string } | null>(null);
  
  // Track previous application statuses to detect changes
  const prevStatusesRef = useRef<Map<string, ApplicationStatus>>(new Map());

  // Delete application mutation
  const deleteApplication = useDeleteApplication();

  // Fetch applications (no polling - SSE handles real-time updates on detail pages)
  const { data: applications, isLoading, refetch } = useApplications();

  // Detect status changes and show toast notifications
  useEffect(() => {
    if (!applications) return;

    applications.forEach((app) => {
      const prevStatus = prevStatusesRef.current.get(app.id);
      
      // Only show toast if status actually changed
      if (prevStatus && prevStatus !== app.status) {
        const jobTitle = app.jobPosting?.title || 'Bewerbung';
        
        if (app.status === 'READY') {
          toast.success('Bewerbung fertig! 🎉', {
            description: `${jobTitle} ist bereit zum Download.`,
            duration: 5000,
          });
        } else if (app.status === 'FAILED') {
          toast.error('Generierung fehlgeschlagen', {
            description: `${jobTitle} konnte nicht erstellt werden.`,
            duration: 6000,
          });
        } else if (app.status === 'GENERATING') {
          toast.info('Generierung gestartet', {
            description: `${jobTitle} wird jetzt erstellt...`,
            duration: 4000,
          });
        }
      }
      
      // Update tracking
      prevStatusesRef.current.set(app.id, app.status);
    });
  }, [applications]);

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

  // Delete handlers
  const handleDeleteClick = (id: string, title: string) => {
    setApplicationToDelete({ id, title });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!applicationToDelete) return;
    
    await deleteApplication.mutateAsync(applicationToDelete.id);
    setDeleteDialogOpen(false);
    setApplicationToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setApplicationToDelete(null);
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
                              {application.title || `Bewerbung #${application.id.substring(0, APPLICATION_ID_DISPLAY_LENGTH)}`}
                            </CardTitle>
                            <CardDescription className="mt-1 space-y-1">
                              <div>
                                {application.jobPosting?.company && (
                                  <span className="font-medium">{application.jobPosting.company}</span>
                                )}
                                {application.jobPosting?.location && (
                                  <span className="text-gray-500">
                                    {' • '}
                                    {application.jobPosting.location}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                {application.applicationStatus ? (
                                  <StatusDropdown
                                    applicationId={application.id}
                                    currentStatus={application.applicationStatus}
                                    variant="dropdown"
                                  />
                                ) : (
                                  <div className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
                                    DEBUG: applicationStatus = {JSON.stringify(application.applicationStatus)}
                                  </div>
                                )}
                              </div>
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
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleDeleteClick(
                                application.id, 
                                application.jobPosting?.title || `Bewerbung #${application.id}`
                              )}
                              disabled={deleteApplication.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bewerbung löschen?</DialogTitle>
            <DialogDescription>
              Möchtest du die Bewerbung für &quot;{applicationToDelete?.title}&quot; wirklich löschen?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
              disabled={deleteApplication.isPending}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteApplication.isPending}
            >
              {deleteApplication.isPending ? 'Wird gelöscht...' : 'Löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
