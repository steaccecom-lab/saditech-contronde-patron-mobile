import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { getRounds } from '../services/patronApi';
import type { PeriodFilter } from '../types/api';
import type { RootStackParamList } from '../types/navigation';
import { RoundCard } from '../components/RoundCard';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { colors } from '../theme/colors';

const filters: Array<{ label: string; period?: PeriodFilter; status?: string }> = [
  { label: "Aujourd'hui", period: 'today' },
  { label: '7 jours', period: '7d' },
  { label: '30 jours', period: '30d' },
  { label: 'Terminées', status: 'FINISHED' },
  { label: 'Retard/manquées', status: 'LATE' },
];

export function RoundsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selected, setSelected] = useState(0);
  const filter = filters[selected];
  const query = useInfiniteQuery({
    queryKey: ['rounds', filter],
    queryFn: ({ pageParam = 1 }) => getRounds({ page: pageParam, limit: 20, period: filter.period, status: filter.status as never }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages ? lastPage.pagination.page + 1 : undefined,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isLoading) {
    return <LoadingView />;
  }

  if (query.isError) {
    return <ErrorView label="Impossible de charger les rondes." onRetry={query.refetch} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rondes</Text>
      <View style={styles.filters}>
        {filters.map((item, index) => (
          <TouchableOpacity key={item.label} style={[styles.filter, selected === index && styles.filterActive]} onPress={() => setSelected(index)}>
            <Text style={[styles.filterText, selected === index && styles.filterTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />}
        onEndReached={() => query.hasNextPage && query.fetchNextPage()}
        ListEmptyComponent={<EmptyView label="Aucune ronde sur cette période." />}
        renderItem={({ item }) => <RoundCard round={item} onPress={() => navigation.navigate('RoundDetail', { id: item.id })} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 16 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, paddingHorizontal: 16, marginBottom: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  filter: { minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.surface },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.text, fontWeight: '700' },
  filterTextActive: { color: colors.surface },
  list: { padding: 16 },
});
