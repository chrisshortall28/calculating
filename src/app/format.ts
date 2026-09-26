/** Parses a stored yyyy-mm-dd date as a local date (not UTC midnight). */
function parseDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** "Sat 26 Sep 2026" */
export function formatLongDate(iso: string): string {
  const d = parseDate(iso);
  return d
    ? d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '';
}

/** { day: "26", month: "SEP" } for a calendar-style date tile. */
export function dateTile(iso: string): { day: string; month: string } | null {
  const d = parseDate(iso);
  return d
    ? {
        day: String(d.getDate()),
        month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
      }
    : null;
}
