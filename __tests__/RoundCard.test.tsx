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
  it('uses the raw status for the color and the French label for display', () => {
    const tree = renderer.create(<RoundCard round={round} onPress={jest.fn()} />);
    const status = tree.root.findAllByType(Text).find((node) => node.props.children === 'En retard');

    expect(status).toBeDefined();
    expect(status?.props.style).toContainEqual({ color: colors.warning });
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'LATE')).toBe(false);
  });
});
