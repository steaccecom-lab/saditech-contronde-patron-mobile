const TIME_ZONE = 'Africa/Casablanca';

export function defaultHistoryDates(now = new Date()) {
  const end = dateKey(now);
  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() - 6);
  return { start: dateKey(startDate), end };
}

export function casablancaRange(start: string, endInclusive: string) {
  const end = new Date(`${endInclusive}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { from: zonedMidnight(start), to: zonedMidnight(dateKey(end)) };
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function zonedMidnight(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day);
  const offset = offsetAt(new Date(guess));
  const first = new Date(guess - offset);
  return new Date(guess - offsetAt(first)).toISOString();
}

function offsetAt(date: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - date.getTime();
}
