import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import {RoundsListCard} from '../src/components/RoundsListCard';
import type {RoundItem} from '../src/types/api';
import {colors} from '../src/theme/colors';

const round: RoundItem = {
  id: 'r1',
  status: 'PLANNED',
  plannedStartAt: '2026-11-02T23:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  progress: {validated: 1, total: 4},
  outOfOrderCount: 0,
  missedCheckpointCount: 0,
  agent: null,
  site: {id: 's1', name: 'Site Central'},
  round: {id: 't1', name: 'Ronde de nuit'},
};

it.each([
  ['PLANNED', 'En attente', colors.navy],
  ['STARTED', 'En cours', colors.primary],
  ['FINISHED', 'Terminée', colors.success],
  ['LATE', 'En retard', colors.warning],
  ['MISSED', 'Manquée', colors.danger],
] as const)(
  'displays server status %s without recalculating deadlines',
  (status, label, color) => {
    const view = render(
      <RoundsListCard
        round={{...round, status, plannedStartAt: '2020-01-01T01:00:00Z'}}
        onPress={jest.fn()}
      />,
    );
    expect(StyleSheet.flatten(view.getByText(label).props.style).color).toBe(
      color,
    );
  },
);
it.each([
  ['INCOMPLETE', 'Incomplète', colors.warning],
  ['MISSED', 'Manquée', colors.danger],
  ['COMPLETED', 'Terminée', colors.success],
] as const)(
  'preserves final classification %s and automatic closure',
  (finalStatus, label, color) => {
    const view = render(
      <RoundsListCard
        round={{
          ...round,
          status: 'FINISHED',
          finalStatus,
          autoClosedAt: '2026-11-03T00:00:00Z',
        }}
        onPress={jest.fn()}
      />,
    );
    expect(StyleSheet.flatten(view.getByText(label).props.style).color).toBe(
      color,
    );
    expect(view.getByText('Clôture automatique')).toBeTruthy();
  },
);
it('keeps all card information and detail navigation with an unassigned agent', () => {
  const press = jest.fn();
  const view = render(<RoundsListCard round={round} onPress={press} />);
  for (const label of [
    'Site Central',
    'Agent non assigné',
    'Prévue : 02/11/2026 à 23:00',
    '1/4 points',
  ]) {
    expect(view.getByText(label)).toBeTruthy();
  }
  expect(view.getByRole('progressbar').props.accessibilityValue).toMatchObject({
    now: 25,
    text: '1/4 points',
  });
  fireEvent.press(view.getByRole('button'));
  expect(press).toHaveBeenCalledTimes(1);
});
it.each(['2026-02-15', '2026-03-22', '2026-11-02'])(
  'keeps the encoded civil time at 23h on %s',
  day => {
    const view = render(
      <RoundsListCard
        round={{...round, plannedStartAt: `${day}T23:00:00Z`}}
        onPress={jest.fn()}
      />,
    );
    expect(view.getByText(new RegExp('23:00'))).toBeTruthy();
  },
);
it('does not invent a planned time or progress for absent data', () => {
  const view = render(
    <RoundsListCard
      round={
        {
          ...round,
          plannedStartAt: undefined,
          progress: undefined,
        } as unknown as RoundItem
      }
      onPress={jest.fn()}
    />,
  );
  expect(view.getByText('Prévue : Horaire indisponible')).toBeTruthy();
  expect(view.getByText('Progression indisponible')).toBeTruthy();
  expect(
    view.getByRole('progressbar').props.accessibilityValue,
  ).not.toHaveProperty('now');
});
it('keeps steps, checkpoint anomalies and measured-zero warnings', () => {
  const view = render(
    <RoundsListCard
      round={{
        ...round,
        status: 'FINISHED',
        stepCount: 0,
        stepTrackingStatus: 'AVAILABLE',
        outOfOrderCount: 1,
        missedCheckpointCount: 2,
      }}
      onPress={jest.fn()}
    />,
  );
  expect(view.getByText('1 hors ordre')).toBeTruthy();
  expect(view.getByText('2 points manqués')).toBeTruthy();
  expect(
    StyleSheet.flatten(
      view.getByText('0 pas — Aucun pas détecté !').props.style,
    ).color,
  ).toBe(colors.danger);
});
it.each(['PARTIAL', 'DENIED', 'UNAVAILABLE'])(
  'keeps unmeasured steps %s neutral',
  status => {
    const view = render(
      <RoundsListCard
        round={{
          ...round,
          status: 'FINISHED',
          stepCount: 0,
          stepTrackingStatus: status,
        }}
        onPress={jest.fn()}
      />,
    );
    expect(view.queryByText('0 pas — Aucun pas détecté !')).toBeNull();
    expect(view.getByText(/Nombre de pas indisponible/)).toBeTruthy();
  },
);
