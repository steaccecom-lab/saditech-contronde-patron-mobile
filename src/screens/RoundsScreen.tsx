import React, {useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {isAxiosError} from 'axios';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {getRounds, getSites} from '../services/patronApi';
import type {RoundItem, SiteItem, User} from '../types/api';
import type {RootStackParamList} from '../types/navigation';
import {RoundsListCard} from '../components/RoundsListCard';
import {RoundsFilters} from '../components/RoundsFilters';
import {EmptyView, ErrorView, LoadingView} from '../components/StateViews';
import {colors} from '../theme/colors';
import {useAuthStore} from '../stores/authStore';
import {
  roundsQueryKey,
  supervisorSitesQueryKey,
  type RoundFilter,
} from '../query/roundsQuery';

export function RoundsScreen() {
  const user = useAuthStore(state => state.user);
  if (!user) {
    return <EmptyView label="Connexion requise pour consulter les rondes." />;
  }
  if (
    !user.companyId ||
    !['COMPANY_ADMIN', 'SUPERVISOR'].includes(user.roleType)
  ) {
    return (
      <ErrorView label="Vous n'avez pas l'autorisation de consulter ces rondes." />
    );
  }
  // Recreate filter state on account/company changes. Query caches remain scoped.
  return (
    <RoundsContent
      key={`${user.companyId}:${user.id}:${user.roleType}`}
      user={user}
    />
  );
}

function RoundsContent({user}: {user: User}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [filter, setFilter] = useState<RoundFilter>({period: 'today'});
  const isSupervisor = user.roleType === 'SUPERVISOR';
  const sitesQuery = useQuery<SiteItem[]>({
    queryKey: supervisorSitesQueryKey(user, true),
    // Include accessible inactive sites so a historical round is not hidden.
    queryFn: ({signal}) => getSites({includeInactive: true}, signal),
    retry: false,
  });
  const sites: SiteItem[] = sitesQuery.data ?? [];
  const hasSupervisorScope = !isSupervisor || sites.length > 0;
  const selectedSiteAllowed =
    !filter.siteId ||
    (sitesQuery.isSuccess && sites.some(site => site.id === filter.siteId));
  const canQuery =
    selectedSiteAllowed &&
    (!isSupervisor || (sitesQuery.isSuccess && hasSupervisorScope));
  const roundsQuery = useInfiniteQuery({
    queryKey: roundsQueryKey(
      user,
      filter,
      isSupervisor ? sites.map(site => site.id) : undefined,
    ),
    queryFn: ({pageParam = 1, signal}) =>
      getRounds(
        {
          page: pageParam,
          limit: 20,
          period: filter.period,
          status: filter.status,
          siteId: filter.siteId,
          from: filter.from,
          to: filter.to,
        },
        signal,
      ),
    initialPageParam: 1,
    enabled: canQuery,
    getNextPageParam: lastPage =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
  });
  const forbidden =
    isAxiosError(roundsQuery.error) &&
    [401, 403, 404].includes(roundsQuery.error.response?.status ?? 0);
  const hideRounds = !canQuery || forbidden;
  const items = hideRounds
    ? []
    : uniqueRounds(roundsQuery.data?.pages.flatMap(page => page.items) ?? []);
  const total = hideRounds
    ? undefined
    : roundsQuery.data?.pages[0]?.pagination.total;
  const refresh = () => {
    sitesQuery.refetch().catch(() => undefined);
    if (canQuery) {
      roundsQuery.refetch().catch(() => undefined);
    }
  };
  const loadNext = () => {
    if (
      canQuery &&
      !forbidden &&
      roundsQuery.hasNextPage &&
      !roundsQuery.isFetchingNextPage
    ) {
      roundsQuery.fetchNextPage({cancelRefetch: false}).catch(() => undefined);
    }
  };
  let empty: React.ReactElement;
  if (isSupervisor && sitesQuery.isError) {
    empty = (
      <ErrorView
        label="Impossible de vérifier les sites de votre périmètre."
        onRetry={refresh}
      />
    );
  } else if (isSupervisor && sitesQuery.isPending) {
    empty = <LoadingView label="Chargement des rondes" />;
  } else if (!selectedSiteAllowed) {
    empty = (
      <ErrorView
        label="Ce site n'est plus disponible dans votre périmètre. Choisissez Tous les sites."
        onRetry={refresh}
      />
    );
  } else if (isSupervisor && !hasSupervisorScope) {
    empty = (
      <EmptyView
        label="Aucun site ne vous est actuellement affecté. Contactez votre administrateur."
        onRefresh={refresh}
      />
    );
  } else if (roundsQuery.error) {
    empty = (
      <ErrorView
        label={roundsErrorMessage(roundsQuery.error)}
        onRetry={refresh}
      />
    );
  } else if (roundsQuery.isPending) {
    empty = <LoadingView label="Chargement des rondes" />;
  } else {
    empty = (
      <EmptyView
        label={
          isSupervisor
            ? 'Aucune ronde disponible pour votre périmètre.'
            : 'Aucune ronde pour cette période.'
        }
        onRefresh={refresh}
      />
    );
  }
  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Rondes</Text>
              <Text style={styles.subtitle}>
                Suivez l’avancement des rondes.
              </Text>
            </View>
            <RoundsFilters
              filter={filter}
              onChange={setFilter}
              sites={sites}
              loadingSites={sitesQuery.isPending}
              sitesError={sitesQuery.isError}
              onRetrySites={() => {
                sitesQuery.refetch().catch(() => undefined);
              }}
            />
            <View style={styles.results}>
              <Text style={styles.section}>Vos rondes</Text>
              {total !== undefined && (
                <Text accessibilityLiveRegion="polite" style={styles.count}>
                  {total} ronde{total !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
            <Text style={styles.caption}>
              De la plus récente à la plus ancienne
            </Text>
            {items.length > 0 && roundsQuery.isRefetchError && !forbidden && (
              <Text accessibilityRole="alert" style={styles.refreshError}>
                Actualisation impossible. Les dernières données chargées restent
                affichées.
              </Text>
            )}
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={roundsQuery.isRefetching || sitesQuery.isRefetching}
            onRefresh={refresh}
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        }
        onEndReached={() => {
          if (!roundsQuery.isFetchNextPageError) {
            loadNext();
          }
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={empty}
        ListFooterComponent={
          roundsQuery.isFetchingNextPage ? (
            <ActivityIndicator
              accessibilityLabel="Chargement des rondes suivantes"
              color={colors.navy}
              style={styles.loadingMore}
            />
          ) : !hideRounds && roundsQuery.isFetchNextPageError ? (
            <ErrorView
              label="La suite des rondes n'a pas pu être chargée."
              onRetry={loadNext}
            />
          ) : null
        }
        renderItem={({item}) => (
          <View style={styles.item}>
            <RoundsListCard
              round={item}
              onPress={() => navigation.navigate('RoundDetail', {id: item.id})}
            />
          </View>
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
  container: {flex: 1, backgroundColor: colors.background},
  list: {flexGrow: 1, paddingBottom: 24},
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {fontSize: 29, fontWeight: '800', color: colors.surface},
  subtitle: {fontSize: 13, color: '#D5E3F5', marginTop: 5},
  results: {
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  section: {fontSize: 18, fontWeight: '800', color: colors.navy},
  count: {fontSize: 12, fontWeight: '700', color: colors.muted},
  caption: {
    fontSize: 12,
    color: colors.muted,
    marginHorizontal: 18,
    marginTop: 5,
    marginBottom: 14,
  },
  item: {paddingHorizontal: 16},
  loadingMore: {padding: 16},
  refreshError: {
    color: colors.warning,
    marginHorizontal: 18,
    marginBottom: 12,
    fontSize: 13,
  },
});
