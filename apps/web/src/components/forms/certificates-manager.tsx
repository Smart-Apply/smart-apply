'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Calendar, Award, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { Certificate } from '@/types';

interface CertificatesManagerProps {
  certificates: Certificate[];
  onCertificatesChange: (certificates: Certificate[]) => void;
  disabled?: boolean;
}

// Validation schema for certificate form
const certificateSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  issuingOrganization: z.string().min(1, 'Ausstellende Organisation ist erforderlich'),
  issueDate: z.string().optional(),
  expirationDate: z.string().optional(),
  credentialId: z.string().optional(),
  credentialUrl: z.string().url('Ungültige URL').optional().or(z.literal('')),
}).refine((data) => {
  // If both dates are provided, expiration must be after issue date
  if (data.issueDate && data.expirationDate) {
    return new Date(data.expirationDate) >= new Date(data.issueDate);
  }
  return true;
}, {
  message: 'Ablaufdatum muss nach oder gleich dem Ausstellungsdatum sein',
  path: ['expirationDate'],
});

type CertificateFormValues = z.infer<typeof certificateSchema>;

export function CertificatesManager({
  certificates,
  onCertificatesChange,
  disabled = false,
}: CertificatesManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const form = useForm<CertificateFormValues>({
    resolver: zodResolver(certificateSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      issuingOrganization: '',
      issueDate: '',
      expirationDate: '',
      credentialId: '',
      credentialUrl: '',
    },
  });

  const sortedCertificates = [...certificates].sort((a, b) => {
    if (!a.dateObtained && !b.dateObtained) return 0;
    if (!a.dateObtained) return 1;
    if (!b.dateObtained) return -1;

    const dateA = new Date(a.dateObtained);
    const dateB = new Date(b.dateObtained);
    return dateB.getTime() - dateA.getTime();
  });

  const openAddDialog = () => {
    setEditingIndex(null);
    form.reset({
      name: '',
      issuingOrganization: '',
      issueDate: '',
      expirationDate: '',
      credentialId: '',
      credentialUrl: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    const cert = certificates[index];
    setEditingIndex(index);
    form.reset({
      name: cert.name,
      issuingOrganization: cert.issuer,
      issueDate: cert.dateObtained ? cert.dateObtained.split('T')[0] : '',
      expirationDate: cert.expiryDate ? cert.expiryDate.split('T')[0] : '',
      credentialId: cert.credentialId || '',
      credentialUrl: cert.url || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: CertificateFormValues) => {
    const newCertificate: Certificate = {
      name: data.name,
      issuer: data.issuingOrganization,
      dateObtained: data.issueDate ? new Date(data.issueDate).toISOString() : undefined,
      url: data.credentialUrl?.trim() || undefined,
      expiryDate: data.expirationDate ? new Date(data.expirationDate).toISOString() : null,
      credentialId: data.credentialId?.trim() || undefined,
    };

    let updatedCertificates: Certificate[];

    if (editingIndex !== null) {
      const existingCertificate = certificates[editingIndex];
      updatedCertificates = [...certificates];
      updatedCertificates[editingIndex] = {
        ...newCertificate,
        ...(existingCertificate.id && { id: existingCertificate.id }),
      };
      toast.success('Zertifikat aktualisiert');
    } else {
      updatedCertificates = [...certificates, newCertificate];
      toast.success('Zertifikat hinzugefügt');
    }

    onCertificatesChange(updatedCertificates);
    setIsDialogOpen(false);
    form.reset();
  };

  const handleDelete = (index: number) => {
    const updatedCertificates = certificates.filter((_, i) => i !== index);
    onCertificatesChange(updatedCertificates);
    setDeleteConfirmIndex(null);
    toast.success('Zertifikat entfernt');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      month: 'short',
      year: 'numeric',
    });
  };

  const isExpired = (expiryDate: string | null | undefined) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Zertifikate</h3>
          <p className="text-sm text-muted-foreground">
            Deine beruflichen Zertifizierungen
          </p>
        </div>
        <Button
          type="button"
          onClick={openAddDialog}
          disabled={disabled}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Hinzufügen
        </Button>
      </div>

      {sortedCertificates.length > 0 ? (
        <div className="space-y-4">
          {sortedCertificates.map((cert, displayIndex) => {
            const originalIndex = certificates.findIndex(
              c => c.name === cert.name && c.issuer === cert.issuer && c.dateObtained === cert.dateObtained
            );

            const expired = isExpired(cert.expiryDate);

            return (
              <Card key={displayIndex} className="border-border/50 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Award className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground truncate">{cert.name}</h4>
                          <p className="text-sm text-muted-foreground truncate">{cert.issuer}</p>

                          {cert.dateObtained && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>
                                Ausgestellt: {formatDate(cert.dateObtained)}
                              </span>
                            </div>
                          )}

                          {cert.expiryDate && (
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>
                                Läuft ab: {formatDate(cert.expiryDate)}
                              </span>
                              {expired && (
                                <Badge variant="destructive" className="text-[10px] py-0 px-1.5 h-4">
                                  Abgelaufen
                                </Badge>
                              )}
                            </div>
                          )}

                          {cert.credentialId && (
                            <p className="mt-1 text-xs text-muted-foreground font-mono">
                              ID: {cert.credentialId}
                            </p>
                          )}

                          {cert.url && (
                            <a
                              href={cert.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:text-primary/80 hover:underline"
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
        <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-border bg-muted/20">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Award className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground">Keine Zertifikate</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Füge deine beruflichen Zertifizierungen hinzu, um deine Qualifikationen zu belegen.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={openAddDialog}
            disabled={disabled}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Erstes Zertifikat hinzufügen
          </Button>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? 'Zertifikat bearbeiten' : 'Zertifikat hinzufügen'}
            </DialogTitle>
            <DialogDescription>
              Füge Details zu deiner Zertifizierung hinzu
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zertifikatsname *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. AWS Certified Solutions Architect"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="issuingOrganization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ausstellende Organisation *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. Amazon Web Services"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ausstellungsdatum</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expirationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ablaufdatum</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          placeholder="Leer lassen, wenn kein Ablauf"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="credentialId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credential ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. ABC-123-456"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="credentialUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credential URL</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://example.com/verify/certificate"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit">
                  {editingIndex !== null ? 'Speichern' : 'Hinzufügen'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmIndex !== null} onOpenChange={(open) => !open && setDeleteConfirmIndex(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zertifikat löschen</DialogTitle>
            <DialogDescription>
              Möchtest du dieses Zertifikat wirklich löschen?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmIndex(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmIndex !== null && handleDelete(deleteConfirmIndex)}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
