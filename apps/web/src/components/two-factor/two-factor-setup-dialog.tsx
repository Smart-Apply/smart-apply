'use client';

import { useState } from 'react';
import { Loader2, Copy, Check, Download } from 'lucide-react';
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
import { useSetup2FA, useVerify2FASetup } from '@/hooks/use-two-factor';
import { toast } from 'sonner';

interface TwoFactorSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'intro' | 'scan' | 'backup';

export function TwoFactorSetupDialog({ open, onOpenChange }: TwoFactorSetupDialogProps) {
  const [step, setStep] = useState<Step>('intro');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  const setupMutation = useSetup2FA();
  const verifyMutation = useVerify2FASetup();

  const handleStartSetup = async () => {
    try {
      const result = await setupMutation.mutateAsync();
      if (result) {
        setStep('scan');
      }
    } catch {
      // Error is handled by the mutation's onError callback
    }
  };

  const handleVerify = async () => {
    if (!setupMutation.data?.tempSecret) return;

    try {
      const result = await verifyMutation.mutateAsync({
        code,
        tempSecret: setupMutation.data.tempSecret,
      });

      if (result?.backupCodes) {
        setBackupCodes(result.backupCodes);
        setStep('backup');
      }
    } catch {
      // Error is handled by the mutation's onError callback
    }
  };

  const handleCopySecret = () => {
    if (setupMutation.data?.tempSecret) {
      navigator.clipboard.writeText(setupMutation.data.tempSecret);
      setCopiedSecret(true);
      toast.success('Secret kopiert');
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const handleCopyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    setCopiedBackup(true);
    toast.success('Backup-Codes kopiert');
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const handleDownloadBackupCodes = () => {
    const codesText = `Smart Apply - Backup-Codes für 2FA\n${'='.repeat(40)}\n\nDiese Codes können jeweils einmal verwendet werden.\nBewahre sie an einem sicheren Ort auf.\n\n${backupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nGeneriert am: ${new Date().toLocaleString('de-DE')}`;
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartapply-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Backup-Codes heruntergeladen');
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when closing
      setStep('intro');
      setCode('');
      setBackupCodes([]);
      setupMutation.reset();
      verifyMutation.reset();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'intro' && '2FA aktivieren'}
            {step === 'scan' && 'Authenticator einrichten'}
            {step === 'backup' && 'Backup-Codes sichern'}
          </DialogTitle>
          <DialogDescription>
            {step === 'intro' && 'Erhöhe die Sicherheit deines Kontos mit Zwei-Faktor-Authentifizierung.'}
            {step === 'scan' && 'Scanne den QR-Code und gib dann den 6-stelligen Code ein.'}
            {step === 'backup' && 'Speichere diese Codes an einem sicheren Ort. Du benötigst sie, falls du keinen Zugriff auf deine Authenticator-App hast.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 'intro' && (
            <>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Du benötigst eine Authenticator-App wie:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Google Authenticator</li>
                  <li>Authy</li>
                  <li>Microsoft Authenticator</li>
                  <li>1Password</li>
                </ul>
              </div>
              <Button
                onClick={handleStartSetup}
                disabled={setupMutation.isPending}
                className="w-full"
              >
                {setupMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird vorbereitet...
                  </>
                ) : (
                  'Weiter'
                )}
              </Button>
            </>
          )}

          {step === 'scan' && setupMutation.data && (
            <>
              <div className="flex justify-center">
                <div className="border rounded-lg p-2 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={setupMutation.data.qrCodeDataUrl}
                    alt="QR Code für 2FA"
                    width={180}
                    height={180}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Oder manuell eingeben:
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={setupMutation.data.tempSecret}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopySecret}
                  >
                    {copiedSecret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="code">6-stelliger Code aus der App</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="font-mono text-center text-2xl tracking-widest"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>

              <Button
                onClick={handleVerify}
                disabled={code.length !== 6 || verifyMutation.isPending}
                className="w-full"
              >
                {verifyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird aktiviert...
                  </>
                ) : (
                  'Aktivieren'
                )}
              </Button>
            </>
          )}

          {step === 'backup' && (
            <>
              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {backupCodes.map((backupCode, index) => (
                    <div key={index} className="px-2 py-1 bg-background rounded">
                      {backupCode}
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
                  {copiedBackup ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
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

              <Button onClick={() => handleClose(false)} className="w-full">
                Fertig
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
