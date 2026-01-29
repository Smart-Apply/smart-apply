'use client';

import { useState } from 'react';
import Image from 'next/image';
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

type Step = 'intro' | 'scan' | 'verify' | 'backup';

export function TwoFactorSetupDialog({ open, onOpenChange }: TwoFactorSetupDialogProps) {
  const [step, setStep] = useState<Step>('intro');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  const setupMutation = useSetup2FA();
  const verifyMutation = useVerify2FASetup();

  const handleStartSetup = async () => {
    const result = await setupMutation.mutateAsync();
    if (result) {
      setStep('scan');
    }
  };

  const handleVerify = async () => {
    if (!setupMutation.data?.tempSecret) return;

    const result = await verifyMutation.mutateAsync({
      code,
      tempSecret: setupMutation.data.tempSecret,
    });

    if (result) {
      setBackupCodes(result.backupCodes);
      setStep('backup');
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
    const codesText = `Smart Apply - Backup-Codes für 2FA\n${'='.repeat(40)}\n\nDiese Codes können jeweils einmal verwendet werden.\nBewahre sie an einem sicheren Ort auf.\n\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\nGeneriert am: ${new Date().toLocaleString('de-DE')}`;
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

  const handleClose = (open: boolean) => {
    if (!open) {
      // Reset state when closing
      setStep('intro');
      setCode('');
      setBackupCodes([]);
      setupMutation.reset();
      verifyMutation.reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'intro' && '2FA aktivieren'}
            {step === 'scan' && 'Authenticator einrichten'}
            {step === 'verify' && 'Code verifizieren'}
            {step === 'backup' && 'Backup-Codes sichern'}
          </DialogTitle>
          <DialogDescription>
            {step === 'intro' && 'Erhöhe die Sicherheit deines Kontos mit Zwei-Faktor-Authentifizierung.'}
            {step === 'scan' && 'Scanne den QR-Code mit deiner Authenticator-App.'}
            {step === 'verify' && 'Gib den 6-stelligen Code aus deiner Authenticator-App ein.'}
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
                    width={200}
                    height={200}
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

              <Button onClick={() => setStep('verify')} className="w-full">
                Code eingeben
              </Button>
            </>
          )}

          {step === 'verify' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">6-stelliger Code</Label>
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

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('scan')}
                  className="flex-1"
                >
                  Zurück
                </Button>
                <Button
                  onClick={handleVerify}
                  disabled={code.length !== 6 || verifyMutation.isPending}
                  className="flex-1"
                >
                  {verifyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Prüfen...
                    </>
                  ) : (
                    'Verifizieren'
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'backup' && (
            <>
              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {backupCodes.map((code, index) => (
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
