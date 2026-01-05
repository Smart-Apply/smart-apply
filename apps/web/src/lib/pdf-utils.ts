/**
 * PDF utility functions for downloading and handling PDF files
 */

import { toast } from 'sonner';
import { authenticatedFetch } from './api-client';

/**
 * Download a file from a URL with a custom filename
 * Uses authenticatedFetch for automatic token refresh on 401
 */
export async function downloadFile(
  url: string, 
  filename: string
): Promise<void> {
  try {
    const response = await authenticatedFetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
}

/**
 * Download multiple files as a ZIP archive
 * Uses authenticatedFetch for automatic token refresh on 401
 */
export async function downloadAsZip(
  files: Array<{ url: string; filename: string }>,
  zipFilename: string
): Promise<void> {
  try {
    // Dynamically import JSZip only when needed
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    // Download all files in parallel with authenticated fetch
    const downloadPromises = files.map(async ({ url, filename }) => {
      const response = await authenticatedFetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download ${filename}`);
      }
      const blob = await response.blob();
      zip.file(filename, blob);
    });
    
    await Promise.all(downloadPromises);
    
    // Generate ZIP file
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const blobUrl = URL.createObjectURL(zipBlob);
    
    // Download ZIP
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = zipFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('ZIP download failed:', error);
    throw error;
  }
}

/**
 * Check if a URL has expired based on the expiresAt timestamp
 */
export function isUrlExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date();
}

/**
 * Options for generating PDF filenames
 */
export interface FilenameOptions {
  lastName?: string;
  firstName?: string;
  company?: string;
  position?: string;
  documentType: 'Anschreiben' | 'Lebenslauf';
  maxLength?: number;
}

/**
 * Normalize text for filename use: replace umlauts, remove special chars, convert to ASCII
 */
function normalizeForFilename(text: string): string {
  return text
    // Replace German umlauts
    .replace(/ä/g, 'ae')
    .replace(/Ä/g, 'Ae')
    .replace(/ö/g, 'oe')
    .replace(/Ö/g, 'Oe')
    .replace(/ü/g, 'ue')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Remove special characters (keep only alphanumeric, hyphens, and underscores)
    .replace(/[^a-zA-Z0-9\-_]/g, '')
    // Remove duplicate hyphens/underscores
    .replace(/--+/g, '-')
    .replace(/__+/g, '_')
    // Trim hyphens/underscores from edges
    .replace(/^[-_]+|[-_]+$/g, '');
}

/**
 * Truncate text to maximum length, trying to break at word boundaries
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Try to break at hyphen or underscore
  const truncated = text.substring(0, maxLength);
  const lastSeparator = Math.max(
    truncated.lastIndexOf('-'),
    truncated.lastIndexOf('_')
  );
  
  if (lastSeparator > maxLength * 0.7) {
    // Only break at separator if it's not too short
    return truncated.substring(0, lastSeparator);
  }
  
  return truncated;
}

/**
 * Generate intelligent PDF filename with length management and fallbacks
 * 
 * Format: {LastName}_{Company}_{Position}_{DocumentType}.pdf
 * 
 * @param options - Filename generation options
 * @returns Sanitized filename with .pdf extension
 * 
 * @example
 * generatePdfFilename({
 *   lastName: 'Mustermann',
 *   company: 'BWI GmbH',
 *   position: 'Solution Architect',
 *   documentType: 'Anschreiben'
 * })
 * // Returns: "Mustermann_BWI-GmbH_Solution-Architect_Anschreiben.pdf"
 */
export function generatePdfFilename(options: FilenameOptions): string {
  const maxLength = options.maxLength || 80;
  const pdfExtension = '.pdf';
  const maxFilenameLength = maxLength - pdfExtension.length;
  
  // Normalize and sanitize all components
  const lastName = options.lastName ? normalizeForFilename(options.lastName) : '';
  const firstName = options.firstName ? normalizeForFilename(options.firstName) : '';
  const company = options.company ? normalizeForFilename(options.company) : '';
  const position = options.position ? normalizeForFilename(options.position) : '';
  const documentType = normalizeForFilename(options.documentType);
  
  // Build filename with progressive fallback strategy
  let parts: string[] = [];
  
  // Strategy 1: Full format with position
  if (lastName && company && position) {
    parts = [lastName, company, position, documentType];
    let filename = parts.join('_');
    
    if (filename.length <= maxFilenameLength) {
      return filename + pdfExtension;
    }
    
    // Strategy 2: Truncate position
    const truncatedPosition = truncateText(position, 20);
    parts = [lastName, company, truncatedPosition, documentType];
    filename = parts.join('_');
    
    if (filename.length <= maxFilenameLength) {
      return filename + pdfExtension;
    }
    
    // Strategy 3: Remove position
    parts = [lastName, company, documentType];
    filename = parts.join('_');
    
    if (filename.length <= maxFilenameLength) {
      return filename + pdfExtension;
    }
    
    // Strategy 4: Truncate company
    const availableForCompany = maxFilenameLength - lastName.length - documentType.length - 2; // 2 underscores
    const truncatedCompany = truncateText(company, Math.max(availableForCompany, 20));
    parts = [lastName, truncatedCompany, documentType];
    return parts.join('_') + pdfExtension;
  }
  
  // Fallback: No position provided
  if (lastName && company) {
    parts = [lastName, company, documentType];
    let filename = parts.join('_');
    
    if (filename.length <= maxFilenameLength) {
      return filename + pdfExtension;
    }
    
    // Truncate company if too long
    const availableForCompany = maxFilenameLength - lastName.length - documentType.length - 2;
    const truncatedCompany = truncateText(company, Math.max(availableForCompany, 20));
    parts = [lastName, truncatedCompany, documentType];
    return parts.join('_') + pdfExtension;
  }
  
  // Fallback: No company provided
  if (lastName && position) {
    parts = [lastName, position, documentType];
    let filename = parts.join('_');
    
    if (filename.length <= maxFilenameLength) {
      return filename + pdfExtension;
    }
    
    // Truncate position if too long
    const availableForPosition = maxFilenameLength - lastName.length - documentType.length - 2;
    const truncatedPosition = truncateText(position, Math.max(availableForPosition, 20));
    parts = [lastName, truncatedPosition, documentType];
    return parts.join('_') + pdfExtension;
  }
  
  // Fallback: Only lastname
  if (lastName) {
    parts = [lastName, documentType];
    return parts.join('_') + pdfExtension;
  }
  
  // Fallback: Only firstname (if no lastname)
  if (firstName) {
    parts = [firstName, documentType];
    return parts.join('_') + pdfExtension;
  }
  
  // Final fallback: Generic name
  return `Bewerbung_${documentType}${pdfExtension}`;
}

/**
 * Generate a safe filename from job posting details (legacy function for backward compatibility)
 * 
 * @deprecated Use generatePdfFilename() instead for better formatting
 */
export function generateFilename(
  type: 'cover-letter' | 'resume',
  company?: string,
  title?: string,
  lastName?: string,
  firstName?: string
): string {
  // Map legacy type to German document type
  const documentType = type === 'cover-letter' ? 'Anschreiben' : 'Lebenslauf';
  
  // Use new intelligent filename generator
  return generatePdfFilename({
    lastName,
    firstName,
    company,
    position: title,
    documentType,
  });
}

/**
 * Handle download with error handling and toast notifications
 */
export async function handleDownload(
  url: string,
  filename: string,
  onExpired?: () => void
): Promise<void> {
  const loadingToast = toast.loading('Download wird vorbereitet...');
  
  try {
    await downloadFile(url, filename);
    toast.success('Download erfolgreich!', { id: loadingToast });
  } catch (error) {
    toast.dismiss(loadingToast);
    
    // Check if it might be an expired URL error
    if (error instanceof Error && error.message.includes('403')) {
      toast.error('Download-Link ist abgelaufen. Wird neu geladen...');
      onExpired?.();
    } else {
      toast.error('Download fehlgeschlagen. Bitte versuche es erneut.');
    }
    
    throw error;
  }
}

/**
 * Handle ZIP download with error handling
 */
export async function handleZipDownload(
  files: Array<{ url: string; filename: string }>,
  zipFilename: string,
  onExpired?: () => void
): Promise<void> {
  const loadingToast = toast.loading('ZIP-Archiv wird erstellt...');
  
  try {
    await downloadAsZip(files, zipFilename);
    toast.success('ZIP-Download erfolgreich!', { id: loadingToast });
  } catch (error) {
    toast.dismiss(loadingToast);
    
    if (error instanceof Error && error.message.includes('403')) {
      toast.error('Download-Links sind abgelaufen. Wird neu geladen...');
      onExpired?.();
    } else {
      toast.error('ZIP-Download fehlgeschlagen. Bitte versuche es erneut.');
    }
    
    throw error;
  }
}
