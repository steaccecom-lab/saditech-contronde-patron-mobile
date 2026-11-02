import React from 'react';
import {StyleSheet} from 'react-native';
import {render, within} from '@testing-library/react-native';
import {BatteryDevices} from '../src/components/BatteryDevices';
import {batteryPresentation} from '../src/utils/batteryPresentation';
import type {BatteryDevice} from '../src/types/battery';
import {colors} from '../src/theme/colors';
const evaluated = '2026-11-02T08:00:00.000Z';
const device: BatteryDevice = {
  id: 'phone-1',
  mobileDeviceId: null,
  batteryLevel: 18,
  batteryChargingStatus: 'DISCHARGING',
  batteryQuality: 'AVAILABLE',
  batteryCapturedAt: evaluated,
  batteryReceivedAt: evaluated,
  stale: false,
  severity: 'NORMAL',
  levelClassification: 'LOW',
  evaluatedAt: evaluated,
  freshUntil: '2026-11-02T08:03:00.000Z',
};
it.each([
  [80, 'NORMAL', colors.success],
  [70, 'LOW', colors.warning],
  [60, 'CRITICAL', colors.danger],
  [0, 'CRITICAL', colors.danger],
] as const)(
  'uses backend level classification for %i without threshold or charging overrides',
  (batteryLevel, levelClassification, color) => {
    const view = render(
      <BatteryDevices
        devices={[
          {
            ...device,
            batteryLevel,
            levelClassification,
            batteryChargingStatus: 'CHARGING',
          },
        ]}
        receivedAt={1000}
        nowElapsed={1000}
      />,
    );
    expect(
      StyleSheet.flatten(view.getByText(`${batteryLevel} %`).props.style).color,
    ).toBe(color);
    expect(view.getByText('Mesure récente')).toBeTruthy();
  },
);
it('does not turn unavailable sensor data into zero', () => {
  const view = render(
    <BatteryDevices
      devices={[
        {
          ...device,
          batteryLevel: null,
          batteryQuality: 'UNAVAILABLE',
          levelClassification: 'UNAVAILABLE',
        },
      ]}
      receivedAt={1000}
      nowElapsed={1000}
    />,
  );
  expect(view.getByText('Batterie indisponible')).toBeTruthy();
  expect(view.queryByText('0 %')).toBeNull();
});
it('uses the server deadline exactly, independently of phone wall time', () => {
  const date = jest
    .spyOn(Date, 'now')
    .mockReturnValue(Date.parse('2050-01-01T00:00:00Z'));
  expect(batteryPresentation(device, 179999)).toMatchObject({
    freshness: 'RECENT',
    text: '18 %',
    classification: 'LOW',
  });
  expect(batteryPresentation(device, 180000)).toMatchObject({
    freshness: 'OLD',
    text: 'Dernier niveau : 18 %',
    classification: 'LOW',
  });
  date.mockReturnValue(Date.parse('2000-01-01T00:00:00Z'));
  expect(batteryPresentation(device, 0).freshness).toBe('RECENT');
  date.mockRestore();
});
it('always respects an already stale server snapshot', () => {
  const view = render(
    <BatteryDevices
      devices={[{...device, stale: true}]}
      compact
      receivedAt={1000}
      nowElapsed={1000}
    />,
  );
  expect(view.getByText('Mesure ancienne')).toBeTruthy();
  expect(view.queryByText('18 %')).toBeNull();
  expect(
    StyleSheet.flatten(view.getByText('Dernier niveau : 18 %').props.style)
      .color,
  ).toBe(colors.muted);
});
it.each([
  {evaluatedAt: undefined},
  {freshUntil: null},
  {batteryCapturedAt: null},
])('does not invent freshness for missing metadata %j', missing => {
  expect(batteryPresentation({...device, ...missing}, 0).freshness).toBe(
    'UNAVAILABLE',
  );
});
it('does not treat a cached page without a receipt reference as recent', () => {
  const view = render(<BatteryDevices devices={[device]} nowElapsed={1000} />);
  expect(view.getByText('Fraîcheur indisponible')).toBeTruthy();
  expect(view.getByText('Dernier niveau : 18 %')).toBeTruthy();
});
it('retains each device level and real captured date, even if readings differ in freshness', () => {
  const view = render(
    <BatteryDevices
      devices={[
        device,
        {
          ...device,
          id: 'phone-2',
          batteryLevel: 8,
          stale: true,
          batteryCapturedAt: '2026-11-02T07:00:00Z',
        },
      ]}
      receivedAt={1000}
      nowElapsed={1000}
    />,
  );
  const a = within(view.getByLabelText('Appareil phone-1')),
    b = within(view.getByLabelText('Appareil phone-2'));
  expect(a.getByText('18 %')).toBeTruthy();
  expect(a.getByText('Dernière mesure : 02/11/2026 08:00')).toBeTruthy();
  expect(b.getByText('Dernier niveau : 8 %')).toBeTruthy();
  expect(b.getByText('Dernière mesure : 02/11/2026 07:00')).toBeTruthy();
});
it('keeps compact information distinct from detailed timestamps and never infers phone presence', () => {
  const view = render(
    <BatteryDevices
      compact
      devices={[device]}
      receivedAt={1000}
      nowElapsed={1000}
    />,
  );
  expect(view.queryByText(/Dernière mesure/)).toBeNull();
  expect(view.queryByText(/En ligne|hors ligne|4G|5G/)).toBeNull();
});
it('keeps an empty battery list explicit', () => {
  const view = render(<BatteryDevices />);
  expect(view.getByText('Batterie indisponible')).toBeTruthy();
});
it('distinguishes a never-captured measurement from an old one', () => {
  expect(
    batteryPresentation(
      {
        ...device,
        batteryLevel: null,
        batteryQuality: 'UNAVAILABLE',
        batteryCapturedAt: null,
        stale: true,
      },
      0,
    ),
  ).toMatchObject({
    text: 'Batterie indisponible',
    age: 'Fraîcheur indisponible',
    capturedLabel: '—',
  });
});
it('formats a summer instant with the project Casablanca timezone rules rather than the phone zone', () => {
  expect(
    batteryPresentation(
      {...device, batteryCapturedAt: '2026-09-19T08:00:00Z', stale: true},
      0,
    ).capturedLabel,
  ).toBe('19/09/2026 09:00');
});
