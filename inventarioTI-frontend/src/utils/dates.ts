const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['minute', 60],
  ['hour', 60 * 60],
  ['day', 60 * 60 * 24],
];

/** Parsea fechas ISO del backend (naive UTC, sin zona) como UTC. */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "hace 5 minutos", "ayer"… hasta 7 días; después, fecha corta en el idioma activo. */
export function formatRelativeDate(date: Date, locale: string, now = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 7 * 24 * 60 * 60) {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (abs < 60) return rtf.format(0, 'minute');
    let unit: Intl.RelativeTimeFormatUnit = 'minute';
    let size = 60;
    for (const [candidate, candidateSize] of UNITS) {
      if (abs >= candidateSize) {
        unit = candidate;
        size = candidateSize;
      }
    }
    return rtf.format(Math.round(seconds / size), unit);
  }
  return date.toLocaleDateString(locale, { dateStyle: 'medium' });
}

export const formatDateTime = (date: Date, locale: string) =>
  date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

/** Hora (HH:mm) si es hoy; si no, fecha y hora cortas. */
export function formatTimeOrDateTime(date: Date, locale: string, now = new Date()): string {
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}
