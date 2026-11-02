import {getRounds, getSites} from '../src/services/patronApi';
import {http} from '../src/services/http';
jest.mock('../src/services/http', () => ({http: {get: jest.fn()}}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(http.get).mockResolvedValue({data: {sites: []}});
});
it('passes combined round filters to the existing endpoint with cancellation', async () => {
  const params = {
    siteId: 'site-a',
    period: 'custom' as const,
    status: 'STARTED' as const,
    from: '2026-11-02T00:00:00Z',
    to: '2026-11-03T00:00:00Z',
    page: 2,
    limit: 20,
  };
  const signal = new AbortController().signal;
  await getRounds(params, signal);
  expect(http.get).toHaveBeenCalledWith('/patron/rounds', {params, signal});
});
it('preserves the default active sites contract and can request accessible historical sites', async () => {
  await getSites();
  expect(http.get).toHaveBeenLastCalledWith('/sites', {
    params: {status: 'ACTIVE'},
  });
  await getSites({includeInactive: true});
  expect(http.get).toHaveBeenLastCalledWith('/sites', {params: {}});
});
