import {PermissionsAndroid, Platform} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import {QueryClient} from '@tanstack/react-query';
import {registerDevice} from './mobileDevicesApi';
import {shouldHandleEvent} from './eventDedup';
import {useAuthStore} from '../stores/authStore';

export async function setupFirebaseMessaging(
  queryClient: QueryClient,
): Promise<() => void> {
  // Token rotation keeps the same user object. Logout/account replacement does not.
  const owner = useAuthStore.getState().user;
  const isCurrent = () =>
    Boolean(owner) && useAuthStore.getState().user === owner;
  if (!isCurrent()) {
    return () => undefined;
  }
  await requestNotificationPermission();
  if (!isCurrent()) {
    return () => undefined;
  }
  await registerCurrentFcmToken(isCurrent);
  if (!isCurrent()) {
    return () => undefined;
  }

  const unsubscribeToken = messaging().onTokenRefresh(token => {
    if (isCurrent()) {
      registerDevice(token).catch(() => undefined);
    }
  });
  const unsubscribeMessage = messaging().onMessage(async message => {
    if (!isCurrent()) {
      return;
    }
    const eventId = message.data?.eventId;
    const type = message.data?.type;
    if (
      shouldHandleEvent(String(type), eventId ? String(eventId) : undefined)
    ) {
      if (String(type).startsWith('patron.battery.')) {
        queryClient.invalidateQueries({queryKey: ['agents']});
        queryClient.invalidateQueries({queryKey: ['agentRounds']});
      }
      queryClient.invalidateQueries({queryKey: ['dashboard']});
      queryClient.invalidateQueries({queryKey: ['rounds']});
      queryClient.invalidateQueries({queryKey: ['notifications']});
      queryClient.invalidateQueries({queryKey: ['notificationUnreadCount']});
    }
  });

  messaging().setBackgroundMessageHandler(async () => undefined);
  const opened = await messaging().getInitialNotification();
  if (isCurrent()) {
    handleNotificationOpen(opened?.data);
  }
  const unsubscribeOpen = messaging().onNotificationOpenedApp(message => {
    if (isCurrent()) {
      handleNotificationOpen(message.data);
    }
  });

  return () => {
    unsubscribeToken();
    unsubscribeMessage();
    unsubscribeOpen();
  };
}

async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return;
  }

  await messaging().requestPermission();
}

async function registerCurrentFcmToken(
  isCurrent: () => boolean,
): Promise<void> {
  const token = await messaging().getToken();
  if (token && isCurrent()) {
    await registerDevice(token);
  }
}

function handleNotificationOpen(
  data: Record<string, string | object> | undefined,
): void {
  const scheduledRoundId =
    typeof data?.scheduledRoundId === 'string' ? data.scheduledRoundId : null;
  if (scheduledRoundId) {
    useAuthStore.getState().setPendingRoundId(scheduledRoundId);
  }
}
