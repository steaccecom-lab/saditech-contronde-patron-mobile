import React, { useEffect } from 'react';
import { AppState, Text } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { HomeScreen } from '../screens/HomeScreen';
import { RoundsScreen } from '../screens/RoundsScreen';
import { AgentsScreen } from '../screens/AgentsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { RoundDetailScreen } from '../screens/RoundDetailScreen';
import { AgentRoundsScreen } from '../screens/AgentRoundsScreen';
import type { MainTabParamList, RootStackParamList } from '../types/navigation';
import { colors } from '../theme/colors';
import { useAuthStore } from '../stores/authStore';
import { connectSocket, disconnectSocket } from '../services/socketService';
import { setupFirebaseMessaging } from '../services/firebaseMessagingService';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function DotIcon({ color }: { color: string }) {
  return <Text style={{ color }}>●</Text>;
}

function DiamondIcon({ color }: { color: string }) {
  return <Text style={{ color }}>◆</Text>;
}

function SquareIcon({ color }: { color: string }) {
  return <Text style={{ color }}>■</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarStyle: { minHeight: 62, paddingBottom: 8, paddingTop: 6 },
      }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Accueil', tabBarIcon: DotIcon }} />
      <Tab.Screen name="Rounds" component={RoundsScreen} options={{ title: 'Rondes', tabBarIcon: DiamondIcon }} />
      <Tab.Screen name="Agents" component={AgentsScreen} options={{ title: 'Agents', tabBarIcon: SquareIcon }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Paramètres', tabBarIcon: DotIcon }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const user = useAuthStore((state) => state.user);
  const pendingRoundId = useAuthStore((state) => state.pendingRoundId);
  const setPendingRoundId = useAuthStore((state) => state.setPendingRoundId);
  const queryClient = useQueryClient();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    connectSocket(queryClient);
    let cleanup: (() => void) | undefined;
    setupFirebaseMessaging(queryClient)
      .then((unsubscribe) => {
        cleanup = unsubscribe;
      })
      .catch(() => undefined);

    return () => {
      cleanup?.();
      disconnectSocket();
    };
  }, [queryClient, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        queryClient.invalidateQueries({ queryKey: ['notifications'] }).catch(() => undefined);
        queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] }).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [queryClient, user]);

  useEffect(() => {
    if (user && pendingRoundId && navigationRef.isReady()) {
      navigationRef.navigate('RoundDetail', { id: pendingRoundId });
      setPendingRoundId(null);
    }
  }, [navigationRef, pendingRoundId, setPendingRoundId, user]);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={{
        prefixes: ['controndepatron://'],
        config: {
          screens: {
            RoundDetail: 'rounds/:id',
          },
        },
      }}>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="RoundDetail" component={RoundDetailScreen} options={{ title: 'Détail ronde' }} />
            <Stack.Screen name="AgentRounds" component={AgentRoundsScreen} options={{ title: 'Historique agent' }} />
          </>
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
