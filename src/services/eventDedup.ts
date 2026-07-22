const maxSize = 200;
const seen = new Set<string>();
const order: string[] = [];

export function shouldHandleEvent(eventType: string | undefined, eventId: string | undefined): boolean {
  if (!eventType || !eventId) {
    return true;
  }

  const key = `${eventType}:${eventId}`;
  if (seen.has(key)) {
    return false;
  }

  seen.add(key);
  order.push(key);

  while (order.length > maxSize) {
    const oldest = order.shift();
    if (oldest) {
      seen.delete(oldest);
    }
  }

  return true;
}

export function resetEventDedup(): void {
  seen.clear();
  order.length = 0;
}
