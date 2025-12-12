/**
 * Application domain constants
 * Must match backend constants
 */

export const APPLICATION_TITLE_MAX_LENGTH = 60;
export const APPLICATION_TITLE_MIN_LENGTH = 3;
export const APPLICATION_ID_DISPLAY_LENGTH = 8;

/**
 * Loading messages for dynamic imports
 * Centralized to maintain consistency across the application
 */
export const LOADING_MESSAGES = {
  PDF_PREVIEW: 'Lädt PDF-Vorschau...',
  EDITOR: 'Lädt Editor...',
  FORM: 'Lädt Formular...',
} as const;

