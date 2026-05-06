'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  Plug,
  Trash2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useFeatureGate } from '@/hooks/use-tier-gate';
import { api } from '@/lib/api-client';
import { ApiError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { UpgradePrompt } from '@/components/subscription/upgrade-prompt';
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
import type { MailboxConnection, UserPreferences } from '@/types';

interface EmailTrackingSectionProps {
  preferences: UserPreferences | null;
  onTogglePreference: (key: 'emailTrackingNotify', value: boolean) => Promise<void> | void;
  /** True while preferences are still loading. */
  isLoadingPreferences: boolean;
}

/**
 * Settings section that lets a Premium user connect their Outlook / Microsoft 365
 * mailbox so smart-apply can detect company replies (interview invites,
 * confirmations, rejections) and update the matching application status
 * automatically.
 *
 * Renders inside the "Benachrichtigungen" tab — keeps everything email-
 * related in one place rather than introducing a new top-level navigation
 * item, matching the requirement that this should NOT be a separate tab.
 */
export function EmailTrackingSection({
  preferences,
  onTogglePreference,
  isLoadingPreferences,
}: EmailTrackingSectionProps) {
  const { hasAccess, isLoading: gateLoading } = useFeatureGate('emailParsing');
  const queryClient = useQueryClient();
  const [postConnectMessage, setPostConnectMessage] = useState<string | null>(null);

  const connectionsQuery = useQuery({
    queryKey: ['mailbox-sync', 'connections'],
    queryFn: () => api.mailboxSync.listConnections(),
    enabled: hasAccess,
    refetchOnWindowFocus: false,
  });

  // Surface the OAuth round-trip outcome as a toast on first mount.
  // `?email_tracking=connected` / `?email_tracking=error&reason=...`.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('email_tracking');
    if (!status) return;

    if (status === 'connected') {
      toast.success('Postfach verbunden — Smart Apply erkennt jetzt eingehende E-Mails.');
      setPostConnectMessage('connected');
    } else if (status === 'error') {
      const reason = params.get('reason') || 'unknown';
      toast.error(`Verbindung fehlgeschlagen (${reason}). Bitte erneut versuchen.`);
      setPostConnectMessage('error');
    }

    // Strip the query params from the URL without reloading.
    const url = new URL(window.location.href);
    url.searchParams.delete('email_tracking');
    url.searchParams.delete('reason');
    window.history.replaceState({}, '', url.toString());
  }, []);

  const connectMutation = useMutation({
    mutationFn: () => api.mailboxSync.initiateMicrosoft(),
    onSuccess: ({ authorizationUrl }) => {
      window.location.href = authorizationUrl; // full-page redirect to Microsoft
    },
    onError: (error: Error) => {
      const msg =
        error instanceof ApiError ? error.message : 'Konnte Verbindung nicht starten.';
      toast.error(msg);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.mailboxSync.disconnect(id),
    onSuccess: () => {
      toast.success('Postfach getrennt');
      queryClient.invalidateQueries({ queryKey: ['mailbox-sync', 'connections'] });
    },
    onError: (error: Error) => {
      const msg = error instanceof ApiError ? error.message : 'Trennung fehlgeschlagen.';
      toast.error(msg);
    },
  });

  const microsoftConnection = useMemo(
    () => connectionsQuery.data?.find((c) => c.provider === 'MICROSOFT'),
    [connectionsQuery.data],
  );

  // Premium gate first — non-Premium users see the upgrade prompt.
  if (gateLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bewerbungs-Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!hasAccess) {
    return (
      <UpgradePrompt
        feature="Automatisches Bewerbungs-Tracking"
        requiredTier="PREMIUM"
        description="Verbinde dein Postfach und Smart Apply erkennt Antworten von Unternehmen automatisch — Einladungen zum Gespräch, Bestätigungen und Absagen. Der Status deiner Bewerbung wird live aktualisiert."
        variant="default"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Automatisches Bewerbungs-Tracking</CardTitle>
          <Badge variant="secondary" className="ml-2">
            Premium
          </Badge>
        </div>
        <CardDescription>
          Verbinde dein Postfach. Smart Apply erkennt Antworten von Unternehmen
          automatisch (Bestätigungen, Einladungen, Absagen) und aktualisiert
          den Status deiner Bewerbungen.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {connectionsQuery.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verbindungen werden geladen…
          </div>
        )}

        {/* Microsoft connection slot */}
        <ConnectionRow
          providerLabel="Microsoft 365 / Outlook"
          connection={microsoftConnection}
          onConnect={() => connectMutation.mutate()}
          onDisconnect={(id) => disconnectMutation.mutate(id)}
          isConnecting={connectMutation.isPending}
          isDisconnecting={disconnectMutation.isPending}
        />

        {/* Gmail placeholder — shipped once Google App Verification clears. */}
        <ConnectionRow
          providerLabel="Gmail / Google Workspace"
          connection={undefined}
          onConnect={() => {}}
          onDisconnect={() => {}}
          isConnecting={false}
          isDisconnecting={false}
          comingSoon
        />

        <Separator />

        {/* Notification preference — independent of the "applicationUpdates"
            switch above, so the user can keep generic app updates ON but
            silence the per-tracking-event mails (or vice-versa). */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium leading-none">
              E-Mail bei automatischer Status-Änderung
            </p>
            <p className="text-sm text-muted-foreground">
              Smart Apply schickt dir nur eine Mail, wenn das Tracking den Status
              geändert hat — nicht, wenn du ihn selbst änderst.
            </p>
          </div>
          <Button
            variant={preferences?.emailTrackingNotify ? 'default' : 'outline'}
            size="sm"
            disabled={isLoadingPreferences}
            onClick={() =>
              onTogglePreference('emailTrackingNotify', !preferences?.emailTrackingNotify)
            }
          >
            {preferences?.emailTrackingNotify ? 'Aktiviert' : 'Deaktiviert'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Smart Apply liest E-Mails ausschließlich zur Klassifikation. Wir
          speichern <strong>keine E-Mail-Texte</strong> — nur Absender, Betreff
          und das Klassifikations-Ergebnis (siehe Datenschutz).
        </p>
      </CardContent>
    </Card>
  );
}

interface ConnectionRowProps {
  providerLabel: string;
  connection: MailboxConnection | undefined;
  onConnect: () => void;
  onDisconnect: (id: string) => void;
  isConnecting: boolean;
  isDisconnecting: boolean;
  comingSoon?: boolean;
}

function ConnectionRow({
  providerLabel,
  connection,
  onConnect,
  onDisconnect,
  isConnecting,
  isDisconnecting,
  comingSoon,
}: ConnectionRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium leading-none">{providerLabel}</p>
          {comingSoon && (
            <Badge variant="outline" className="text-xs">
              Bald verfügbar
            </Badge>
          )}
          {connection?.status === 'ACTIVE' && (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Aktiv
            </Badge>
          )}
          {connection?.status === 'ERROR' && (
            <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Fehler
            </Badge>
          )}
        </div>

        {connection ? (
          <>
            <p className="text-sm text-muted-foreground truncate">
              {connection.emailAddress}
            </p>
            {connection.status === 'ERROR' && connection.lastErrorMessage && (
              <p className="text-xs text-red-600 truncate">
                {connection.lastErrorMessage}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {comingSoon
              ? 'Wir warten gerade auf die Google-Verifizierung.'
              : 'Noch kein Postfach verbunden.'}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {connection ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isDisconnecting}>
                {isDisconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Trennen
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Postfach trennen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Smart Apply wird keine neuen E-Mails von{' '}
                  <strong>{connection.emailAddress}</strong> mehr erkennen.
                  Bestehende Bewerbungen bleiben erhalten, aber der Status
                  aktualisiert sich nicht mehr automatisch.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDisconnect(connection.id)}>
                  Trennen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            size="sm"
            onClick={onConnect}
            disabled={comingSoon || isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plug className="h-4 w-4 mr-1" />
                Verbinden
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
