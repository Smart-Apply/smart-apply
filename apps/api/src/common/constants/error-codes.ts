/**
 * Error codes and user-friendly German messages for Smart Apply
 *
 * These error codes are returned in the API response `code` field
 * and mapped to user-friendly German messages for better UX.
 */

export enum ErrorCode {
  // Authentication errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  UNAUTHORIZED = 'UNAUTHORIZED',
  USER_EXISTS = 'USER_EXISTS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_NOT_FOUND = 'REFRESH_TOKEN_NOT_FOUND',
  INVALID_TOKEN_TYPE = 'INVALID_TOKEN_TYPE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // Profile errors
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',
  PROFILE_INCOMPLETE = 'PROFILE_INCOMPLETE',
  PROFILE_UPDATE_FAILED = 'PROFILE_UPDATE_FAILED',

  // Job posting errors
  JOB_POSTING_NOT_FOUND = 'JOB_POSTING_NOT_FOUND',
  JOB_POSTING_PARSE_FAILED = 'JOB_POSTING_PARSE_FAILED',

  // Application errors
  APPLICATION_NOT_FOUND = 'APPLICATION_NOT_FOUND',
  APPLICATION_DUPLICATE = 'APPLICATION_DUPLICATE',
  APPLICATION_GENERATING = 'APPLICATION_GENERATING',
  APPLICATION_GENERATION_FAILED = 'APPLICATION_GENERATION_FAILED',
  APPLICATION_NOT_FAILED = 'APPLICATION_NOT_FAILED',
  APPLICATION_NO_RESUME = 'APPLICATION_NO_RESUME',
  APPLICATION_NO_JOB = 'APPLICATION_NO_JOB',
  APPLICATION_RESUME_CORRUPTED = 'APPLICATION_RESUME_CORRUPTED',

  // LLM errors
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  LLM_PARSE_ERROR = 'LLM_PARSE_ERROR',
  LLM_INVALID_RESPONSE = 'LLM_INVALID_RESPONSE',

  // File upload errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_INVALID_TYPE = 'FILE_INVALID_TYPE',

  // Password errors
  PASSWORD_INCORRECT = 'PASSWORD_INCORRECT',
  PASSWORD_SAME_AS_CURRENT = 'PASSWORD_SAME_AS_CURRENT',
  PASSWORD_CHANGE_OAUTH = 'PASSWORD_CHANGE_OAUTH',

  // Email verification errors
  EMAIL_ALREADY_VERIFIED = 'EMAIL_ALREADY_VERIFIED',
  INVALID_OR_EXPIRED_TOKEN = 'INVALID_OR_EXPIRED_TOKEN',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // OAuth
  OAUTH_ALREADY_LINKED = 'OAUTH_ALREADY_LINKED',
  CANNOT_UNLINK_ONLY_AUTH_METHOD = 'CANNOT_UNLINK_ONLY_AUTH_METHOD',

  // Generic errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
}

