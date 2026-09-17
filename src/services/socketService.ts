import {io, Socket} from 'socket.io-client';
import type {QueryClient} from '@tanstack/react-query';
import {env} from '../config/env';
import {useAuthStore} from '../stores/authStore';
import type {PatronScanActivity} from '../types/api';
import {shouldHandleEvent} from './eventDedup';

let socket: Socket | null = null;
let unsubscribeAuth: (() => void) | undefined;
let gpsRefreshTimer: ReturnType<typeof setTimeout> | undefined;

export function connectSocket(queryClient: QueryClient): void {
  const token = useAuthStore.getState().accessToken;
  if (!token || socket) {
    return;
  }

  socket = io(env.SOCKET_URL, {
    transports: ['websocket'],
    auth: callback => callback({token: useAuthStore.getState().accessToken}),
  });
  const invalidateGps = () => {
    if (gpsRefreshTimer) {
      return;
    }
    gpsRefreshTimer = setTimeout(() => {
      gpsRefreshTimer = undefined;
      queryClient
        .invalidateQueries({queryKey: ['liveGps']}, {cancelRefetch: false})
        .catch(() => undefined);
    }, 1000);
  };
  socket.on('agent.location.updated', invalidateGps);
  socket.on('connect', invalidateGps);
  socket.on('round.started', invalidateGps);
  socket.on('round.scan.created', invalidateGps);
  socket.on('round.finished', invalidateGps);
  socket.on('disconnect', reason => {
    if (
      reason === 'io server disconnect' &&
      useAuthStore.getState().accessToken
    ) {
      socket?.connect();
    }
  });
  unsubscribeAuth = useAuthStore.subscribe((state, previous) => {
    if (
      state.user?.id !== previous.user?.id ||
      state.user?.companyId !== previous.user?.companyId
    ) {
      queryClient.cancelQueries({queryKey: ['liveGps']}).catch(() => undefined);
      queryClient.removeQueries({queryKey: ['liveGps']});
      disconnectSocket();
    } else if (
      state.accessToken !== previous.accessToken &&
      state.accessToken
    ) {
      socket?.disconnect();
      socket?.connect();
    }
  });

  socket.on('patron.scan.created', (payload: PatronScanActivity) => {
    if (!shouldHandleEvent(payload.eventType, payload.eventId)) {
      return;
    }
    invalidateGps();
    queryClient.setQueryData(['dashboard'], (current: unknown) => {
      const dashboard = current as
        | {liveActivity?: PatronScanActivity[]}
        | undefined;
      if (!dashboard?.liveActivity) {
        return current;
      }
      return {
        ...dashboard,
        liveActivity: [
          payload,
          ...dashboard.liveActivity.filter(
            item => item.scanId !== payload.scanId,
          ),
        ].slice(0, 50),
      };
    });
    queryClient.invalidateQueries({queryKey: ['dashboard']});
    queryClient.invalidateQueries({queryKey: ['rounds']});
    queryClient.invalidateQueries({queryKey: ['agents']});
    queryClient.invalidateQueries({queryKey: ['notifications']});
    queryClient.invalidateQueries({queryKey: ['notificationUnreadCount']});
    if (payload.scheduledRoundId) {
      queryClient.invalidateQueries({
        queryKey: ['roundDetail', payload.scheduledRoundId],
      });
    }
  });

  const invalidateRounds = (payload: {
    eventType?: string;
    eventId?: string;
    scheduledRoundId?: string;
  }) => {
    if (!shouldHandleEvent(payload.eventType, payload.eventId)) {
      return;
    }
    invalidateGps();
    queryClient.invalidateQueries({queryKey: ['dashboard']});
    queryClient.invalidateQueries({queryKey: ['rounds']});
    queryClient.invalidateQueries({queryKey: ['agents']});
    queryClient.invalidateQueries({queryKey: ['notifications']});
    queryClient.invalidateQueries({queryKey: ['notificationUnreadCount']});
    if (payload.scheduledRoundId) {
      queryClient.invalidateQueries({
        queryKey: ['roundDetail', payload.scheduledRoundId],
      });
    }
  };

  socket.on('patron.round.finished', invalidateRounds);
  socket.on('patron.round.late', invalidateRounds);
  socket.on('patron.round.missed', invalidateRounds);
}

export function disconnectSocket(): void {
  if (gpsRefreshTimer) {
    clearTimeout(gpsRefreshTimer);
  }
  gpsRefreshTimer = undefined;
  unsubscribeAuth?.();
  unsubscribeAuth = undefined;
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
