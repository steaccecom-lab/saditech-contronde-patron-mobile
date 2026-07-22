import { extractRoundId } from '../src/services/deepLinkService';

describe('deep links', () => {
  it('extracts round id from Patron deep link', () => {
    expect(extractRoundId('controndepatron://rounds/round-123')).toBe('round-123');
  });

  it('ignores unsupported links', () => {
    expect(extractRoundId('https://example.test/rounds/round-123')).toBeNull();
  });
});
