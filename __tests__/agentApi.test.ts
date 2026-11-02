import {getAgents, getAgentRounds} from '../src/services/patronApi';
import {http} from '../src/services/http';
import * as clock from '../src/services/gpsClock';
jest.mock('../src/services/http', () => ({http: {get: jest.fn()}}));
afterEach(() => jest.restoreAllMocks());
it('passes server filters and cancellation and stamps only the local response receipt', async () => {
  jest.spyOn(clock, 'gpsElapsedTime').mockReturnValue(1234);
  const data = {
    items: [],
    pagination: {page: 2, total: 0, limit: 20, totalPages: 0},
  };
  jest.mocked(http.get).mockResolvedValue({data});
  const params = {
    page: 2,
    limit: 20,
    period: 'today' as const,
    siteId: 'site',
    search: 'Ali',
  };
  const signal = new AbortController().signal;
  const result = await getAgents(params, signal);
  expect(http.get).toHaveBeenLastCalledWith('/patron/agents', {params, signal});
  expect(result).toEqual({...data, receivedAt: 1234});
  expect(data).not.toHaveProperty('receivedAt');
});
it('keeps the history payload intact with a receipt for its battery dates', async () => {
  jest.spyOn(clock, 'gpsElapsedTime').mockReturnValue(4321);
  const data = {
    items: [],
    batteryDevices: [],
    pagination: {page: 1, total: 0, limit: 20, totalPages: 0},
  };
  jest.mocked(http.get).mockResolvedValue({data});
  const result = await getAgentRounds('a', {period: '7d'});
  expect(http.get).toHaveBeenLastCalledWith('/patron/agents/a/rounds', {
    params: {period: '7d'},
  });
  expect(result).toEqual({...data, receivedAt: 4321});
});
