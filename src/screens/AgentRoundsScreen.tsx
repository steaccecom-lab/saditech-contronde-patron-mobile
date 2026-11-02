import {BatteryDevices} from '../components/BatteryDevices';
import {useBatteryRefresh} from '../hooks/useBatteryRefresh';
import {useSupervisionClock} from '../hooks/useSupervisionClock';
import {gpsElapsedTime} from '../services/gpsClock';
import {useAuthStore} from '../stores/authStore';
import React from 'react';
import {FlatList, RefreshControl, StyleSheet, Text, View} from 'react-native';
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {useInfiniteQuery} from '@tanstack/react-query';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {getAgentRounds} from '../services/patronApi';
import type {RootStackParamList} from '../types/navigation';
import {RoundCard} from '../components/RoundCard';
import {EmptyView, ErrorView, LoadingView} from '../components/StateViews';
import {colors} from '../theme/colors';

export function AgentRoundsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'AgentRounds'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const batteryRefresh = useBatteryRefresh();
  const user = useAuthStore(state => state.user);
  const clock = useSupervisionClock(!!batteryRefresh);
  const query = useInfiniteQuery({
    refetchInterval: batteryRefresh,
    queryKey: [
      'agentRounds',
      route.params.agentId,
      user?.companyId,
      user?.id,
      user?.roleType,
    ],
    enabled: !!user?.companyId,
    queryFn: ({pageParam = 1, signal}) =>
      getAgentRounds(
        route.params.agentId,
        {
          page: pageParam,
          limit: 20,
          period: '7d',
        },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: lastPage =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
  });
  const rounds = query.data?.pages.flatMap(page => page.items) ?? [];

  if (query.isLoading) {
    return <LoadingView />;
  }
  if (query.isError) {
    return (
      <ErrorView label="Historique inaccessible." onRetry={query.refetch} />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{route.params.agentName}</Text>
      <View style={styles.battery}>
        <BatteryDevices
          devices={query.data?.pages[0]?.batteryDevices}
          receivedAt={query.data?.pages[0]?.receivedAt}
          nowElapsed={Math.max(clock, gpsElapsedTime())}
        />
      </View>
      <FlatList
        data={rounds}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={query.refetch}
          />
        }
        onEndReached={() => query.hasNextPage && query.fetchNextPage()}
        ListEmptyComponent={
          <EmptyView label="Aucune ronde sur cette période." />
        }
        renderItem={({item}) => (
          <RoundCard
            round={item}
            onPress={() => navigation.navigate('RoundDetail', {id: item.id})}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  battery: {paddingHorizontal: 16, paddingBottom: 8},
  container: {flex: 1, backgroundColor: colors.background, paddingTop: 16},
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  list: {padding: 16},
});
