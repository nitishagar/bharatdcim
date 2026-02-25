/** Format ISO string to IST display: "2026-02-25T10:30:00Z" → "25 Feb 2026, 4:00 PM" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
