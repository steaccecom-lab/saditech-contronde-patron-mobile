import React, {useState} from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {isAxiosError} from 'axios';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {getRounds, getSites} from '../services/patronApi';
import type {RoundItem} from '../types/api';
import type {RootStackParamList} from '../types/navigation';
import {RoundCard} from '../components/RoundCard';
import {EmptyView, ErrorView, LoadingView} from '../components/StateViews';
import {colors} from '../theme/colors';
import {useAuthStore} from '../stores/authStore';
import {
  roundsQueryKey,
  supervisorSitesQueryKey,
  type RoundFilter,
} from '../query/roundsQuery';

const filters: RoundFilter[] = [
  {label: "Aujourd'hui", period: 'today'},
  {label: '7 jours', period: '7d'},
  {label: '30 jours', period: '30d'},
  {label: 'Terminées', status: 'FINISHED'},
  {label: 'Retard/manquées', status: 'LATE'},
];

export function RoundsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore(state => state.user);
  const [selected, setSelected] = useState(0);
  const filter = filters[selected];
  const isSupervisor = user?.roleType === 'SUPERVISOR';
  const sitesQuery = useQuery({
    queryKey: user
      ? supervisorSitesQueryKey(user)
      : ['sites', 'anonymous'],
    queryFn: getSites,
    enabled: Boolean(user && isSupervisor),
  });
  const hasSupervisorScope = !isSupervisor || Boolean(sitesQuery.data?.length);
  const roundsQuery = useInfiniteQuery({
    queryKey: user
      ? roundsQueryKey(user, filter)
      : ['rounds', 'anonymous'],
    queryFn: ({pageParam = 1}) =>
      getRounds({
        page: pageParam,
        limit: 20,
        period: filter.period,
        status: filter.status as never,
      }),
    initialPageParam: 1,
    enabled: Boolean(
      user && (!isSupervisor || (sitesQuery.isSuccess && hasSupervisorScope)),
    ),
    getNextPageParam: lastPage =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
  });
  const items = uniqueRounds(
    roundsQuery.data?.pages.flatMap(page => page.items) ?? [],
  );

  const refresh = () => {
    if (isSupervisor) {
      sitesQuery.refetch().catch(() => undefined);
    }
    if (hasSupervisorScope) {
      roundsQuery.refetch().catch(() => undefined);
    }
  };

  if (
    (isSupervisor && sitesQuery.isPending) ||
    (hasSupervisorScope && roundsQuery.isPending)
  ) {
    return <LoadingView label="Chargement des rondes" />;
  }

  const error = sitesQuery.error ?? roundsQuery.error;
  if (error) {
    return <ErrorView label={roundsErrorMessage(error)} onRetry={refresh} />;
  }

  if (isSupervisor && !hasSupervisorScope) {
    return (
      <EmptyView
        label="Aucun site ne vous est actuellement affecté. Contactez votre administrateur."
        onRefresh={refresh}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rondes</Text>
      <View style={styles.filters}>
        {filters.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[
              styles.filter,
              selected === index && styles.filterActive,
            ]}
            onPress={() => setSelected(index)}>
            <Text
              style={[
                styles.filterText,
                selected === index && styles.filterTextActive,
              ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={roundsQuery.isRefetching}
            onRefresh={refresh}
          />
        }
        onEndReached={() =>
          roundsQuery.hasNextPage && roundsQuery.fetchNextPage()
        }
        ListEmptyComponent={
          <EmptyView
            label={
              isSupervisor
                ? 'Aucune ronde disponible pour votre périmètre.'
                : 'Aucune ronde pour cette période.'
            }
            onRefresh={refresh}
          />
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

function uniqueRounds(items: RoundItem[]): RoundItem[] {
  return [...new Map(items.map(item => [item.id, item])).values()];
}

function roundsErrorMessage(error: unknown): string {
  if (isAxiosError(error) && error.response?.status === 403) {
    return "Vous n'avez pas l'autorisation de consulter ces rondes.";
  }

  return error instanceof Error
    ? error.message
    : 'Impossible de charger les rondes.';
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, paddingTop: 16},
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filter: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  filterActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  filterText: {color: colors.text, fontWeight: '700'},
  filterTextActive: {color: colors.surface},
  list: {flexGrow: 1, padding: 16},
});
