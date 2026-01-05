'use client';

import { Monitor, Smartphone, LogOut, AlertTriangle, Shield } from 'lucide-react';
import { useSessions, useRevokeSession, useRevokeAllSessions } from '@/hooks/use-sessions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDateSmart, formatDateFull } from '@/lib/format-date';
import type { Session } from '@/types';

/**
 * Parse user agent string to extract device and browser info
 */
function parseUserAgent(userAgent: string): { device: string; browser: string; os: string } {
  const ua = userAgent.toLowerCase();
  
  // Detect device
  let device = 'Desktop';
  if (ua.includes('mobile') || ua.includes('android')) {
    device = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = 'Tablet';
  }
  
  // Detect browser
  let browser = 'Unknown Browser';
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
  }
  
  // Detect OS
  let os = 'Unknown OS';
  if (ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('mac')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
  }
  
  return { device, browser, os };
}



/**
 * Session Card Component
 */
function SessionCard({ session, isCurrentSession, onRevoke }: { 
  session: Session; 
  isCurrentSession: boolean; 
  onRevoke: (sessionId: string) => void;
}) {
  const { device, browser, os } = parseUserAgent(session.userAgent);
  const DeviceIcon = device === 'Mobile' ? Smartphone : Monitor;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-start gap-3">
          <DeviceIcon className="h-5 w-5 mt-1 text-muted-foreground" />
          <div>
            <CardTitle className="text-base font-semibold">
              {browser} on {os}
            </CardTitle>
            <CardDescription className="text-sm">
              {device} • {session.ipAddress}
            </CardDescription>
          </div>
        </div>
        {isCurrentSession && (
          <Badge variant="default" className="ml-2">Aktuell</Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-sm text-muted-foreground cursor-help">
                  Zuletzt aktiv: {formatDateSmart(session.lastUsedAt)}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p>{formatDateFull(session.lastUsedAt)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRevoke(session.id)}
            className="text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {isCurrentSession ? 'Abmelden' : 'Beenden'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Sessions Management Page
 */
export default function SessionsPage() {
  const { data, isLoading, error } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAllSessions = useRevokeAllSessions();

  const handleRevoke = (sessionId: string) => {
    revokeSession.mutate(sessionId);
  };

  const handleRevokeAll = () => {
    revokeAllSessions.mutate();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-2">Aktive Sitzungen</h1>
        <p className="text-muted-foreground mb-8">
          Verwalte deine aktiven Sitzungen auf verschiedenen Geräten.
        </p>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-2">Aktive Sitzungen</h1>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Fehler beim Laden der Sitzungen
            </CardTitle>
            <CardDescription>
              {error.message || 'Aktive Sitzungen konnten nicht geladen werden'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const sessions = data?.sessions || [];
  const currentSessionId = data?.currentSessionId || '';
  const otherSessions = sessions.filter((s) => s.id !== currentSessionId);
  const currentSession = sessions.find((s) => s.id === currentSessionId);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold">Aktive Sitzungen</h1>
        {sessions.length > 1 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Von allen Geräten abmelden
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Von allen Geräten abmelden?</AlertDialogTitle>
                <AlertDialogDescription>
                  Du wirst von allen {sessions.length} aktiven Sitzung{sessions.length !== 1 ? 'en' : ''} abgemeldet, einschließlich diesem Gerät.
                  Du musst dich auf allen Geräten neu anmelden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRevokeAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Von allen Geräten abmelden
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      
      <p className="text-muted-foreground mb-8">
        Verwalte deine aktiven Sitzungen auf verschiedenen Geräten. Du kannst den Zugriff von jedem Gerät jederzeit beenden.
      </p>

      <div className="space-y-6">
        {/* Current Session */}
        {currentSession && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Aktuelle Sitzung
            </h2>
            <SessionCard
              session={currentSession}
              isCurrentSession={true}
              onRevoke={handleRevoke}
            />
          </div>
        )}

        {/* Other Sessions */}
        {otherSessions.length > 0 && (
          <>
            <Separator />
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                Andere Sitzungen ({otherSessions.length})
              </h2>
              <div className="space-y-3">
                {otherSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isCurrentSession={false}
                    onRevoke={handleRevoke}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Empty State - Only one session */}
        {sessions.length === 1 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/10">
            <EmptyState
              icon={Shield}
              title="Nur eine aktive Sitzung"
              description="Dies ist deine einzige aktive Sitzung. Melde dich von einem anderen Gerät an, um weitere Sitzungen hier zu sehen."
            />
          </div>
        )}
      </div>
    </div>
  );
}
