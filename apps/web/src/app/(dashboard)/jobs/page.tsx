'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JobPostingParser } from '@/components/forms/job-posting-parser';
import { JobPostingForm } from '@/components/forms/job-posting-form';
import { useJobPostings, useDeleteJobPosting } from '@/hooks/use-job-postings';
import {
  Plus,
  Briefcase,
  Trash2,
  ExternalLink,
  Loader2,
  FileText,
  Edit,
  X,
  MapPin,
  Building2,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function JobsPage() {
  const router = useRouter();
  const [showInput, setShowInput] = useState(false);
  const [inputTab, setInputTab] = useState<'parser' | 'manual'>('parser');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<{ id: string; title: string } | null>(null);

  const { data: jobPostings, isLoading } = useJobPostings();
  const deleteJobPosting = useDeleteJobPosting();

  const handleSave = async () => {
    // Close the input section after saving
    setShowInput(false);
    toast.success('Stellenanzeige gespeichert');
  };

  const handleManualSave = () => {
    // Close the input section after manual creation
    setShowInput(false);
    toast.success('Stellenanzeige erstellt');
  };

  const handleDeleteClick = (id: string, title: string) => {
    setJobToDelete({ id, title });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;
    await deleteJobPosting.mutateAsync(jobToDelete.id);
    setDeleteDialogOpen(false);
    setJobToDelete(null);
    toast.success('Stellenanzeige gelöscht');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Stellenanzeigen</h1>
          <p className="mt-1 text-muted-foreground">
            Verwalte deine gespeicherten Stellenanzeigen und erstelle daraus Bewerbungen.
          </p>
        </div>
        <Button
          onClick={() => setShowInput(!showInput)}
          variant={showInput ? "secondary" : "default"}
          className={showInput ? "" : "shadow-md hover:shadow-lg transition-all"}
        >
          {showInput ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Schließen
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Neue Stelle hinzufügen
            </>
          )}
        </Button>
      </div>

      {/* Input Component with Tabs - Collapsible */}
      {showInput && (
        <div className="animate-in fade-in slide-in-from-top-5 duration-300 border border-border/50 rounded-xl bg-card shadow-soft overflow-hidden">
          <div className="p-6 border-b border-border/50 bg-muted/30">
            <h2 className="text-lg font-semibold mb-1">Neue Stellenanzeige erfassen</h2>
            <p className="text-sm text-muted-foreground">
              Füge eine URL hinzu oder kopiere den Text, um die Stelle zu speichern.
            </p>
          </div>
          <div className="p-6">
            <Tabs value={inputTab} onValueChange={(v) => setInputTab(v as 'parser' | 'manual')} className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                <TabsTrigger value="parser">
                  <FileText className="mr-2 h-4 w-4" />
                  Parser (URL/Text)
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <Edit className="mr-2 h-4 w-4" />
                  Manuell
                </TabsTrigger>
              </TabsList>

              <TabsContent value="parser" className="mt-0">
                <JobPostingParser onSave={handleSave} />
              </TabsContent>

              <TabsContent value="manual" className="mt-0">
                <JobPostingForm
                  onSave={handleManualSave}
                  onCancel={() => setShowInput(false)}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      {/* Job Postings List */}
      <div>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-48 animate-pulse bg-muted/50 border-transparent" />
            ))}
          </div>
        ) : jobPostings && jobPostings.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {jobPostings.map((job, index) => (
              <Card
                key={job.id}
                className="group hover:shadow-soft hover:-translate-y-1 transition-all duration-300 border-border/50 overflow-hidden flex flex-col"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold leading-tight truncate" title={job.title}>
                        {job.title}
                      </CardTitle>
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-medium text-foreground/80 truncate">{job.company}</span>
                        </div>
                        {job.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{job.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleDeleteClick(job.id, job.title)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 -mr-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Löschen</span>
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pb-3 flex-1 space-y-4">
                  {job.description && (
                    <div className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                      {job.description}
                    </div>
                  )}

                  {job.requirements && job.requirements.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {job.requirements.slice(0, 3).map((req, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[10px] font-normal bg-muted/50 text-muted-foreground hover:bg-muted">
                          {req.length > 20 ? req.substring(0, 20) + '...' : req}
                        </Badge>
                      ))}
                      {job.requirements.length > 3 && (
                        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                          +{job.requirements.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                    <Calendar className="h-3 w-3" />
                    <span>Hinzugefügt am {new Date(job.createdAt).toLocaleDateString('de-DE')}</span>
                  </div>
                </CardContent>

                <CardFooter className="pt-0 pb-4 px-6 flex gap-2 border-t border-border/50 mt-auto pt-4">
                  {job.sourceUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(job.sourceUrl, '_blank')}
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Original
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-[2] shadow-sm group-hover:shadow transition-all"
                    onClick={() => router.push(`/applications/new?jobId=${job.id}`)}
                  >
                    <Briefcase className="mr-2 h-3.5 w-3.5" />
                    Bewerben
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-border bg-muted/10 animate-in fade-in zoom-in-95 duration-500">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl animate-pulse"></div>
              <div className="relative h-20 w-20 rounded-full bg-background shadow-soft flex items-center justify-center border border-border/50">
                <Briefcase className="h-10 w-10 text-blue-500" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              Keine Stellenanzeigen
            </h3>
            <p className="text-muted-foreground mb-8 text-center max-w-md">
              Du hast noch keine Stellenanzeigen gespeichert. Füge deine erste
              Stelle hinzu, um loszulegen.
            </p>
            <Button size="lg" onClick={() => setShowInput(true)} className="shadow-lg hover:shadow-xl transition-all">
              <Plus className="mr-2 h-5 w-5" />
              Erste Stelle hinzufügen
            </Button>
          </div>
        )}
      </div>

      {/* Info Card */}
      {!showInput && (!jobPostings || jobPostings.length === 0) && (
        <Card className="border-blue-200/50 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-900/50 shadow-sm">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Loader2 className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-300">
                  So funktioniert der Smart Apply Workflow
                </h3>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 mt-4">
                <div className="bg-background/60 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                  <div className="font-medium text-blue-800 dark:text-blue-300 mb-1">1. Stelle speichern</div>
                  <p className="text-sm text-muted-foreground">Füge eine URL von LinkedIn/Indeed hinzu oder kopiere den Text der Ausschreibung.</p>
                </div>
                <div className="bg-background/60 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                  <div className="font-medium text-blue-800 dark:text-blue-300 mb-1">2. Analysieren</div>
                  <p className="text-sm text-muted-foreground">Unsere KI extrahiert automatisch alle wichtigen Anforderungen und Skills.</p>
                </div>
                <div className="bg-background/60 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                  <div className="font-medium text-blue-800 dark:text-blue-300 mb-1">3. Bewerben</div>
                  <p className="text-sm text-muted-foreground">Erstelle mit einem Klick eine maßgeschneiderte Bewerbung für diese Stelle.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stellenanzeige löschen?</DialogTitle>
            <DialogDescription>
              Möchtest du die Stellenanzeige <span className="font-medium text-foreground">"{jobToDelete?.title}"</span> wirklich löschen?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteJobPosting.isPending}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteJobPosting.isPending}
            >
              {deleteJobPosting.isPending ? 'Wird gelöscht...' : 'Löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
