import React from 'react';
import { Text } from 'react-native';
import renderer from 'react-test-renderer';
import { RoundCard } from '../src/components/RoundCard';
import { colors } from '../src/theme/colors';
import type { RoundItem } from '../src/types/api';

const round = {
  id: 'round-1',
  status: 'LATE',
  plannedStartAt: '2026-07-28T10:00:00.000Z',
  round: { name: 'Ronde principale' },
  site: { name: 'Site central' },
  agent: null,
  progress: { validated: 1, total: 3 },
  outOfOrderCount: 0,
} as RoundItem;

describe('RoundCard', () => {
  it.each([['MISSED', 'Manquée'], ['INCOMPLETE', 'Incomplète'], ['COMPLETED', 'Terminée']] as const)('shows the server final result %s', (finalStatus, label) => {
    const tree = renderer.create(<RoundCard round={{ ...round, status: 'FINISHED', finalStatus }} onPress={jest.fn()} />);
    expect(JSON.stringify(tree.toJSON())).toContain(label);
    tree.unmount();
  });
  it.each(['2026-09-19', '2026-09-20', '2026-09-21'])('shows the civil date and 23h on %s', day => {
    const tree = renderer.create(<RoundCard round={{
      ...round, plannedStartAt: day + 'T23:00:00Z',
    }} onPress={jest.fn()} />);
    expect(JSON.stringify(tree.toJSON())).toContain(day.slice(8) + '/09 23:00');
    tree.unmount();
  });
  it('uses the raw status for the color and the French label for display', () => {
    const tree = renderer.create(<RoundCard round={round} onPress={jest.fn()} />);
    const status = tree.root.findAllByType(Text).find((node) => node.props.children === 'En retard');

    expect(status).toBeDefined();
    expect(status?.props.style).toContainEqual({ color: colors.warning });
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'LATE')).toBe(false);
  });
});
