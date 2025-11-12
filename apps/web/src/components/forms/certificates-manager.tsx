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

/**
 * CertificatesManager Component
 * 
 * Manages certificate entries with add, edit, and delete functionality.
 * - Display list of existing certificates (sorted by issue date, most recent first)
 * - Add new certificate via dialog/modal
 * - Edit existing entries
 * - Delete entries with confirmation
 * - Optional expiration date for certificates that don't expire
 * - URL validation for credential URLs
 */
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

  // Sort certificates by issue date (most recent first)
  const sortedCertificates = [...certificates].sort((a, b) => {
    // Certificates without issue date go to the end
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
      // Store these for future backend support
      expiryDate: data.expirationDate ? new Date(data.expirationDate).toISOString() : null,
      credentialId: data.credentialId?.trim() || undefined,
    };

    let updatedCertificates: Certificate[];

    if (editingIndex !== null) {
      // Update existing certificate - PRESERVE THE ID!
      const existingCertificate = certificates[editingIndex];
      updatedCertificates = [...certificates];
      updatedCertificates[editingIndex] = {
        ...newCertificate,
        ...(existingCertificate.id && { id: existingCertificate.id }), // Keep existing ID
      };
      toast.success('Zertifikat aktualisiert');
    } else {
      // Add new certificate (no ID yet - backend will assign one)
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
    <div className="space-y-4">
      <div>
        <Label className="text-base">Zertifikate</Label>
        <p className="text-sm text-gray-500 mb-4">
          Füge deine beruflichen Zertifizierungen und Qualifikationen hinzu
        </p>

        <Button
          type="button"
          onClick={openAddDialog}
          disabled={disabled}
          variant="outline"
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Zertifikat hinzufügen
        </Button>
      </div>

      {/* Certificates List */}
      {sortedCertificates.length > 0 ? (
        <div className="space-y-3">
          {sortedCertificates.map((cert, displayIndex) => {
            // Find the original index for editing/deleting
            const originalIndex = certificates.findIndex(
              c => c.name === cert.name && c.issuer === cert.issuer && c.dateObtained === cert.dateObtained
            );
            
            const expired = isExpired(cert.expiryDate);
            
            return (
              <Card key={displayIndex} className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <Award className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{cert.name}</h3>
                          <p className="text-sm text-gray-700 truncate">{cert.issuer}</p>
                          
                          {/* Date information */}
                          {cert.dateObtained && (
                            <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                              <Calendar className="h-3 w-3 flex-shrink-0" />
                              <span>
                                Ausgestellt: {formatDate(cert.dateObtained)}
                              </span>
                            </div>
                          )}
                          
                          {/* Expiration date */}
                          {cert.expiryDate && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-gray-500">
                                Läuft ab: {formatDate(cert.expiryDate)}
                              </span>
                              {expired && (
                                <Badge variant="destructive" className="text-xs py-0 px-1.5">
                                  Abgelaufen
                                </Badge>
                              )}
                            </div>
                          )}
                          
                          {/* Credential ID */}
                          {cert.credentialId && (
                            <p className="mt-1 text-sm text-gray-600">
                              ID: {cert.credentialId}
                            </p>
                          )}
                          
                          {/* Credential URL */}
                          {cert.url && (
                            <a
                              href={cert.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Zertifikat anzeigen
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(originalIndex)}
                        disabled={disabled}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Bearbeiten</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmIndex(originalIndex)}
                        disabled={disabled}
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Löschen</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            Noch keine Zertifikate hinzugefügt. Beginne mit dem Hinzufügen deiner beruflichen Zertifizierungen.
          </p>
        </div>
      )}

      {/* Add/Edit Dialog */}
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
              {/* Certificate Name */}
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

              {/* Issuing Organization */}
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

              {/* Date Range */}
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

              {/* Credential ID */}
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

              {/* Credential URL */}
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button type="submit">
                  {editingIndex !== null ? 'Aktualisieren' : 'Hinzufügen'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmIndex !== null}
        onOpenChange={(open) => !open && setDeleteConfirmIndex(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zertifikat löschen</DialogTitle>
            <DialogDescription>
              Bist du sicher, dass du dieses Zertifikat löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmIndex(null)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteConfirmIndex !== null && handleDelete(deleteConfirmIndex)}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
