import { casablancaRange, defaultHistoryDates } from '../src/utils/businessDates';

describe('dates métier Casablanca', () => {
  it('produit une fenêtre de sept journées [début, fin[', () => {
    expect(defaultHistoryDates(new Date('2026-07-28T12:00:00Z'))).toEqual({ start: '2026-07-22', end: '2026-07-28' });
    const range = casablancaRange('2026-07-22', '2026-07-28');
    expect(range).toEqual({ from: '2026-07-21T23:00:00.000Z', to: '2026-07-28T23:00:00.000Z' });
  });

  it('respecte le changement d’offset Casablanca', () => {
    expect(casablancaRange('2026-02-20', '2026-03-20')).toEqual({ from: '2026-02-20T00:00:00.000Z', to: '2026-03-21T00:00:00.000Z' });
  });
});
