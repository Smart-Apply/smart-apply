import { format, formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { de } from 'date-fns/locale';

/**
 * Formats a date string or Date object to German locale with timezone awareness
 * @param date - Date string (UTC) or Date object to format
 * @param formatStr - Date-fns format string (default: 'dd.MM.yyyy HH:mm')
 * @returns Formatted date string in user's timezone
 */
export function formatDate(date: string | Date, formatStr = 'dd.MM.yyyy HH:mm'): string {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zonedDate = toZonedTime(new Date(date), userTimezone);
  return format(zonedDate, formatStr, { locale: de });
}

/**
 * Formats a date as relative time (e.g., "vor 2 Stunden")
 * @param date - Date string (UTC) or Date object to format
 * @returns Relative time string in German
 */
export function formatRelativeTime(date: string | Date): string {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zonedDate = toZonedTime(new Date(date), userTimezone);
  return formatDistanceToNow(zonedDate, { addSuffix: true, locale: de });
}

/**
 * Smart date formatting - uses relative time for recent dates, full date for older ones
 * @param date - Date string (UTC) or Date object to format
 * @returns Formatted string - relative time if < 24h, otherwise full date
 */
export function formatDateSmart(date: string | Date): string {
  const now = new Date();
  const targetDate = new Date(date);
  const diffHours = (now.getTime() - targetDate.getTime()) / (1000 * 60 * 60);
  
  // If less than 24 hours ago, show relative time
  if (diffHours < 24 && diffHours >= 0) {
    return formatRelativeTime(date);
  }
  
  // Otherwise show full date
  return formatDate(date);
}

/**
 * Formats a date for display with full timestamp including time
 * @param date - Date string (UTC) or Date object to format
 * @returns Full timestamp in German format
 */
export function formatFullTimestamp(date: string | Date): string {
  return formatDate(date, 'dd. MMMM yyyy, HH:mm');
}

/**
 * Formats a date for tooltips with detailed timestamp
 * @param date - Date string (UTC) or Date object to format
 * @returns Full timestamp with seconds for tooltips
 */
export function formatTooltipTimestamp(date: string | Date): string {
  return formatDate(date, 'dd. MMMM yyyy, HH:mm:ss');
}

/**
 * Formats a date for short display (just date, no time)
 * @param date - Date string (UTC) or Date object to format
 * @returns Short date string (dd.MM.yyyy)
 */
export function formatShortDate(date: string | Date): string {
  return formatDate(date, 'dd.MM.yyyy');
}
