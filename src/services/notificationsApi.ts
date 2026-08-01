import { http } from './http';
import type { NotificationsResponse } from '../types/api';

export async function getNotifications(page = 1, limit = 20) {
  return (await http.get<NotificationsResponse>('/notifications', { params: { page, limit } })).data;
}
export async function getUnreadCount() {
  return (await http.get<{ count: number }>('/notifications/unread-count')).data.count;
}
export async function setNotificationRead(input: { id: string; read: boolean }) {
  return (await http.patch(`/notifications/${input.id}/read`, { read: input.read })).data;
}
export async function markAllNotificationsRead() {
  return (await http.patch<{ updated: number }>('/notifications/read-all')).data;
}
