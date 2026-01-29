'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDisable2FA } from '@/hooks/use-two-factor';

interface TwoFactorDisableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TwoFactorDisableDialog({ open, onOpenChange }: TwoFactorDisableDialogProps) {
  const [password, setPassword] = useState('');
  const disableMutation = useDisable2FA();

  const handleDisable = async () => {
    await disableMutation.mutateAsync({ password });
    handleClose(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setPassword('');
      disableMutation.reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            2FA deaktivieren
          </DialogTitle>
          <DialogDescription>
            Bist du sicher? Dein Konto wird danach weniger sicher sein.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-medium">Warnung:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Alle vertrauenswürdigen Geräte werden entfernt</li>
              <li>Backup-Codes werden gelöscht</li>
              <li>Dein Konto ist nur noch durch das Passwort geschützt</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Passwort zur Bestätigung</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={!password || disableMutation.isPending}
              className="flex-1"
            >
              {disableMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deaktivieren...
                </>
              ) : (
                '2FA deaktivieren'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
