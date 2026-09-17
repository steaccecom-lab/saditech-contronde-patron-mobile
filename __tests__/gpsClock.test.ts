import {gpsServerNow} from '../src/services/gpsClock';
it('ages positions and expires post-round independently of handset wall time', () => {
  const server = '2026-09-16T12:00:00.000Z';
  const received = 1000;
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2000-01-01T00:00:00Z'));
  expect(gpsServerNow(server, received, 121000)).toBe(
    Date.parse(server) + 120000,
  );
  jest.mocked(Date.now).mockReturnValue(Date.parse('2050-01-01T00:00:00Z'));
  expect(gpsServerNow(server, received, 901000)).toBe(
    Date.parse(server) + 900000,
  );
  jest.restoreAllMocks();
});
