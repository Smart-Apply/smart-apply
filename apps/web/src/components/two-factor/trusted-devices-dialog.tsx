'use client';

import { Loader2, Monitor, Smartphone, Tablet, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  useTrustedDevices,
  useRevokeTrustedDevice,
  useRevokeAllTrustedDevices,
} from '@/hooks/use-two-factor';
import type { TrustedDevice } from '@/types';
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

interface TrustedDevicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getDeviceIcon(os: string | null) {
  const osLower = os?.toLowerCase() || '';
  if (osLower.includes('ios') || osLower.includes('android')) {
    return Smartphone;
  }
  if (osLower.includes('ipad')) {
    return Tablet;
  }
  return Monitor;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt) < new Date();
}

function DeviceItem({
  device,
  onRevoke,
  isRevoking,
}: {
  device: TrustedDevice;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}) {
  const Icon = getDeviceIcon(device.os);
  const expired = isExpired(device.expiresAt);

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-lg bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {device.deviceName || 'Unbekanntes Gerät'}
            </span>
            {expired && (
              <Badge variant="secondary" className="text-xs">
                Abgelaufen
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {device.browser && device.os && (
              <p>{device.browser} auf {device.os}</p>
            )}
            {device.ipAddress && (
              <p>IP: {device.ipAddress}</p>
            )}
            <p>Zuletzt aktiv: {formatDate(device.lastUsedAt)}</p>
            <p>Läuft ab: {formatDate(device.expiresAt)}</p>
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRevoke(device.id)}
        disabled={isRevoking}
        className="text-destructive hover:text-destructive"
      >
        {isRevoking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

export function TrustedDevicesDialog({ open, onOpenChange }: TrustedDevicesDialogProps) {
  const { data: devices, isLoading } = useTrustedDevices();
  const revokeMutation = useRevokeTrustedDevice();
  const revokeAllMutation = useRevokeAllTrustedDevices();

  const handleRevoke = (deviceId: string) => {
    revokeMutation.mutate(deviceId);
  };

  const handleRevokeAll = () => {
    revokeAllMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vertrauenswürdige Geräte</DialogTitle>
          <DialogDescription>
            Auf diesen Geräten wird kein 2FA-Code verlangt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !devices || devices.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Keine vertrauenswürdigen Geräte vorhanden.
            </div>
          ) : (
            <>
              <div className="max-h-[300px] overflow-y-auto divide-y">
                {devices.map((device) => (
                  <DeviceItem
                    key={device.id}
                    device={device}
                    onRevoke={handleRevoke}
                    isRevoking={revokeMutation.isPending && revokeMutation.variables === device.id}
                  />
                ))}
              </div>

              {devices.length > 1 && (
                <>
                  <Separator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full"
                        disabled={revokeAllMutation.isPending}
                      >
                        {revokeAllMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Entfernen...
                          </>
                        ) : (
                          'Alle Geräte entfernen'
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Alle Geräte entfernen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Du musst auf allen Geräten erneut 2FA bestätigen.
                          Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRevokeAll}>
                          Alle entfernen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
