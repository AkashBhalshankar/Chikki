// A small festive touch for Chikki on certain days. Diwali moves each year, so its dates are listed.

const DIWALI = ["2026-11-08", "2027-10-29", "2028-10-17", "2029-11-05", "2030-10-26"];
const DAY = 24 * 60 * 60 * 1000;

function onOrNear(date, isoDay, daysEitherSide) {
  const target = new Date(`${isoDay}T12:00:00`).getTime();
  return Math.abs(date.getTime() - target) <= daysEitherSide * DAY + DAY / 2;
}

// Returns "santa", "party", "tricolor", "diya" or null.
export function seasonFor(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 12 && day >= 20 && day <= 26) return "santa";
  if ((month === 12 && day === 31) || (month === 1 && day <= 2)) return "party";
  if ((month === 1 && day === 26) || (month === 8 && day === 15)) return "tricolor";
  if (DIWALI.some((iso) => onOrNear(date, iso, 2))) return "diya";
  return null;
}
