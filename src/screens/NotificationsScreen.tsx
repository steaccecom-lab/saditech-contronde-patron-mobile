import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getNotifications, markAllNotificationsRead, setNotificationRead } from '../services/notificationsApi';
import type { RootStackParamList } from '../types/navigation';
import type { NotificationItem } from '../types/api';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { colors } from '../theme/colors';
import { formatDateTime } from '../utils/format';

export function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const client = useQueryClient();
  const query = useInfiniteQuery({ queryKey: ['notifications'], queryFn: ({ pageParam = 1 }) => getNotifications(pageParam), initialPageParam: 1, getNextPageParam: (last) => last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined });
  const invalidate = () => { client.invalidateQueries({ queryKey: ['notifications'] }); client.invalidateQueries({ queryKey: ['notificationUnreadCount'] }); };
  const read = useMutation({ mutationFn: setNotificationRead, onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const open = (item: NotificationItem) => {
    if (!item.readAt) {
      read.mutate({ id: item.id, read: true });
    }
    if (item.scheduledRoundId) {
      navigation.navigate('RoundDetail', { id: item.scheduledRoundId });
    }
  };
  if (query.isLoading) {
    return <LoadingView label="Chargement des notifications..." />;
  }
  if (query.isError) {
    return <ErrorView label={query.error instanceof Error ? query.error.message : 'Notifications indisponibles.'} onRetry={query.refetch} />;
  }
  return <View style={styles.container}>
    <View style={styles.header}><Text style={styles.title}>Notifications</Text><TouchableOpacity accessibilityRole="button" disabled={!items.some((item) => !item.readAt) || readAll.isPending} onPress={() => readAll.mutate()}><Text style={styles.action}>Tout marquer comme lu</Text></TouchableOpacity></View>
    <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />} onEndReached={() => query.hasNextPage && query.fetchNextPage()} ListEmptyComponent={<EmptyView label="Aucune notification." />} renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${item.readAt ? 'Lue' : 'Non lue'} : ${item.title}`} style={[styles.card, !item.readAt && styles.unread]} onPress={() => open(item)}><View style={styles.row}><Text style={styles.itemTitle}>{item.title}</Text>{!item.readAt ? <View accessibilityLabel="Non lue" style={styles.dot} /> : null}</View><Text style={styles.message}>{item.message}</Text><View style={styles.row}><Text style={styles.date}>{formatDateTime(item.createdAt)}</Text><TouchableOpacity accessibilityRole="button" onPress={() => read.mutate({ id: item.id, read: !item.readAt })}><Text style={styles.action}>{item.readAt ? 'Marquer non lue' : 'Marquer lue'}</Text></TouchableOpacity></View></TouchableOpacity>} />
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background, paddingTop: 16 }, header: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, title: { fontSize: 25, fontWeight: '900', color: colors.text }, action: { color: colors.primary, fontWeight: '800' }, list: { padding: 16 }, card: { padding: 14, marginBottom: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface }, unread: { borderLeftWidth: 5, borderLeftColor: colors.primary }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, itemTitle: { color: colors.text, fontSize: 16, fontWeight: '900' }, dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary }, message: { color: colors.text, marginTop: 6 }, date: { color: colors.muted, marginTop: 7, fontSize: 12 } });
