/* global L */
(function () {
  'use strict';
  const map = L.map('map').setView([33.57, -7.59], 7);
  const markers = new Map();
  let fitted = false;
  let userMoved = false;
  map.on('dragstart', () => {
    userMoved = true;
  });
  map.on('zoomstart', () => {
    userMoved = true;
  });
  const layers = {
    satellite: L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution:
          'Tiles © Esri — Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      },
    ),
    plan: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }),
  };
  let currentLayer;
  Object.values(layers).forEach(layer => {
    layer.on('tileerror', () => {
      if (layer === currentLayer)
        {document.getElementById('notice').hidden = false;}
    });
  });
  window.setMapType = function (type) {
    const next = layers[type];
    if (!next || currentLayer === next) {return;}
    if (currentLayer) {map.removeLayer(currentLayer);}
    currentLayer = next;
    document.getElementById('notice').hidden = true;
    next.addTo(map);
  };
  window.setMapType('satellite');
  window.centerAgent = function (id) {
    const entry = markers.get(id);
    if (entry)
      {map.setView(entry.marker.getLatLng(), Math.max(map.getZoom(), 17));}
  };
  window.setAgents = function (agents) {
    const present = new Set();
    const bounds = [];
    agents.forEach(agent => {
      if (!Number.isFinite(agent.latitude) || !Number.isFinite(agent.longitude))
        {return;}
      present.add(agent.id);
      const point = [agent.latitude, agent.longitude];
      const color =
        agent.status === 'LIVE'
          ? '#16803C'
          : agent.status === 'STALE'
          ? '#B86200'
          : '#C0362C';
      let entry = markers.get(agent.id);
      if (!entry) {
        const marker = L.circleMarker(point, {
          radius: 10,
          color,
          fillOpacity: 0.85,
        }).addTo(map);
        const label = document.createElement('span');
        marker.bindTooltip(label);
        marker.on('click', () =>
          window.ReactNativeWebView.postMessage(JSON.stringify({id: agent.id})),
        );
        entry = {marker, label};
        markers.set(agent.id, entry);
      } else {
        if (
          entry.latitude !== agent.latitude ||
          entry.longitude !== agent.longitude
        )
          {entry.marker.setLatLng(point);}
        if (entry.color !== color) {entry.marker.setStyle({color});}
      }
      entry.label.textContent = agent.name + ' · ' + agent.status;
      Object.assign(entry, {
        latitude: agent.latitude,
        longitude: agent.longitude,
        color,
      });
      bounds.push(point);
    });
    markers.forEach((entry, id) => {
      if (!present.has(id)) {
        entry.marker.off();
        map.removeLayer(entry.marker);
        markers.delete(id);
      }
    });
    if (bounds.length && !fitted && !userMoved) {
      map.fitBounds(bounds, {padding: [30, 30], maxZoom: 17});
      fitted = true;
    }
  };
  window.addEventListener('unload', () => {
    markers.clear();
    map.remove();
  });
  window.ReactNativeWebView.postMessage(JSON.stringify({type: 'ready'}));
})();
