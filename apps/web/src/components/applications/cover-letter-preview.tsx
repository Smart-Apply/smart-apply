'use client';

import styles from './cover-letter-preview.module.css';
import { sanitizeHtml } from '@/lib/sanitize';

interface CoverLetterPreviewProps {
  html: string;
}

export function CoverLetterPreview({ html }: CoverLetterPreviewProps) {
  if (!html || !html.trim()) {
    return (
      <div className={styles.emptyState}>
        <p>Noch kein Anschreiben vorhanden.</p>
        <p>Nutze die KI-Generierung oder erstelle deinen eigenen Text.</p>
      </div>
    );
  }

  const sanitized = sanitizeHtml(html);

  return (
    <div className={styles.previewPage}>
      <div className={styles.content} dangerouslySetInnerHTML={{ __html: sanitized }} />
    </div>
  );
}
