'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useApplications, useDeleteApplication } from '@/hooks/use-applications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApplicationCardSkeleton } from '@/components/shared/skeletons';
import {
  Plus,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Briefcase,
  Send,
  Users,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  Calendar,
  MapPin,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';
import type { Application, ApplicationGenerationStatus, ApplicationTrackingStatus } from '@/types';
import { StatusDropdown } from '@/components/applications/status-dropdown';
import { APPLICATION_ID_DISPLAY_LENGTH } from '@/lib/constants';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ============================================================================
// Constants & Types
// ============================================================================

const ITEMS_PER_PAGE = 10;

type SortOption = 'newest' | 'oldest' | 'title-asc' | 'company-asc';

// Tab configuration for application tracking status
const TRACKING_STATUS_TABS: {
  value: ApplicationTrackingStatus | 'all';
  label: string;
  icon: typeof Briefcase;
}[] = [
    { value: 'all', label: 'Alle', icon: Briefcase },
    { value: 'CREATED', label: 'Entwurf', icon: FileText },
    { value: 'APPLIED', label: 'Beworben', icon: Send },
    { value: 'INTERVIEW', label: 'Interview', icon: Users },
    { value: 'OFFER', label: 'Angebot', icon: CheckCircle },
    { value: 'ACCEPTED', label: 'Angenommen', icon: ThumbsUp },
    { value: 'REJECTED', label: 'Abgelehnt', icon: ThumbsDown },
    { value: 'WITHDRAWN', label: 'Zurückgezogen', icon: XCircle },
  ];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Neueste zuerst' },
  { value: 'oldest', label: 'Älteste zuerst' },
  { value: 'title-asc', label: 'Jobtitel A–Z' },
  { value: 'company-asc', label: 'Unternehmen A–Z' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getGenerationStatusInfo(status: ApplicationGenerationStatus) {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Ausstehend',
        icon: Clock,
        variant: 'secondary' as const,
        color: 'text-muted-foreground',
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
        label: 'PDF Fertig',
        icon: CheckCircle,
        variant: 'outline' as const,
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
        color: 'text-muted-foreground',
      };
  }
}

function sortApplications(applications: Application[], sortBy: SortOption): Application[] {
  return [...applications].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'title-asc':
        const titleA = (a.jobPosting?.title || a.title || '').toLowerCase();
        const titleB = (b.jobPosting?.title || b.title || '').toLowerCase();
        return titleA.localeCompare(titleB, 'de');
      case 'company-asc':
        const companyA = (a.jobPosting?.company || '').toLowerCase();
        const companyB = (b.jobPosting?.company || '').toLowerCase();
        return companyA.localeCompare(companyB, 'de');
      default:
        return 0;
    }
  });
}

// ============================================================================
// Component
// ============================================================================

