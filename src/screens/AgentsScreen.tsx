import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAgents } from '../services/patronApi';
import type { RootStackParamList } from '../types/navigation';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { colors } from '../theme/colors';
import { formatDateTime, statusLabel } from '../utils/format';

export function AgentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [search, setSearch] = useState('');
  const query = useInfiniteQuery({
    queryKey: ['agents', search],
    queryFn: ({ pageParam = 1 }) => getAgents({ page: pageParam, limit: 20, period: '7d', search: search || undefined }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.pagination.page < lastPage.pagination.totalPages ? lastPage.pagination.page + 1 : undefined,
  });
  const agents = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isLoading) {
    return <LoadingView />;
  }
  if (query.isError) {
    return <ErrorView label="Impossible de charger les agents." onRetry={query.refetch} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Agents</Text>
      <TextInput placeholder="Recherche par nom" value={search} onChangeText={setSearch} style={styles.search} />
      <FlatList
        data={agents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />}
        onEndReached={() => query.hasNextPage && query.fetchNextPage()}
        ListEmptyComponent={<EmptyView label="Aucune ronde sur cette période." />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('AgentRounds', { agentId: item.id, agentName: item.name })}>
            <Text style={styles.name}>{item.name}</Text>
            {item.lastRound ? (
              <>
                <Text style={styles.meta}>{item.lastRound.roundName} · {item.lastRound.siteName}</Text>
                <Text style={styles.meta}>{formatDateTime(item.lastRound.plannedStartAt)} · {statusLabel(item.lastRound.status)}</Text>
                <Text style={styles.progress}>{item.lastRound.progress.validated}/{item.lastRound.progress.total} points{item.lastRound.outOfOrderCount ? ` · ${item.lastRound.outOfOrderCount} hors ordre` : ''}</Text>
              </>
            ) : (
              <Text style={styles.meta}>Aucune ronde sur cette période.</Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 16 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, paddingHorizontal: 16, marginBottom: 12 },
  search: { minHeight: 48, marginHorizontal: 16, marginBottom: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, fontSize: 16 },
  list: { padding: 16 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 10 },
  name: { color: colors.text, fontSize: 17, fontWeight: '900' },
  meta: { color: colors.muted, marginTop: 5 },
  progress: { color: colors.text, marginTop: 8, fontWeight: '800' },
});
