import fs from 'fs';
import path from 'path';
import vm from 'vm';

function fixture() {
  const events: Record<string, () => void> = {};
  const map = {
    setView: jest.fn().mockReturnThis(),
    getZoom: () => 15,
    fitBounds: jest.fn(),
    removeLayer: jest.fn(),
    remove: jest.fn(),
    on: jest.fn((event, callback) => {
      events[event] = callback;
    }),
  };
  const markers: any[] = [];
  const layers: any[] = [];
  const L = {
    map: () => map,
    tileLayer: jest.fn((url, options) => {
      const layer = {
        url,
        options,
        addTo: jest.fn().mockReturnThis(),
        on: jest.fn(),
      };
      layers.push(layer);
      return layer;
    }),
    circleMarker: jest.fn(point => {
      const handlers: Record<string, () => void> = {};
      const marker = {
        point,
        handlers,
        addTo: jest.fn().mockReturnThis(),
        bindTooltip: jest.fn(),
        on: jest.fn((event, fn) => {
          handlers[event] = fn;
        }),
        off: jest.fn(),
        setLatLng: jest.fn(function (next) {
          marker.point = next;
        }),
        setStyle: jest.fn(),
        getLatLng: () => marker.point,
      };
      markers.push(marker);
      return marker;
    }),
  };
  const window: any = {
    ReactNativeWebView: {postMessage: jest.fn()},
    addEventListener: jest.fn(),
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, '../android/app/src/main/assets/agent-map/map.js'),
      'utf8',
    ),
    {
      L,
      window,
      document: {
        createElement: () => ({}),
        getElementById: () => ({hidden: true}),
      },
    },
  );
  return {window, map, markers, layers, L, events};
}
const agent = {
  id: 'a',
  name: 'BOUCHTA',
  latitude: 33.5,
  longitude: -7.6,
  status: 'LIVE',
  capturedAt: '2026-09-17T20:10:47Z',
};
it('moves the same marker through positions 1 -> 2 -> 3 without resetting camera or other agents', () => {
  const f = fixture();
  const diagnostic = [];
  for (let i = 0; i < 3; i++) {
    const position = {
      ...agent,
      latitude: 33.5 + i / 1000,
      capturedAt: new Date(
        Date.parse(agent.capturedAt) + i * 30000,
      ).toISOString(),
    };
    f.window.setAgents([position, {...agent, id: 'b'}]);
    diagnostic.push({
      capturedAt: position.capturedAt,
      marker: [...f.markers[0].point],
    });
  }
  expect(f.L.circleMarker).toHaveBeenCalledTimes(2);
  expect(f.markers[0].setLatLng).toHaveBeenCalledTimes(2);
  expect(f.markers[1].setLatLng).not.toHaveBeenCalled();
  expect(f.map.fitBounds).toHaveBeenCalledTimes(1);
  expect(diagnostic).toEqual([
    {capturedAt: '2026-09-17T20:10:47.000Z', marker: [33.5, -7.6]},
    {capturedAt: '2026-09-17T20:11:17.000Z', marker: [33.501, -7.6]},
    {capturedAt: '2026-09-17T20:11:47.000Z', marker: [33.502, -7.6]},
  ]);
});
it('starts in satellite, switches layers without moving camera, and explicitly centers agent', () => {
  const f = fixture();
  expect(f.layers[0].url).toContain('World_Imagery');
  expect(f.layers[0].addTo).toHaveBeenCalledTimes(1);
  f.window.setAgents([agent]);
  f.window.setMapType('plan');
  expect(f.layers[1].addTo).toHaveBeenCalledTimes(1);
  f.window.setMapType('satellite');
  expect(f.layers[0].addTo).toHaveBeenCalledTimes(2);
  expect(f.map.setView).toHaveBeenCalledTimes(1);
  f.window.centerAgent('a');
  expect(f.map.setView).toHaveBeenLastCalledWith([33.5, -7.6], 17);
});
it('keeps user pan, updates status, removes expired agents and sends marker selection', () => {
  const f = fixture();
  f.events.dragstart();
  f.window.setAgents([agent]);
  expect(f.map.fitBounds).not.toHaveBeenCalled();
  f.window.setAgents([{...agent, status: 'STALE'}]);
  expect(f.markers[0].setStyle).toHaveBeenLastCalledWith({color: '#B86200'});
  f.window.setAgents([{...agent, status: 'OFFLINE'}]);
  expect(f.markers[0].setStyle).toHaveBeenLastCalledWith({color: '#C0362C'});
  f.markers[0].handlers.click();
  expect(f.window.ReactNativeWebView.postMessage).toHaveBeenLastCalledWith(
    '{"id":"a"}',
  );
  f.window.setAgents([]);
  expect(f.markers[0].off).toHaveBeenCalledTimes(1);
  expect(f.map.removeLayer).toHaveBeenCalledWith(f.markers[0]);
});
