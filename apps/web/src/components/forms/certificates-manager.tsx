'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Calendar, Award, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Certificate } from '@/types';

interface CertificatesManagerProps {
  certificates: Certificate[];
  onCertificatesChange: (certificates: Certificate[]) => void;
  disabled?: boolean;
}

export function CertificatesManager({
  certificates,
  onCertificatesChange,
  disabled = false,
}: CertificatesManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  /* form state */
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [credentialUrl, setCredentialUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName('');
    setIssuer('');
    setIssueDate('');
    setExpiryDate('');
    setCredentialId('');
    setCredentialUrl('');
    setUrlError('');
  };

  const sortedCertificates = [...certificates].sort((a, b) => {
    if (!a.dateObtained && !b.dateObtained) return 0;
    if (!a.dateObtained) return 1;
    if (!b.dateObtained) return -1;
    return new Date(b.dateObtained).getTime() - new Date(a.dateObtained).getTime();
  });

  const openAddDialog = () => {
    setEditingIndex(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    const cert = certificates[index];
    setEditingIndex(index);
    setName(cert.name);
    setIssuer(cert.issuer);
    setIssueDate(cert.dateObtained ? cert.dateObtained.split('T')[0] : '');
    setExpiryDate(cert.expiryDate ? cert.expiryDate.split('T')[0] : '');
    setCredentialId(cert.credentialId || '');
    setCredentialUrl(cert.url || '');
    setUrlError('');
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (isDialogOpen) {
      const t = setTimeout(() => nameRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [isDialogOpen]);

  const canSubmit = name.trim() && issuer.trim();

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Bitte gib einen Zertifikatsnamen ein');
      nameRef.current?.focus();
      return;
    }
    if (!issuer.trim()) {
      toast.error('Bitte gib die ausstellende Organisation ein');
      return;
    }
    if (credentialUrl.trim()) {
      try {
        new URL(
          credentialUrl.trim().startsWith('http')
            ? credentialUrl.trim()
            : `https://${credentialUrl.trim()}`,
        );
      } catch {
        setUrlError('Bitte gib eine gültige URL ein');
        return;
      }
    }
    if (issueDate && expiryDate && new Date(expiryDate) < new Date(issueDate)) {
      toast.error('Ablaufdatum muss nach dem Ausstellungsdatum liegen');
      return;
    }

    let finalUrl = credentialUrl.trim() || undefined;
    if (finalUrl && !finalUrl.startsWith('http')) {
      finalUrl = `https://${finalUrl}`;
    }

    const newCert: Certificate = {
      name: name.trim(),
      issuer: issuer.trim(),
      dateObtained: issueDate ? new Date(issueDate).toISOString() : undefined,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
      credentialId: credentialId.trim() || undefined,
      url: finalUrl,
    };

    let updated: Certificate[];
    if (editingIndex !== null) {
      const existing = certificates[editingIndex];
      updated = [...certificates];
      updated[editingIndex] = { ...newCert, ...(existing.id && { id: existing.id }) };
      toast.success('Zertifikat aktualisiert');
    } else {
      updated = [...certificates, newCert];
      toast.success('Zertifikat hinzugefügt');
    }

    onCertificatesChange(updated);
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = (index: number) => {
    onCertificatesChange(certificates.filter((_, i) => i !== index));
    setDeleteConfirmIndex(null);
    toast.success('Zertifikat entfernt');
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });

  const isExpired = (d: string | null | undefined) =>
    d ? new Date(d) < new Date() : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Zertifikate</h3>
          <p className="text-sm text-muted-foreground">
            Deine beruflichen Zertifizierungen
          </p>
        </div>
        <Button type="button" onClick={openAddDialog} disabled={disabled} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Hinzufügen
        </Button>
      </div>

      {sortedCertificates.length > 0 ? (
        <div className="space-y-4">
          {sortedCertificates.map((cert, displayIndex) => {
            const originalIndex = certificates.findIndex(
              (c) =>
                c.name === cert.name &&
                c.issuer === cert.issuer &&
                c.dateObtained === cert.dateObtained,
            );
            const expired = isExpired(cert.expiryDate);

            return (
              <Card
                key={displayIndex}
                className="border-border/50 shadow-sm transition-all hover:shadow-md"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Award className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate font-semibold text-foreground">
                            {cert.name}
                          </h4>
                          <p className="truncate text-sm text-muted-foreground">
                            {cert.issuer}
                          </p>

                          {cert.dateObtained && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>Ausgestellt: {fmtDate(cert.dateObtained)}</span>
                            </div>
                          )}

                          {cert.expiryDate && (
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Läuft ab: {fmtDate(cert.expiryDate)}</span>
                              {expired && (
                                <Badge
                                  variant="destructive"
                                  className="h-4 px-1.5 py-0 text-[10px]"
                                >
                                  Abgelaufen
                                </Badge>
                              )}
                            </div>
                          )}

                          {cert.credentialId && (
                            <p className="mt-1 font-mono text-xs text-muted-foreground">
                              ID: {cert.credentialId}
                            </p>
                          )}

                          {cert.url && (
                            <a
                              href={cert.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Zertifikat anzeigen
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(originalIndex)}
                        disabled={disabled}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmIndex(originalIndex)}
                        disabled={disabled}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Award className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground">Keine Zertifikate</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Füge deine beruflichen Zertifizierungen hinzu, um deine Qualifikationen zu
            belegen.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={openAddDialog}
            disabled={disabled}
            className="mt-4"
          >
            <Plus className="mr-2 h-4 w-4" />
            Erstes Zertifikat hinzufügen
          </Button>
        </div>
      )}

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              {editingIndex !== null ? 'Zertifikat bearbeiten' : 'Neues Zertifikat'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 px-6 pb-6 pt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Zertifikatsname <span className="text-destructive">*</span>
              </label>
              <Input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. AWS Solutions Architect"
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
            </div>

            {/* Issuer */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Ausstellende Organisation <span className="text-destructive">*</span>
              </label>
              <Input
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="z.B. Amazon Web Services"
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Ausgestellt am{' '}
                  <span className="font-normal text-muted-foreground">– optional</span>
                </label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Läuft ab am{' '}
                  <span className="font-normal text-muted-foreground">– optional</span>
                </label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leer = kein Ablaufdatum
                </p>
              </div>
            </div>

            {/* Credential ID */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Credential-ID{' '}
                <span className="font-normal text-muted-foreground">– optional</span>
              </label>
              <Input
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
                placeholder="z.B. ABC-123-456"
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Link{' '}
                <span className="font-normal text-muted-foreground">– optional</span>
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={credentialUrl}
                  onChange={(e) => {
                    setCredentialUrl(e.target.value);
                    setUrlError('');
                  }}
                  placeholder="example.com/verify/certificate"
                  className="pl-9"
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                />
              </div>
              {urlError && <p className="text-xs text-destructive">{urlError}</p>}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
                {editingIndex !== null ? 'Speichern' : 'Hinzufügen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm dialog ── */}
      <Dialog
        open={deleteConfirmIndex !== null}
        onOpenChange={(open) => !open && setDeleteConfirmIndex(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zertifikat löschen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Möchtest du dieses Zertifikat wirklich löschen? Das kann nicht rückgängig gemacht
            werden.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmIndex(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirmIndex !== null && handleDelete(deleteConfirmIndex)
              }
            >
              Löschen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
