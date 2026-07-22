import { resetEventDedup, shouldHandleEvent } from '../src/services/eventDedup';

describe('event deduplication', () => {
  beforeEach(resetEventDedup);

  it('handles an event only once for eventType and eventId', () => {
    expect(shouldHandleEvent('patron.scan.created', 'scan-1')).toBe(true);
    expect(shouldHandleEvent('patron.scan.created', 'scan-1')).toBe(false);
    expect(shouldHandleEvent('patron.round.finished', 'scan-1')).toBe(true);
  });
});
