import React from 'react';
import {
  AppState,
  Text,
  TouchableOpacity,
  View,
  type AppStateStatus,
} from 'react-native';
import {act, cleanup, fireEvent, render} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppNavigator} from '../src/navigation/AppNavigator';
import {useAuthStore} from '../src/stores/authStore';
import {connectSocket, disconnectSocket} from '../src/services/socketService';
import {setupFirebaseMessaging} from '../src/services/firebaseMessagingService';
import type {User} from '../src/types/api';
import type {RootStackParamList} from '../src/types/navigation';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native-screens', () => {
  const actual = jest.requireActual('react-native-screens');
  const {View: NativeView} = require('react-native');
  return {
    ...actual,
    Screen: NativeView,
    ScreenContainer: NativeView,
    screensEnabled: () => false,
  };
});
// Use the real StackRouter/state/actions, without native screen animations in Jest.
jest.mock('@react-navigation/native-stack', () => {
  const {StackRouter, useNavigationBuilder, createNavigatorFactory} =
    jest.requireActual('@react-navigation/native');
  function Navigator(props: Record<string, unknown>) {
    const {state, descriptors, NavigationContent} = useNavigationBuilder(
      StackRouter,
      props,
    );
    return (
      <NavigationContent>
        {descriptors[state.routes[state.index].key].render()}
      </NavigationContent>
    );
  }
  return {createNativeStackNavigator: createNavigatorFactory(Navigator)};
});
jest.mock('../src/services/socketService', () => ({
  connectSocket: jest.fn(),
  disconnectSocket: jest.fn(),
}));
jest.mock('../src/services/firebaseMessagingService', () => ({
  setupFirebaseMessaging: jest.fn(),
}));
jest.mock('../src/screens/HomeScreen', () => ({
  HomeScreen: MockHome,
}));
jest.mock('../src/screens/RoundsScreen', () => ({
  RoundsScreen: MockRounds,
}));
jest.mock('../src/screens/SettingsScreen', () => ({
  SettingsScreen: MockSettings,
}));
jest.mock('../src/screens/SignInScreen', () => ({
  SignInScreen: MockSignIn,
}));
jest.mock('../src/screens/AgentsScreen', () => ({
  AgentsScreen: () => <MockAgentRoutes />,
}));
jest.mock('../src/screens/AgentRoundsScreen', () => ({
  AgentRoundsScreen: () => <MockHistoryRoute />,
}));
jest.mock('../src/screens/RoundDetailScreen', () => ({
  RoundDetailScreen: () => <MockDetailRoute />,
}));
function MockHome() {
  return <Text>Accueil existant</Text>;
}
function MockRounds() {
  return <Text>Rondes existantes</Text>;
}
function MockSettings() {
  return <Text>Paramètres existants</Text>;
}
function MockSignIn() {
  return <Text>Connexion existante</Text>;
}
jest.setTimeout(20000);
function MockAgentRoutes() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View>
      <Text>Agents existants</Text>
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('AgentRounds', {agentId: 'a', agentName: 'Alpha'})
        }>
        <Text>Historique Alpha</Text>
      </TouchableOpacity>
    </View>
  );
}
function MockHistoryRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View>
      <Text>Historique existant</Text>
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('RoundDetail', {id: 'round-history'})
        }>
        <Text>Détail depuis historique</Text>
      </TouchableOpacity>
    </View>
  );
}
function MockDetailRoute() {
  const route = useRoute();
  return <Text>Détail {(route.params as {id: string}).id}</Text>;
}
const user: User = {
  id: 'u',
  companyId: 'c',
  fullName: 'Patron',
  email: 'p@example.test',
  roleType: 'COMPANY_ADMIN',
  permissions: ['dashboard.read'],
};
const clients: QueryClient[] = [];
function screen() {
  const client = new QueryClient({
    defaultOptions: {queries: {retry: false, gcTime: 0}},
  });
  clients.push(client);
  return {
    ...render(
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <AppNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>,
    ),
    client,
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    user,
    accessToken: 'fixture-access',
    refreshToken: 'fixture-refresh',
    pendingRoundId: null,
  });
  jest.mocked(setupFirebaseMessaging).mockResolvedValue(jest.fn());
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  useAuthStore.getState().clearSession();
  jest.restoreAllMocks();
});
it('keeps exactly four working tabs and the history/detail stack', async () => {
  const view = screen();
  await view.findByText('Accueil existant');
  expect(view.queryByText('Sites')).toBeNull();
  expect(view.queryByText('Anomalies')).toBeNull();
  fireEvent.press(view.getByText('Rondes'));
  await view.findByText('Rondes existantes');
  fireEvent.press(view.getByText('Paramètres'));
  await view.findByText('Paramètres existants');
  fireEvent.press(view.getByText('Agents'));
  await view.findByText('Agents existants');
  fireEvent.press(view.getByText('Historique Alpha'));
  await view.findByText('Historique existant');
  fireEvent.press(view.getByText('Détail depuis historique'));
  await view.findByText('Détail round-history');
});
it('opens a cold-start pending notification when the navigation container becomes ready', async () => {
  useAuthStore.getState().setPendingRoundId('round-cold');
  const view = screen();
  await view.findByText('Détail round-cold');
  expect(useAuthStore.getState().pendingRoundId).toBeNull();
});
it('opens notifications while already running and clears private history on company change', async () => {
  const view = screen();
  await view.findByText('Accueil existant');
  act(() => useAuthStore.getState().setPendingRoundId('round-push'));
  await view.findByText('Détail round-push');
  act(() =>
    useAuthStore.setState({
      user: {...user, id: 'other', companyId: 'other-company'},
    }),
  );
  await view.findByText('Accueil existant');
  expect(view.queryByText('Détail round-push')).toBeNull();
  act(() => useAuthStore.getState().clearSession());
  await view.findByText('Connexion existante');
});
it('keeps active-state refreshes and cleans up FCM/socket subscriptions', async () => {
  const remove = jest.fn();
  let active!: (state: AppStateStatus) => void;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      active = callback;
      return {remove};
    });
  const unsubscribe = jest.fn();
  jest.mocked(setupFirebaseMessaging).mockResolvedValue(unsubscribe);
  const view = screen();
  await view.findByText('Accueil existant');
  const invalidate = jest
    .spyOn(view.client, 'invalidateQueries')
    .mockResolvedValue();
  act(() => active('active'));
  expect(invalidate).toHaveBeenCalledWith(
    {queryKey: ['liveGps']},
    {cancelRefetch: false},
  );
  for (const prefix of [
    'dashboard',
    'rounds',
    'agents',
    'notifications',
    'notificationUnreadCount',
  ]) {
    expect(invalidate).toHaveBeenCalledWith({queryKey: [prefix]});
  }
  expect(connectSocket).toHaveBeenCalledWith(view.client);
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(disconnectSocket).toHaveBeenCalled();
  expect(remove).toHaveBeenCalled();
});
it('immediately removes a late FCM subscription belonging to an unmounted session', async () => {
  let resolve!: (cleanup: () => void) => void;
  jest.mocked(setupFirebaseMessaging).mockReturnValue(
    new Promise(yes => {
      resolve = yes;
    }),
  );
  const view = screen();
  await view.findByText('Accueil existant');
  view.unmount();
  const unsubscribe = jest.fn();
  await act(async () => resolve(unsubscribe));
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
