import moment from 'moment-timezone';

// Bundled IANA 2026c: independent of Node/Android/browser timezone data.
export const BUSINESS_TIME_ZONE = 'Africa/Casablanca';

export function businessDateKey(value = new Date(), timeZone = BUSINESS_TIME_ZONE): string {
  return moment(value).tz(timeZone).format('YYYY-MM-DD');
}

/** Planned DB/API timestamps encode civil time in UTC fields, NOT real instants. */
export function plannedDayRange(value = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const day = moment.utc(businessDateKey(value, timeZone));
  return { from: day.toDate(), to: day.clone().add(1, 'day').toDate() };
}

export function instantDayRange(value = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const day = moment.tz(businessDateKey(value, timeZone), timeZone).startOf('day');
  return { from: day.toDate(), to: day.clone().add(1, 'day').toDate() };
}

export function civilToInstant(value: Date, timeZone = BUSINESS_TIME_ZONE): Date {
  if (Number.isNaN(value.getTime())) {
    return new Date(NaN);
  }
  // Preserve the existing two-pass disambiguation of repeated/skipped hours.
  // Only the offset provider changes from host Intl to the bundled IANA data.
  let candidate = value.getTime();
  for (let pass = 0; pass < 2; pass += 1) {
    candidate += value.getTime() - instantToCivil(new Date(candidate), timeZone).getTime();
  }
  return new Date(candidate);
}

export function instantToCivil(value: Date, timeZone = BUSINESS_TIME_ZONE): Date {
  return moment.utc(moment(value).tz(timeZone).format('YYYY-MM-DDTHH:mm:ss.SSS')).toDate();
}