export default function ApplicationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get initial values from URL query params
  const initialTab = (searchParams.get('status') as ApplicationTrackingStatus | 'all') || 'all';
  const initialSort = (searchParams.get('sort') as SortOption) || 'newest';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  const [selectedTab, setSelectedTab] = useState<ApplicationTrackingStatus | 'all'>(initialTab);
  const [sortBy, setSortBy] = useState<SortOption>(initialSort);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState<{ id: string; title: string } | null>(null);

  // Track previous application statuses to detect changes
  const prevStatusesRef = useRef<Map<string, ApplicationGenerationStatus>>(new Map());

  // Delete application mutation
  const deleteApplication = useDeleteApplication();

  // Fetch applications
  const { data: applications, isLoading, refetch } = useApplications();

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedTab !== 'all') params.set('status', selectedTab);
    if (sortBy !== 'newest') params.set('sort', sortBy);
    if (currentPage > 1) params.set('page', currentPage.toString());

    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

    // Use replaceState to avoid adding to history on every filter change
    window.history.replaceState(null, '', newUrl);
  }, [selectedTab, sortBy, currentPage, pathname]);

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

  // Filter applications by tracking status
  const filteredApplications = useMemo(() => {
    if (!applications) return [];
    if (selectedTab === 'all') return applications;
    return applications.filter((app) => app.applicationStatus === selectedTab);
  }, [applications, selectedTab]);

  // Sort filtered applications
  const sortedApplications = useMemo(() => {
    return sortApplications(filteredApplications, sortBy);
  }, [filteredApplications, sortBy]);

  // Pagination
  const totalPages = Math.ceil(sortedApplications.length / ITEMS_PER_PAGE);
  const paginatedApplications = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedApplications.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedApplications, currentPage]);

  // Reset to page 1 when filter or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTab, sortBy]);

  // Count applications by tracking status
  const statusCounts = useMemo(() => ({
    all: applications?.length || 0,
    CREATED: applications?.filter((app) => app.applicationStatus === 'CREATED').length || 0,
    APPLIED: applications?.filter((app) => app.applicationStatus === 'APPLIED').length || 0,
    INTERVIEW: applications?.filter((app) => app.applicationStatus === 'INTERVIEW').length || 0,
    OFFER: applications?.filter((app) => app.applicationStatus === 'OFFER').length || 0,
    ACCEPTED: applications?.filter((app) => app.applicationStatus === 'ACCEPTED').length || 0,
    REJECTED: applications?.filter((app) => app.applicationStatus === 'REJECTED').length || 0,
    WITHDRAWN: applications?.filter((app) => app.applicationStatus === 'WITHDRAWN').length || 0,
  }), [applications]);

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Tab change handler
  const handleTabChange = (value: string) => {
    setSelectedTab(value as ApplicationTrackingStatus | 'all');
  };

  // Sort change handler
  const handleSortChange = (value: string) => {
    setSortBy(value as SortOption);
  };

  // Pagination handlers
  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
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
    toast.success('Bewerbung gelöscht');
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setApplicationToDelete(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Bewerbungen</h1>
          <p className="mt-1 text-muted-foreground">
            Verwalte und verfolge den Status deiner Bewerbungen.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-10"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Button
            onClick={() => router.push('/applications/new')}
            className="h-10 shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="mr-2 h-4 w-4" />
            Neue Bewerbung
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ApplicationCardSkeleton />
          <ApplicationCardSkeleton />
          <ApplicationCardSkeleton />
          <ApplicationCardSkeleton />
          <ApplicationCardSkeleton />
          <ApplicationCardSkeleton />
        </div>
      ) : applications && applications.length > 0 ? (
        <div className="space-y-6">
          {/* Controls: Tabs & Sort */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-card/50 p-1 rounded-xl">
            <Tabs value={selectedTab} onValueChange={handleTabChange} className="w-full lg:w-auto">
              <TabsList className="h-auto flex-wrap justify-start bg-transparent p-0 gap-1">
                {TRACKING_STATUS_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const count = statusCounts[tab.value];
                  const isActive = selectedTab === tab.value;

                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg border border-transparent
                        data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border-border/50
                        transition-all duration-200
                      `}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                        {tab.label}
                      </span>
                      {count > 0 && (
                        <Badge
                          variant="secondary"
                          className={`
                            ml-1 h-5 min-w-[1.25rem] px-1 justify-center text-[10px]
                            ${isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}
                          `}
                        >
                          {count}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:inline-block">
                Sortieren nach:
              </span>
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Sortieren" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results Info */}
          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <span>
              {filteredApplications.length} {filteredApplications.length === 1 ? 'Bewerbung' : 'Bewerbungen'}
              {selectedTab !== 'all' && ` mit Status "${TRACKING_STATUS_TABS.find(t => t.value === selectedTab)?.label}"`}
            </span>
            {totalPages > 1 && (
              <span>
                Seite {currentPage} von {totalPages}
              </span>
            )}
          </div>

          {/* Application Cards Grid */}
          {paginatedApplications.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginatedApplications.map((application, index) => {
                const statusInfo = getGenerationStatusInfo(application.status);
                const StatusIcon = statusInfo.icon;
                const jobTitle = application.title || application.jobPosting?.title || `Bewerbung #${application.id.substring(0, APPLICATION_ID_DISPLAY_LENGTH)}`;
                const company = application.jobPosting?.company;
                const location = application.jobPosting?.location;
                const timeAgo = formatDistanceToNow(new Date(application.createdAt), { addSuffix: true, locale: de });

                return (
                  <Card
                    key={application.id}
                    className="group hover:shadow-soft hover:-translate-y-1 transition-all duration-300 border-border/50 overflow-hidden flex flex-col"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5">
                          <CardTitle className="text-lg font-semibold leading-tight line-clamp-1" title={jobTitle}>
                            {jobTitle}
                          </CardTitle>
                          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                            {company && (
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 shrink-0" />
                                <span className="font-medium text-foreground/80 truncate">{company}</span>
                              </div>
                            )}
                            {location && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/applications/${application.id}`)}>
                              Details anzeigen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/applications/${application.id}/edit`)}>
                              Bearbeiten
                            </DropdownMenuItem>
                            {application.status === 'READY' && application.coverLetterUrl && (
                              <DropdownMenuItem onClick={() => window.open(application.coverLetterUrl, '_blank')}>
                                Anschreiben öffnen
                              </DropdownMenuItem>
                            )}
                            {application.status === 'READY' && application.resumeUrl && (
                              <DropdownMenuItem onClick={() => window.open(application.resumeUrl, '_blank')}>
                                Lebenslauf öffnen
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteClick(application.id, jobTitle)}
                            >
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>

                    <CardContent className="pb-3 flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <Badge variant={statusInfo.variant} className="font-normal text-xs py-0.5 h-6">
                          <StatusIcon className={`mr-1.5 h-3 w-3 ${application.status === 'GENERATING' ? 'animate-spin' : ''}`} />
                          {statusInfo.label}
                        </Badge>
                        <div className="text-xs text-muted-foreground flex items-center gap-1" title={new Date(application.createdAt).toLocaleString()}>
                          <Calendar className="h-3 w-3" />
                          {timeAgo}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-border/50">
                        <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Status</div>
                        <StatusDropdown
                          applicationId={application.id}
                          currentStatus={application.applicationStatus}
                          variant="dropdown"
                        />
                      </div>
                    </CardContent>

                    <CardFooter className="pt-0 pb-4 px-6 flex gap-2">
                      <Button
                        className="w-full shadow-sm group-hover:shadow transition-all"
                        size="sm"
                        onClick={() => router.push(`/applications/${application.id}`)}
                      >
                        Details
                        <ChevronRight className="h-3.5 w-3.5 ml-1.5 opacity-70" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border bg-muted/10 animate-in fade-in zoom-in-95 duration-500">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Keine Bewerbungen gefunden
              </h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                Es gibt keine Bewerbungen mit dem Status &quot;
                {TRACKING_STATUS_TABS.find((t) => t.value === selectedTab)?.label}&quot;.
              </p>
              {selectedTab !== 'all' ? (
                <Button variant="outline" onClick={() => setSelectedTab('all')}>
                  Alle anzeigen
                </Button>
              ) : (
                <Button onClick={() => router.push('/applications/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Erste Bewerbung erstellen
                </Button>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Zurück</span>
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={page === currentPage ? 'default' : 'ghost'}
                    size="sm"
                    className={`h-8 w-8 p-0 ${page === currentPage ? 'pointer-events-none' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Weiter</span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-border bg-muted/10 animate-in fade-in zoom-in-95 duration-500">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
            <div className="relative h-20 w-20 rounded-full bg-background shadow-soft flex items-center justify-center border border-border/50">
              <FileText className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Noch keine Bewerbungen</h3>
          <p className="text-muted-foreground mb-8 max-w-md">
            Erstelle deine erste Bewerbung mit KI-Unterstützung und behalte den Überblick über deinen Bewerbungsprozess.
          </p>
          <Button size="lg" onClick={() => router.push('/applications/new')} className="shadow-lg hover:shadow-xl transition-all">
            <Plus className="mr-2 h-5 w-5" />
            Erste Bewerbung erstellen
          </Button>
        </div>
      )
      }

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bewerbung löschen?</DialogTitle>
            <DialogDescription>
              Möchtest du die Bewerbung für <span className="font-medium text-foreground">&quot;{applicationToDelete?.title}&quot;</span> wirklich löschen?
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
    </div >
  );
}
