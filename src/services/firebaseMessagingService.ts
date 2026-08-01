import { PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { QueryClient } from '@tanstack/react-query';
import { registerDevice } from './mobileDevicesApi';
import { shouldHandleEvent } from './eventDedup';
import { useAuthStore } from '../stores/authStore';

export async function setupFirebaseMessaging(queryClient: QueryClient): Promise<() => void> {
  await requestNotificationPermission();
  await registerCurrentFcmToken();

  const unsubscribeToken = messaging().onTokenRefresh((token) => {
    registerDevice(token).catch(() => undefined);
  });
  const unsubscribeMessage = messaging().onMessage(async (message) => {
    const eventId = message.data?.eventId;
    const type = message.data?.type;
    if (shouldHandleEvent(String(type), eventId ? String(eventId) : undefined)) {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rounds'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });
    }
  });

  messaging().setBackgroundMessageHandler(async () => undefined);
  const opened = await messaging().getInitialNotification();
  handleNotificationOpen(opened?.data);
  const unsubscribeOpen = messaging().onNotificationOpenedApp((message) => handleNotificationOpen(message.data));

  return () => {
    unsubscribeToken();
    unsubscribeMessage();
    unsubscribeOpen();
  };
}

async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return;
  }

  await messaging().requestPermission();
}

async function registerCurrentFcmToken(): Promise<void> {
  const token = await messaging().getToken();
  if (token) {
    await registerDevice(token);
  }
}

function handleNotificationOpen(data: Record<string, string | object> | undefined): void {
  const scheduledRoundId = typeof data?.scheduledRoundId === 'string' ? data.scheduledRoundId : null;
  if (scheduledRoundId) {
    useAuthStore.getState().setPendingRoundId(scheduledRoundId);
  }
}
