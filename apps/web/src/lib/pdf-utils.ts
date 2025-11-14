/**
 * PDF utility functions for downloading and handling PDF files
 */

import { toast } from 'sonner';

/**
 * Download a file from a URL with a custom filename
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    
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
 */
export async function downloadAsZip(
  files: Array<{ url: string; filename: string }>,
  zipFilename: string
): Promise<void> {
  try {
    // Dynamically import JSZip only when needed
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    // Download all files in parallel
    const downloadPromises = files.map(async ({ url, filename }) => {
      const response = await fetch(url);
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
 * Generate a safe filename from job posting details
 */
export function generateFilename(
  type: 'cover-letter' | 'resume',
  company?: string,
  title?: string
): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const parts = [timestamp];
  
  if (company) {
    parts.push(company.replace(/[^a-z0-9]/gi, '-').toLowerCase());
  }
  
  if (title) {
    const shortTitle = title.substring(0, 30).replace(/[^a-z0-9]/gi, '-').toLowerCase();
    parts.push(shortTitle);
  }
  
  parts.push(type);
  
  return `${parts.join('-')}.pdf`;
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
