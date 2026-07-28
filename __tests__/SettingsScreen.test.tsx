import React from 'react';
import renderer, { act, ReactTestInstance } from 'react-test-renderer';
import { SettingsScreen } from '../src/screens/SettingsScreen';

const mockMutate = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ clear: jest.fn(), invalidateQueries: jest.fn() }),
  useQuery: () => ({
    data: { scanNotificationMode: 'ALL_SCANS' },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useMutation: () => ({ mutate: mockMutate }),
}));

jest.mock('../src/stores/authStore', () => ({
  useAuthStore: () => 'refresh-token',
}));

function pressableAncestor(node: ReactTestInstance): ReactTestInstance {
  let current: ReactTestInstance | null = node;
  while (current && typeof current.props.onPress !== 'function') {
    current = current.parent;
  }
  if (!current) {
    throw new Error('Pressable ancestor not found');
  }
  return current;
}

describe('SettingsScreen', () => {
  it('displays French labels but submits raw notification modes', () => {
    const tree = renderer.create(<SettingsScreen />);
    const allScans = tree.root.findByProps({ children: 'Tous les scans' });
    const outOfOrderOnly = tree.root.findByProps({ children: 'Seulement les scans hors ordre' });
    const disabled = tree.root.findByProps({ children: 'Notifications désactivées' });

    act(() => pressableAncestor(allScans).props.onPress());
    act(() => pressableAncestor(outOfOrderOnly).props.onPress());
    act(() => pressableAncestor(disabled).props.onPress());

    expect(mockMutate.mock.calls).toEqual([
      ['ALL_SCANS'],
      ['OUT_OF_ORDER_ONLY'],
      ['DISABLED'],
    ]);
  });
});
