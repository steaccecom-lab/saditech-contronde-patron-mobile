import React from 'react';
import {PixelRatio, StyleSheet, Text, View} from 'react-native';
import {
  cleanup,
  fireEvent,
  render,
  within,
} from '@testing-library/react-native';
import {AgentCard} from '../src/components/AgentCard';
import {BatteryDevices} from '../src/components/BatteryDevices';
import type {AgentItem} from '../src/types/api';
import type {BatteryDevice} from '../src/types/battery';
import {colors} from '../src/theme/colors';

const at = '2026-11-02T08:00:00Z';
const phone: BatteryDevice = {
  id: 'phone-a',
  mobileDeviceId: null,
  batteryLevel: 70,
  batteryQuality: 'AVAILABLE',
  batteryChargingStatus: 'DISCHARGING',
  batteryCapturedAt: at,
  batteryReceivedAt: at,
  evaluatedAt: at,
  freshUntil: '2026-11-02T08:05:00Z',
  stale: false,
  severity: 'NORMAL',
  levelClassification: 'LOW',
};
const agent: AgentItem = {
  id: 'a',
  name: 'Nom composé de l’agent à identifier sans confusion',
  email: 'test@example.invalid',
  batteryDevices: [phone],
  lastRound: {
    scheduledRoundId: 'r',
    roundName: 'Ronde longue',
    siteName: 'Site de la dernière ronde au nom particulièrement long',
    status: 'FINISHED',
    finalStatus: 'INCOMPLETE',
    plannedStartAt: at,
    startedAt: at,
    finishedAt: at,
    progress: {validated: 2, total: 5},
    outOfOrderCount: 1,
  },
};
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});
it.each([
  [320, 1],
  [360, 2],
  [320, 2.2],
])(
  'keeps content and activation accessible at width %s with font scale %s',
  (width, scale) => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
    const press = jest.fn();
    const view = render(
      <View style={{width}}>
        <AgentCard
          agent={agent}
          receivedAt={1000}
          nowElapsed={1000}
          gps="OLD"
          onPress={press}
        />
      </View>,
    );
    const site = view.getByLabelText(
      `Site de la dernière ronde : ${agent.lastRound!.siteName}`,
    );
    expect(site.props.numberOfLines).toBe(1);
    expect(site.props.ellipsizeMode).toBe('tail');
    expect(view.getByText(agent.name)).toBeTruthy();
    expect(view.getByText('Incomplète')).toBeTruthy();
    expect(view.getByText('2/5 points · 1 hors ordre')).toBeTruthy();
    expect(view.getByText('GPS · Position ancienne')).toBeTruthy();
    expect(view.getByText('70 %')).toBeTruthy();
    for (const text of view.UNSAFE_getAllByType(Text)) {
      expect(text.props.allowFontScaling).not.toBe(false);
    }
    fireEvent.press(view.getByRole('button'));
    expect(press).toHaveBeenCalledTimes(1);
    expect(view.queryByText(/En ligne|4G|5G|terminées\/prévues/)).toBeNull();
  },
);
it('uses the API classification in dense mode and keeps old devices distinct', () => {
  const view = render(
    <BatteryDevices
      compact
      dense
      receivedAt={1000}
      nowElapsed={1000}
      devices={[
        phone,
        {
          ...phone,
          id: 'phone-b',
          batteryLevel: 8,
          stale: true,
          levelClassification: 'CRITICAL',
        },
      ]}
    />,
  );
  const a = within(view.getByLabelText('Appareil phone-a'));
  expect(StyleSheet.flatten(a.getByText('70 %').props.style).color).toBe(
    colors.warning,
  );
  const b = within(view.getByLabelText('Appareil phone-b'));
  expect(b.getByText('8 % · ancienne')).toBeTruthy();
  expect(
    b.getByLabelText('Dernier niveau : 8 %. Mesure ancienne'),
  ).toBeTruthy();
  expect(
    StyleSheet.flatten(b.getByText('8 % · ancienne').props.style).color,
  ).toBe(colors.muted);
});
it('does not confuse missing battery/GPS or missing round context with phone presence', () => {
  const view = render(
    <AgentCard
      agent={{...agent, batteryDevices: [], lastRound: null}}
      nowElapsed={1000}
      gps="UNAVAILABLE"
      onPress={() => {}}
    />,
  );
  expect(view.getByLabelText('Batterie indisponible')).toBeTruthy();
  expect(view.getByText('GPS · Position indisponible')).toBeTruthy();
  expect(view.getByText('Aucune ronde sur cette période.')).toBeTruthy();
  expect(view.queryByText('0 %')).toBeNull();
  expect(view.queryByText(/déconnecté|En ligne/)).toBeNull();
});
it('identifies unknown freshness and does not treat an unavailable measurement as zero', () => {
  const view = render(
    <BatteryDevices
      compact
      dense
      devices={[
        {...phone, id: 'phone-unknown', evaluatedAt: undefined},
        {
          ...phone,
          id: 'phone-empty',
          batteryLevel: null,
          batteryQuality: 'UNAVAILABLE',
        },
      ]}
      receivedAt={1000}
      nowElapsed={1000}
    />,
  );
  expect(
    within(view.getByLabelText('Appareil phone-unknown')).getByText(
      '70 % · âge inconnu',
    ),
  ).toBeTruthy();
  expect(
    within(view.getByLabelText('Appareil phone-empty')).getByText(
      'Indisponible',
    ),
  ).toBeTruthy();
  expect(view.queryByText('0 %')).toBeNull();
});
