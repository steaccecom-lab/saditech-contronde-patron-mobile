import React from 'react';
import {Text, StyleSheet} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import renderer from 'react-test-renderer';
import {RoundCard} from '../src/components/RoundCard';
import {colors} from '../src/theme/colors';
import type {RoundItem} from '../src/types/api';

const round = {
  id: 'round-1',
  status: 'LATE',
  plannedStartAt: '2026-07-28T10:00:00.000Z',
  round: {name: 'Ronde principale'},
  site: {name: 'Site central'},
  agent: null,
  progress: {validated: 1, total: 3},
  outOfOrderCount: 0,
} as RoundItem;

describe('RoundCard', () => {
  it.each([
    ['MISSED', 'Manquée'],
    ['INCOMPLETE', 'Incomplète'],
    ['COMPLETED', 'Terminée'],
  ] as const)('shows the server final result %s', (finalStatus, label) => {
    const tree = renderer.create(
      <RoundCard
        round={{...round, status: 'FINISHED', finalStatus}}
        onPress={jest.fn()}
      />,
    );
    expect(JSON.stringify(tree.toJSON())).toContain(label);
    tree.unmount();
  });
  it.each(['2026-09-19', '2026-09-20', '2026-09-21'])(
    'shows the civil date and 23h on %s',
    day => {
      const tree = renderer.create(
        <RoundCard
          round={{
            ...round,
            plannedStartAt: day + 'T23:00:00Z',
          }}
          onPress={jest.fn()}
        />,
      );
      expect(JSON.stringify(tree.toJSON())).toContain(
        day.slice(8) + '/09 23:00',
      );
      tree.unmount();
    },
  );
  it('uses the raw status for the color and the French label for display', () => {
    const tree = renderer.create(
      <RoundCard round={round} onPress={jest.fn()} />,
    );
    const status = tree.root
      .findAllByType(Text)
      .find(node => node.props.children === 'En retard');

    expect(status).toBeDefined();
    expect(status?.props.style).toContainEqual({color: colors.warning});
    expect(
      tree.root
        .findAllByType(Text)
        .some(node => node.props.children === 'LATE'),
    ).toBe(false);
  });
});

describe('finished round steps', () => {
  const finished = {...round, status: 'FINISHED' as const};
  it('shows positive steps alongside progress and retains detail navigation', () => {
    const onPress = jest.fn();
    const view = render(
      <RoundCard
        round={{...finished, stepCount: 245, stepTrackingStatus: 'AVAILABLE'}}
        onPress={onPress}
      />,
    );
    expect(view.getByText('1/3 points')).toBeTruthy();
    expect(view.getByText('· 245 pas')).toBeTruthy();
    fireEvent.press(view.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('shows a red warning only for a fully measured zero', () => {
    const view = render(
      <RoundCard
        round={{...finished, stepCount: 0, stepTrackingStatus: 'AVAILABLE'}}
        onPress={jest.fn()}
      />,
    );
    expect(
      StyleSheet.flatten(
        view.getByText('0 pas — Aucun pas détecté !').props.style,
      ).color,
    ).toBe(colors.danger);
    expect(view.getByText('⚠')).toBeTruthy();
  });
  it.each([
    {},
    {stepCount: null, stepTrackingStatus: 'AVAILABLE'},
    {stepCount: 0, stepTrackingStatus: 'PARTIAL'},
    {stepCount: 120, stepTrackingStatus: 'PARTIAL'},
    {stepCount: 0, stepTrackingStatus: 'UNSUPPORTED'},
    {stepCount: 0, stepTrackingStatus: 'DENIED'},
    {stepCount: 0, stepTrackingStatus: 'UNAVAILABLE'},
    {stepCount: 0, stepTrackingStatus: 'FUTURE_STATUS'},
  ])('keeps an unavailable measurement neutral: %j', capture => {
    const view = render(
      <RoundCard round={{...finished, ...capture}} onPress={jest.fn()} />,
    );
    expect(
      StyleSheet.flatten(
        view.getByText(/Nombre de pas indisponible/).props.style,
      ).color,
    ).toBe(colors.muted);
    expect(view.queryByText('0 pas — Aucun pas détecté !')).toBeNull();
  });
  it.each([
    ['PARTIAL', 'mesure partielle'],
    ['DENIED', 'autorisation refusée'],
    ['UNSUPPORTED', 'capteur non pris en charge'],
  ])(
    'explains reliable unavailability status %s',
    (stepTrackingStatus, reason) => {
      const view = render(
        <RoundCard
          round={{...finished, stepCount: 0, stepTrackingStatus}}
          onPress={jest.fn()}
        />,
      );
      expect(
        view.getByText('Nombre de pas indisponible · ' + reason),
      ).toBeTruthy();
    },
  );
  it.each(['PLANNED', 'STARTED', 'LATE', 'MISSED', 'CANCELLED'] as const)(
    'does not display a step warning for status %s',
    status => {
      const view = render(
        <RoundCard
          round={{
            ...round,
            status,
            stepCount: 0,
            stepTrackingStatus: 'AVAILABLE',
          }}
          onPress={jest.fn()}
        />,
      );
      expect(view.queryByText('0 pas — Aucun pas détecté !')).toBeNull();
      expect(view.queryByText(/Nombre de pas indisponible/)).toBeNull();
    },
  );
});
