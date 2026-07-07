const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateInTimezone(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
  const weekdays = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  return { date, dayOfWeek: weekdays[values.weekday] };
}

export function getDefaultPeriod(now = new Date(), timezone = 'Asia/Shanghai') {
  const { date, dayOfWeek } = getDateInTimezone(now, timezone);
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const endOffset = dayOfWeek === 0 ? -2 : dayOfWeek === 6 ? -1 : 0;
  const start = new Date(date.getTime() + mondayOffset * DAY_MS);
  const end = new Date(date.getTime() + endOffset * DAY_MS);
  return {
    startDate: formatDate(start),
    endDate: formatDate(end)
  };
}

export function enumerateDates(startDate, endDate) {
  const dates = [];
  let current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (current <= end) {
    dates.push(formatDate(current));
    current = new Date(current.getTime() + DAY_MS);
  }
  return dates;
}