/**
 * User-friendly German error messages mapped to error codes
 * These are actionable messages that tell users what to do next
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Authentication errors
  [ErrorCode.INVALID_CREDENTIALS]: 'E-Mail oder Passwort ist falsch. Bitte versuche es erneut.',
  [ErrorCode.UNAUTHORIZED]: 'Bitte melde dich an, um fortzufahren.',
  [ErrorCode.USER_EXISTS]: 'Ein Konto mit dieser E-Mail existiert bereits. Bitte melde dich an.',
  [ErrorCode.USER_NOT_FOUND]: 'Benutzer nicht gefunden. Bitte melde dich erneut an.',
  [ErrorCode.REFRESH_TOKEN_INVALID]: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.',
  [ErrorCode.REFRESH_TOKEN_NOT_FOUND]: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.',
  [ErrorCode.INVALID_TOKEN_TYPE]: 'Ungültiger Token-Typ. Bitte melde dich erneut an.',
  [ErrorCode.SESSION_EXPIRED]: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.',

  // Profile errors
  [ErrorCode.PROFILE_NOT_FOUND]: 'Bitte erstelle zuerst dein Profil im Profil-Bereich.',
  [ErrorCode.PROFILE_INCOMPLETE]: 'Bitte vervollständige dein Profil, bevor du fortfährst.',
  [ErrorCode.PROFILE_UPDATE_FAILED]:
    'Profil konnte nicht aktualisiert werden. Bitte versuche es erneut.',

  // Job posting errors
  [ErrorCode.JOB_POSTING_NOT_FOUND]:
    'Stellenanzeige nicht gefunden. Möglicherweise wurde sie gelöscht.',
  [ErrorCode.JOB_POSTING_PARSE_FAILED]:
    'Die Stellenanzeige konnte nicht verarbeitet werden. Bitte überprüfe das Format.',

  // Application errors
  [ErrorCode.APPLICATION_NOT_FOUND]: 'Bewerbung nicht gefunden. Möglicherweise wurde sie gelöscht.',
  [ErrorCode.APPLICATION_DUPLICATE]:
    'Du hast bereits eine Bewerbung für diese Stelle erstellt. Bitte bearbeite die bestehende Bewerbung oder lösche sie zuerst.',
  [ErrorCode.APPLICATION_GENERATING]:
    'Dokumente werden aktuell erstellt. Bitte warte einen Moment.',
  [ErrorCode.APPLICATION_GENERATION_FAILED]:
    'Die Bewerbung konnte nicht erstellt werden. Bitte versuche es erneut.',
  [ErrorCode.APPLICATION_NOT_FAILED]:
    'Die Bewerbung ist nicht fehlgeschlagen. Erneutes Generieren ist nur bei fehlgeschlagenen Bewerbungen möglich.',
  [ErrorCode.APPLICATION_NO_RESUME]: 'Bitte speichere zuerst deinen Lebenslauf.',
  [ErrorCode.APPLICATION_NO_JOB]: 'Keine Stellenanzeige verknüpft. Bitte wähle eine Stelle aus.',
  [ErrorCode.APPLICATION_RESUME_CORRUPTED]:
    'Gespeicherter Lebenslauf ist beschädigt. Bitte aktualisiere ihn.',

  // LLM errors
  [ErrorCode.LLM_TIMEOUT]:
    'Die KI-Generierung dauert länger als erwartet. Deine Bewerbung wird im Hintergrund erstellt.',
  [ErrorCode.LLM_PARSE_ERROR]:
    'Die KI-Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut.',
  [ErrorCode.LLM_INVALID_RESPONSE]:
    'Die KI hat eine ungültige Antwort geliefert. Bitte versuche es erneut.',

  // File upload errors
  [ErrorCode.FILE_TOO_LARGE]: 'Die Datei ist zu groß. Maximal 10 MB sind erlaubt.',
  [ErrorCode.FILE_INVALID_TYPE]:
    'Ungültiger Dateityp. Nur PDF-, Word- und Textdateien sind erlaubt.',

  // Password errors
  [ErrorCode.PASSWORD_INCORRECT]: 'Das aktuelle Passwort ist falsch. Bitte versuche es erneut.',
  [ErrorCode.PASSWORD_SAME_AS_CURRENT]:
    'Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.',
  [ErrorCode.PASSWORD_CHANGE_OAUTH]: 'Passwort kann für OAuth-Konten nicht geändert werden.',

  // Email verification errors
  [ErrorCode.EMAIL_ALREADY_VERIFIED]: 'Deine E-Mail-Adresse wurde bereits verifiziert.',
  [ErrorCode.INVALID_OR_EXPIRED_TOKEN]: 'Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.',

  // Rate limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]:
    'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.',

  // OAuth
  [ErrorCode.OAUTH_ALREADY_LINKED]:
    'Dieser OAuth-Account ist bereits mit einem anderen Benutzer verknüpft.',
  [ErrorCode.CANNOT_UNLINK_ONLY_AUTH_METHOD]:
    'Du kannst die einzige Anmeldemethode nicht entfernen. Bitte lege zuerst ein Passwort fest.',

  // Generic errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Ein Fehler ist aufgetreten. Bitte versuche es später erneut.',
  [ErrorCode.VALIDATION_ERROR]: 'Ungültige Eingabe. Bitte überprüfe deine Daten.',
  [ErrorCode.NOT_FOUND]: 'Die angeforderte Ressource wurde nicht gefunden.',
  [ErrorCode.FORBIDDEN]: 'Zugriff verweigert. Du hast keine Berechtigung für diese Aktion.',
};

/**
 * Get user-friendly error message for a given error code
 * Falls back to a generic message if code is not found
 */
export function getErrorMessage(code: ErrorCode | string): string {
  if (code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code as ErrorCode];
  }
  return ERROR_MESSAGES[ErrorCode.INTERNAL_SERVER_ERROR];
}
