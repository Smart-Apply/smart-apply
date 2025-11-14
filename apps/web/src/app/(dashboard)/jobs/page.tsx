'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { JobPostingParser } from '@/components/forms/job-posting-parser';
import { useJobPostings, useDeleteJobPosting } from '@/hooks/use-job-postings';
import { Plus, Briefcase, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { JobPosting } from '@/types';

export default function JobsPage() {
  const [showParser, setShowParser] = useState(false);
  const { data: jobPostings, isLoading } = useJobPostings();
  const deleteJobPosting = useDeleteJobPosting();

  const handleSave = async (jobPosting: JobPosting) => {
    // In a real implementation, this would save to the backend
    // For now, we just close the parser and refetch the list
    setShowParser(false);
    
    // The parsed data is already saved by the backend during parsing
    // We just need to refresh the list
    window.location.reload();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Möchtest du diese Stellenanzeige wirklich löschen?')) {
      await deleteJobPosting.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stellenanzeigen</h1>
          <p className="mt-1 text-gray-500">
            Verwalte deine gespeicherten Stellenanzeigen
          </p>
        </div>
        <Button onClick={() => setShowParser(!showParser)}>
          <Plus className="mr-2 h-4 w-4" />
          {showParser ? 'Parser schließen' : 'Neue Stelle hinzufügen'}
        </Button>
      </div>

      {/* Parser Component */}
      {showParser && (
        <div className="animate-in fade-in slide-in-from-top-5 duration-300">
          <JobPostingParser onSave={handleSave} />
        </div>
      )}

      {/* Job Postings List */}
      <div>
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Lade Stellenanzeigen...</p>
              </div>
            </CardContent>
          </Card>
        ) : jobPostings && jobPostings.length > 0 ? (
          <div className="space-y-4">
            {jobPostings.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{job.title}</CardTitle>
                      <CardDescription className="mt-1">
                        <span className="font-medium text-gray-700">{job.company}</span>
                        {job.location && (
                          <>
                            <span className="mx-2 text-gray-400">•</span>
                            <span>{job.location}</span>
                          </>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {job.description && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Beschreibung</p>
                      <p className="text-sm text-gray-700 line-clamp-3">
                        {job.description}
                      </p>
                    </div>
                  )}

                  {job.requirements && job.requirements.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Anforderungen</p>
                      <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                        {job.requirements.slice(0, 3).map((req, idx) => (
                          <li key={idx} className="line-clamp-1">{req}</li>
                        ))}
                        {job.requirements.length > 3 && (
                          <li className="text-gray-500">+{job.requirements.length - 3} weitere</li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-4 border-t">
                    {job.sourceUrl && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <a
                          href={job.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Original ansehen
                        </a>
                      </Button>
                    )}
                    <Button
                      asChild
                      variant="default"
                      size="sm"
                      className="flex-1"
                    >
                      <Link href={`/applications/new?jobId=${job.id}`}>
                        <Briefcase className="mr-2 h-4 w-4" />
                        Bewerbung erstellen
                      </Link>
                    </Button>
                    <Button
                      onClick={() => handleDelete(job.id)}
                      variant="ghost"
                      size="sm"
                      disabled={deleteJobPosting.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>

                  <div className="text-xs text-gray-400">
                    Hinzugefügt am {new Date(job.createdAt).toLocaleDateString('de-DE')}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Keine Stellenanzeigen
              </h3>
              <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
                Du hast noch keine Stellenanzeigen gespeichert. Füge deine erste 
                Stelle hinzu, um loszulegen.
              </p>
              <Button onClick={() => setShowParser(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Erste Stelle hinzufügen
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Info Card */}
      {!showParser && (!jobPostings || jobPostings.length === 0) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-900">
                So funktioniert's:
              </p>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>Füge eine Stellenanzeigen-URL ein (z.B. von LinkedIn oder Indeed)</li>
                <li>Oder kopiere die Stellenbeschreibung manuell</li>
                <li>Unser Parser extrahiert automatisch die wichtigsten Informationen</li>
                <li>Überprüfe und bearbeite die Daten falls nötig</li>
                <li>Erstelle dann deine maßgeschneiderte Bewerbung</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
