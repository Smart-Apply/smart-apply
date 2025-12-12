'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CenteredLoader } from '@/components/shared/loading';
import { 
  ArrowLeft, 
  AlertCircle, 
  Building2, 
  MapPin, 
  Calendar,
  FileText,
  CheckCircle2,
  Target,
  Star,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/format-date';

export default function JobPostingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobPostingId = params.id as string;

  const { data: jobPosting, isLoading, error } = useQuery({
    queryKey: ['job-posting', jobPostingId],
    queryFn: () => api.jobPostings.getById(jobPostingId),
    enabled: !!jobPostingId,
  });

  if (isLoading) {
    return <CenteredLoader message="Lädt Stellenanzeige..." />;
  }

  if (error || !jobPosting) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/applications')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Stellenanzeige nicht gefunden
              </h3>
              <p className="text-gray-500 mb-6">
                Die angeforderte Stellenanzeige existiert nicht oder du hast keine Berechtigung.
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>
      </div>

      {/* Job Title & Company */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <CardTitle className="text-3xl">{jobPosting.title}</CardTitle>
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{jobPosting.company}</span>
                </div>
                {jobPosting.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{jobPosting.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatDate(jobPosting.createdAt, 'dd. MMMM yyyy')}
                  </span>
                </div>
              </div>
            </div>
            {jobPosting.sourceUrl && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(jobPosting.sourceUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Quelle
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Description */}
      {jobPosting.description && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Stellenbeschreibung</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {jobPosting.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Requirements */}
      {jobPosting.requirements && jobPosting.requirements.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <CardTitle>Anforderungen</CardTitle>
              <Badge variant="secondary" className="ml-2">
                {jobPosting.requirements.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {jobPosting.requirements.map((req, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{req}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Responsibilities */}
      {jobPosting.responsibilities && jobPosting.responsibilities.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle>Aufgaben & Verantwortlichkeiten</CardTitle>
              <Badge variant="secondary" className="ml-2">
                {jobPosting.responsibilities.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {jobPosting.responsibilities.map((resp, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{resp}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Nice to Have */}
      {jobPosting.niceToHave && jobPosting.niceToHave.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <CardTitle>Wünschenswert</CardTitle>
              <Badge variant="secondary" className="ml-2">
                {jobPosting.niceToHave.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {jobPosting.niceToHave.map((nice, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{nice}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Raw Text (Collapsible) */}
      {jobPosting.rawText && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Original-Text
            </CardTitle>
          </CardHeader>
          <CardContent>
            <details className="group">
              <summary className="cursor-pointer text-sm text-primary hover:underline">
                Vollständigen Text anzeigen
              </summary>
              <Separator className="my-4" />
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                {jobPosting.rawText}
              </p>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
