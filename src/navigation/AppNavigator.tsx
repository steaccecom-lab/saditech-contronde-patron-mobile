import React, {useCallback, useEffect} from 'react';
import {AppState} from 'react-native';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useQueryClient} from '@tanstack/react-query';
import {HomeScreen} from '../screens/HomeScreen';
import {RoundsScreen} from '../screens/RoundsScreen';
import {AgentsScreen} from '../screens/AgentsScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {SignInScreen} from '../screens/SignInScreen';
import {RoundDetailScreen} from '../screens/RoundDetailScreen';
import {AgentRoundsScreen} from '../screens/AgentRoundsScreen';
import type {MainTabParamList, RootStackParamList} from '../types/navigation';
import {colors} from '../theme/colors';
import {useAuthStore} from '../stores/authStore';
import {connectSocket, disconnectSocket} from '../services/socketService';
import {setupFirebaseMessaging} from '../services/firebaseMessagingService';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  AgentsIcon,
  HomeIcon,
  RoundsIcon,
  SettingsIcon,
} from '../components/NavigationIcon';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(8, insets.bottom);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        tabBarActiveBackgroundColor: colors.primarySoft,
        tabBarItemStyle: {borderRadius: 14, marginHorizontal: 2, marginTop: 4},
        tabBarLabelStyle: {fontSize: 11, fontWeight: '700', marginBottom: 4},
        tabBarLabelPosition: 'below-icon',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 60 + bottom,
          paddingBottom: bottom,
          paddingTop: 2,
          paddingHorizontal: 6,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{title: 'Accueil', tabBarIcon: HomeIcon}}
      />
      <Tab.Screen
        name="Rounds"
        component={RoundsScreen}
        options={{title: 'Rondes', tabBarIcon: RoundsIcon}}
      />
      <Tab.Screen
        name="Agents"
        component={AgentsScreen}
        options={{title: 'Agents', tabBarIcon: AgentsIcon}}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{title: 'Paramètres', tabBarIcon: SettingsIcon}}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const user = useAuthStore(state => state.user);
  const pendingRoundId = useAuthStore(state => state.pendingRoundId);
  const setPendingRoundId = useAuthStore(state => state.setPendingRoundId);
  const queryClient = useQueryClient();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    connectSocket(queryClient);
    let cleanup: (() => void) | undefined;
    let disposed = false;
    setupFirebaseMessaging(queryClient)
      .then(unsubscribe => {
        if (disposed) {
          unsubscribe();
        } else {
          cleanup = unsubscribe;
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      cleanup?.();
      disconnectSocket();
    };
  }, [queryClient, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        queryClient
          .invalidateQueries({queryKey: ['liveGps']}, {cancelRefetch: false})
          .catch(() => undefined);
        queryClient
          .invalidateQueries({queryKey: ['dashboard']})
          .catch(() => undefined);
        queryClient
          .invalidateQueries({queryKey: ['rounds']})
          .catch(() => undefined);
        queryClient
          .invalidateQueries({queryKey: ['agents']})
          .catch(() => undefined);
        queryClient
          .invalidateQueries({queryKey: ['notifications']})
          .catch(() => undefined);
        queryClient
          .invalidateQueries({queryKey: ['notificationUnreadCount']})
          .catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [queryClient, user]);

  const openPendingRound = useCallback(() => {
    if (user && pendingRoundId && navigationRef.isReady()) {
      navigationRef.navigate('RoundDetail', {id: pendingRoundId});
      setPendingRoundId(null);
    }
  }, [navigationRef, pendingRoundId, setPendingRoundId, user]);
  useEffect(openPendingRound, [openPendingRound]);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={openPendingRound}
      linking={{
        prefixes: ['controndepatron://'],
        config: {
          screens: {
            RoundDetail: 'rounds/:id',
          },
        },
      }}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {backgroundColor: colors.navy},
          headerTintColor: colors.surface,
          headerTitleStyle: {fontSize: 18, fontWeight: '700'},
          contentStyle: {backgroundColor: colors.background},
        }}>
        {user ? (
          <Stack.Group
            navigationKey={`${user.companyId}:${user.id}:${user.roleType}`}>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RoundDetail"
              component={RoundDetailScreen}
              options={{title: 'Détail ronde'}}
            />
            <Stack.Screen
              name="AgentRounds"
              component={AgentRoundsScreen}
              options={{title: 'Historique agent'}}
            />
          </Stack.Group>
        ) : (
          <Stack.Screen
            name="SignIn"
            component={SignInScreen}
            options={{headerShown: false}}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
