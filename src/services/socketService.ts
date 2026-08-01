import { io, Socket } from 'socket.io-client';
import type { QueryClient } from '@tanstack/react-query';
import { env } from '../config/env';
import { useAuthStore } from '../stores/authStore';
import type { PatronScanActivity } from '../types/api';
import { shouldHandleEvent } from './eventDedup';

let socket: Socket | null = null;

export function connectSocket(queryClient: QueryClient): void {
  const token = useAuthStore.getState().accessToken;
  if (!token || socket?.connected) {
    return;
  }

  socket = io(env.SOCKET_URL, {
    transports: ['websocket'],
    auth: { token },
  });

  socket.on('patron.scan.created', (payload: PatronScanActivity) => {
    if (!shouldHandleEvent(payload.eventType, payload.eventId)) {
      return;
    }
    queryClient.setQueryData(['dashboard'], (current: unknown) => {
      const dashboard = current as { liveActivity?: PatronScanActivity[] } | undefined;
      if (!dashboard?.liveActivity) {
        return current;
      }
      return {
        ...dashboard,
        liveActivity: [payload, ...dashboard.liveActivity.filter((item) => item.scanId !== payload.scanId)].slice(0, 50),
      };
    });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['rounds'] });
    queryClient.invalidateQueries({ queryKey: ['agents'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });
    if (payload.scheduledRoundId) {
      queryClient.invalidateQueries({ queryKey: ['roundDetail', payload.scheduledRoundId] });
    }
  });

  const invalidateRounds = (payload: { eventType?: string; eventId?: string; scheduledRoundId?: string }) => {
    if (!shouldHandleEvent(payload.eventType, payload.eventId)) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['rounds'] });
    queryClient.invalidateQueries({ queryKey: ['agents'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });
    if (payload.scheduledRoundId) {
      queryClient.invalidateQueries({ queryKey: ['roundDetail', payload.scheduledRoundId] });
    }
  };

  socket.on('patron.round.finished', invalidateRounds);
  socket.on('patron.round.late', invalidateRounds);
  socket.on('patron.round.missed', invalidateRounds);
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
