'use client';

import { useState } from 'react';
import { Loader2, Copy, Check, Download, RefreshCw } from 'lucide-react';
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
import { useRegenerateBackupCodes, useTwoFactorStatus } from '@/hooks/use-two-factor';
import { toastSuccess } from '@/lib/toast';

interface BackupCodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BackupCodesDialog({ open, onOpenChange }: BackupCodesDialogProps) {
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [password, setPassword] = useState('');
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: status } = useTwoFactorStatus();
  const regenerateMutation = useRegenerateBackupCodes();

  const handleRegenerate = async () => {
    const result = await regenerateMutation.mutateAsync({ password });
    if (result) {
      setNewCodes(result.backupCodes);
      setShowRegenerate(false);
      setPassword('');
    }
  };

  const handleCopyBackupCodes = () => {
    if (newCodes) {
      const codesText = newCodes.join('\n');
      navigator.clipboard.writeText(codesText);
      setCopied(true);
      toastSuccess('Backup-Codes kopiert');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadBackupCodes = () => {
    if (newCodes) {
      const codesText = `Smart Apply - Backup-Codes für 2FA\n${'='.repeat(40)}\n\nDiese Codes können jeweils einmal verwendet werden.\nBewahre sie an einem sicheren Ort auf.\n\n${newCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\nGeneriert am: ${new Date().toLocaleString('de-DE')}`;
      const blob = new Blob([codesText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'smartapply-backup-codes.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toastSuccess('Backup-Codes heruntergeladen');
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setShowRegenerate(false);
      setPassword('');
      setNewCodes(null);
      regenerateMutation.reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Backup-Codes</DialogTitle>
          <DialogDescription>
            {newCodes
              ? 'Deine neuen Backup-Codes wurden generiert. Speichere sie sicher!'
              : `Du hast noch ${status?.backupCodesRemaining || 0} unbenutzte Backup-Codes.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {newCodes ? (
            <>
              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {newCodes.map((code, index) => (
                    <div key={index} className="px-2 py-1 bg-background rounded">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCopyBackupCodes}
                  className="flex-1"
                >
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  Kopieren
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadBackupCodes}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Herunterladen
                </Button>
              </div>

              <p className="text-xs text-destructive font-medium">
                Diese Codes werden nur einmal angezeigt!
              </p>
            </>
          ) : showRegenerate ? (
            <>
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
                <p className="font-medium">Achtung:</p>
                <p className="mt-1">
                  Alle bestehenden Backup-Codes werden ungültig. Speichere die neuen Codes sicher.
                </p>
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
                  onClick={() => setShowRegenerate(false)}
                  className="flex-1"
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={handleRegenerate}
                  disabled={!password || regenerateMutation.isPending}
                  className="flex-1"
                >
                  {regenerateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generieren...
                    </>
                  ) : (
                    'Neue Codes generieren'
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                <p>
                  Backup-Codes können verwendet werden, wenn du keinen Zugriff auf deine
                  Authenticator-App hast. Jeder Code kann nur einmal verwendet werden.
                </p>
              </div>

              {status && status.backupCodesRemaining < 3 && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
                  Du hast nur noch wenige Backup-Codes. Generiere neue Codes für den Notfall.
                </div>
              )}

              <Button
                onClick={() => setShowRegenerate(true)}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Neue Backup-Codes generieren
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
