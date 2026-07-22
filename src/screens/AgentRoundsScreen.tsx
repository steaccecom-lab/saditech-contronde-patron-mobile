import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAgentRounds } from '../services/patronApi';
import type { RootStackParamList } from '../types/navigation';
import { RoundCard } from '../components/RoundCard';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { colors } from '../theme/colors';

export function AgentRoundsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'AgentRounds'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const query = useInfiniteQuery({
    queryKey: ['agentRounds', route.params.agentId],
    queryFn: ({ pageParam = 1 }) => getAgentRounds(route.params.agentId, { page: pageParam, limit: 20, period: '7d' }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.pagination.page < lastPage.pagination.totalPages ? lastPage.pagination.page + 1 : undefined,
  });
  const rounds = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isLoading) {
    return <LoadingView />;
  }
  if (query.isError) {
    return <ErrorView label="Historique inaccessible." onRetry={query.refetch} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{route.params.agentName}</Text>
      <FlatList
        data={rounds}
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
  title: { fontSize: 26, fontWeight: '900', color: colors.text, paddingHorizontal: 16, marginBottom: 12 },
  list: { padding: 16 },
});
