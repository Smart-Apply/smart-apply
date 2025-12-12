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
 * Smart date formatting with progressive granularity:
 * - < 1 hour: "vor 5 Minuten", "vor 30 Minuten"
 * - Today: "Heute um 14:30"
 * - Yesterday: "Gestern um 14:30"
 * - This year: "15. Jan um 14:30"
 * - Older: "15.01.2023"
 * 
 * @param date - Date string (UTC) or Date object to format
 * @returns Smart formatted string in German
 */
export function formatDateSmart(date: string | Date): string {
  const targetDate = new Date(date);
  const now = new Date();
  
  // Less than 1 hour: relative time (e.g., "vor 5 Minuten", "vor 30 Minuten")
  const diffHours = (now.getTime() - targetDate.getTime()) / (1000 * 60 * 60);
  if (diffHours < 1 && diffHours >= 0) {
    return formatRelativeTime(date);
  }
  
  // Convert to user's timezone for accurate day comparisons
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zonedDate = toZonedTime(targetDate, userTimezone);
  const zonedNow = toZonedTime(now, userTimezone);
  
  // Manual today/yesterday check to ensure timezone-aware comparison
  const targetDay = zonedDate.getDate();
  const targetMonth = zonedDate.getMonth();
  const targetYear = zonedDate.getFullYear();
  const nowDay = zonedNow.getDate();
  const nowMonth = zonedNow.getMonth();
  const nowYear = zonedNow.getFullYear();
  
  // Today: "Heute um 14:30"
  if (targetYear === nowYear && targetMonth === nowMonth && targetDay === nowDay) {
    return `Heute um ${format(zonedDate, 'HH:mm')}`;
  }
  
  // Yesterday: "Gestern um 14:30"
  // Calculate yesterday using timezone-aware dates for DST/boundary safety
  const yesterdayMs = zonedNow.getTime() - (24 * 60 * 60 * 1000);
  const yesterdayDate = toZonedTime(new Date(yesterdayMs), userTimezone);
  if (targetYear === yesterdayDate.getFullYear() && 
      targetMonth === yesterdayDate.getMonth() && 
      targetDay === yesterdayDate.getDate()) {
    return `Gestern um ${format(zonedDate, 'HH:mm')}`;
  }
  
  // This year: "15. Jan um 14:30"
  if (targetYear === nowYear) {
    return format(zonedDate, 'dd. MMM um HH:mm', { locale: de });
  }
  
  // Older: "15.01.2023"
  return format(zonedDate, 'dd.MM.yyyy', { locale: de });
}

/**
 * Formats a date with full timestamp for tooltips and detailed displays
 * @param date - Date string (UTC) or Date object to format
 * @returns Full timestamp in German format (dd.MM.yyyy HH:mm)
 */
export function formatDateFull(date: string | Date): string {
  return formatDate(date, 'dd.MM.yyyy HH:mm');
}

/**
 * Formats a date for display with full timestamp including time
 * Backwards compatible wrapper for formatDateFull
 * @param date - Date string (UTC) or Date object to format
 * @returns Full timestamp in German format (dd.MM.yyyy HH:mm)
 */
export function formatFullTimestamp(date: string | Date): string {
  return formatDateFull(date);
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
