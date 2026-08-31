// The backend always generates these in UTC, but SQLite drops the timezone
// marker on round-trip, so the JSON string arrives with no offset (e.g.
// "2026-08-31T15:06:07"). JS's Date parser treats that as *local* time, not
// UTC — silently skewing every age by the viewer's UTC offset. Appending 'Z'
// when it's missing is what actually fixes that, not just papering over it.
function parseUtc(iso: string): Date {
  const hasOffset = /Z$|[+-]\d{2}:\d{2}$/.test(iso);
  return new Date(hasOffset ? iso : `${iso}Z`);
}

/** A short relative-time label for a session row: "just now", "3h ago", "12d ago". */
export function formatAge(iso: string): string {
  const diffMs = Date.now() - parseUtc(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}
