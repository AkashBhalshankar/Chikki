// "pushed 2 days ago" for the GitHub strip.

export function timeAgo(isoDay, now = new Date()) {
  if (!isoDay) return "";
  const then = new Date(`${isoDay}T12:00:00`);
  const days = Math.max(0, Math.round((now.getTime() - then.getTime()) / 86400000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months <= 1 ? "a month ago" : months < 12 ? `${months} months ago` : "over a year ago";
}
