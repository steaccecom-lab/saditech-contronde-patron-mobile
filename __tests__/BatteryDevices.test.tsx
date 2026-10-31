import React from 'react';
import {StyleSheet} from 'react-native';
import {render} from '@testing-library/react-native';
import {BatteryDevices} from '../src/components/BatteryDevices';
import {batteryPresentation} from '../src/utils/batteryPresentation';
import type {BatteryDevice} from '../src/types/battery';
import {colors} from '../src/theme/colors';
const now = Date.now();
const device: BatteryDevice = {
  id: 'phone-1',
  mobileDeviceId: null,
  batteryLevel: 18,
  batteryChargingStatus: 'DISCHARGING',
  batteryQuality: 'AVAILABLE',
  batteryCapturedAt: new Date(now).toISOString(),
  batteryReceivedAt: new Date(now).toISOString(),
  stale: false,
  severity: 'LOW',
};
it.each([
  [80, 'NORMAL', colors.text],
  [18, 'LOW', colors.warning],
  [0, 'CRITICAL', colors.danger],
] as const)('shows %i with the server severity', (level, severity, color) => {
  const view = render(
    <BatteryDevices devices={[{...device, batteryLevel: level, severity}]} />,
  );
  expect(
    StyleSheet.flatten(view.getByText(level + ' % · En décharge').props.style)
      .color,
  ).toBe(color);
});
it('keeps an unavailable measurement distinct from real zero', () => {
  const view = render(
    <BatteryDevices
      devices={[{...device, batteryLevel: null, batteryQuality: 'UNAVAILABLE'}]}
    />,
  );
  expect(view.getByText('Batterie indisponible')).toBeTruthy();
  expect(view.queryByText(/0 %/)).toBeNull();
});
it('neutralizes an old measure at exactly 30 minutes, including already-stale server data', () => {
  expect(batteryPresentation(device, now + 1800000)).toMatchObject({
    stale: true,
    severity: 'UNKNOWN',
  });
  const value = batteryPresentation(device, now + 1800000);
  expect(value.age).toContain('Mesure ancienne');
  expect(batteryPresentation({...device, stale: true}, now).severity).toBe(
    'UNKNOWN',
  );
});
it('shows charging and multiple distinct phones', () => {
  const view = render(
    <BatteryDevices
      devices={[
        device,
        {
          ...device,
          id: 'phone-2',
          batteryChargingStatus: 'CHARGING',
          severity: 'NORMAL',
        },
      ]}
    />,
  );
  expect(view.getAllByText(/Téléphone phone-/)).toHaveLength(2);
  expect(view.getByText(/⚡ En charge/)).toBeTruthy();
});
it('does not infer offline or powered-off from missing data', () => {
  const view = render(<BatteryDevices />);
  expect(view.getByText('Batterie indisponible')).toBeTruthy();
  expect(view.queryByText(/hors ligne|éteint/i)).toBeNull();
});
