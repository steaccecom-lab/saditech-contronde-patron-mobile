import React, {useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {getAgents, getSites} from '../services/patronApi';
import {getLiveAgents} from '../services/liveGpsApi';
import {gpsElapsedTime} from '../services/gpsClock';
import type {AgentItem, SiteItem, User} from '../types/api';
import type {RootStackParamList} from '../types/navigation';
import {EmptyView, ErrorView, LoadingView} from '../components/StateViews';
import {LiveAgentsMap} from '../components/LiveAgentsMap';
import {AgentCard} from '../components/AgentCard';
import {AgentsFilters} from '../components/AgentsFilters';
import {useAuthStore} from '../stores/authStore';
import {useBatteryRefresh} from '../hooks/useBatteryRefresh';
import {useSupervisionClock} from '../hooks/useSupervisionClock';
import {
  agentReadScope,
  agentsQueryKey,
  liveGpsQueryKey,
  type AgentFilters,
} from '../query/agentsQuery';
import {supervisorSitesQueryKey} from '../query/roundsQuery';
import {
  agentGpsPresentation,
  type GpsSnapshot,
} from '../utils/agentGpsPresentation';
import {colors} from '../theme/colors';

const denied = (error: unknown) =>
  [401, 403, 404].includes(
    (error as {response?: {status?: number}} | null)?.response?.status ?? 0,
  );
export function AgentsScreen() {
  const user = useAuthStore(state => state.user);
  if (!user) {
    return <EmptyView label="Connexion requise pour consulter les agents." />;
  }
  if (
    !user.companyId ||
    !['COMPANY_ADMIN', 'SUPERVISOR'].includes(user.roleType)
  ) {
    return (
      <ErrorView label="Vous n'avez pas l'autorisation de consulter les agents." />
    );
  }
  return (
    <AgentsContent
      key={`${user.companyId}:${user.id}:${user.roleType}`}
      user={user}
    />
  );
}
function AgentsContent({user}: {user: User}) {
  const [map, setMap] = useState(false);
  const refreshInterval = useBatteryRefresh();
  const sitesQuery = useQuery<SiteItem[]>({
    queryKey: supervisorSitesQueryKey(user, true),
    queryFn: ({signal}) => getSites({includeInactive: true}, signal),
    enabled: !!refreshInterval,
    retry: false,
  });
  const sites: SiteItem[] = sitesQuery.data ?? [];
  const supervised = user.roleType === 'SUPERVISOR';
  const scopeReady = !supervised || (sitesQuery.isSuccess && sites.length > 0);
  const scope = agentReadScope(
    user,
    supervised ? sites.map(site => site.id) : undefined,
  );
  const canGps = user.permissions.includes('dashboard.read');
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Agents</Text>
        <View style={styles.tabs}>
          {[false, true].map(value => (
            <TouchableOpacity
              key={String(value)}
              accessibilityRole="button"
              accessibilityState={{selected: map === value}}
              onPress={() => setMap(value)}
              style={[styles.segment, map === value && styles.segmentActive]}>
              <Text
                style={
                  map === value ? styles.segmentActiveText : styles.segmentText
                }>
                {value ? 'Carte' : 'Liste'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={map ? styles.hidden : styles.root}>
        <AgentsList
          user={user}
          visible={!map}
          sites={sites}
          sitesPending={sitesQuery.isPending}
          sitesError={sitesQuery.isError}
          scopeReady={scopeReady}
          scope={scope}
          canGps={canGps}
          refreshSites={() => {
            sitesQuery.refetch().catch(() => undefined);
          }}
        />
      </View>
      {map &&
        (!canGps ? (
          <ErrorView label="Vous n'avez pas l'autorisation de consulter la carte." />
        ) : scopeReady ? (
          <LiveAgentsMap readScope={scope} />
        ) : sitesQuery.isError ? (
          <ErrorView
            label="Impossible de vérifier les sites de votre périmètre."
            onRetry={() => {
              sitesQuery.refetch().catch(() => undefined);
            }}
          />
        ) : sitesQuery.isPending ? (
          <LoadingView label="Chargement des sites" />
        ) : (
          <EmptyView label="Aucun site ne vous est actuellement affecté." />
        ))}
    </View>
  );
}
function AgentsList({
  user,
  visible,
  sites,
  sitesPending,
  sitesError,
  scopeReady,
  scope,
  canGps,
  refreshSites,
}: {
  user: User;
  visible: boolean;
  sites: SiteItem[];
  sitesPending: boolean;
  sitesError: boolean;
  scopeReady: boolean;
  scope: string;
  canGps: boolean;
  refreshSites: () => void;
}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const client = useQueryClient();
  const [filter, setFilter] = useState<AgentFilters>({
    search: '',
    period: '7d',
  });
  const refreshInterval = useBatteryRefresh();
  const active = visible && !!refreshInterval;
  const clock = useSupervisionClock(active);
  const elapsed = Math.max(clock, gpsElapsedTime());
  const supervised = user.roleType === 'SUPERVISOR';
  const allowedIds = supervised ? sites.map(site => site.id) : undefined;
  const selectedAllowed =
    !filter.siteId ||
    (!sitesError &&
      !sitesPending &&
      sites.some(site => site.id === filter.siteId));
  const allowed = scopeReady && selectedAllowed;
  const query = useInfiniteQuery({
    queryKey: agentsQueryKey(user, filter, allowedIds),
    queryFn: ({pageParam = 1, signal}) =>
      getAgents(
        {
          page: pageParam,
          limit: 20,
          period: filter.period,
          search: filter.search.trim() || undefined,
          siteId: filter.siteId,
        },
        signal,
      ),
    enabled: active && allowed,
    refetchInterval: active ? refreshInterval : false,
    initialPageParam: 1,
    getNextPageParam: last =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
  const gpsKey = liveGpsQueryKey(`${user.companyId}:${user.id}`, scope);
  const gpsQuery = useQuery<GpsSnapshot>({
    queryKey: gpsKey,
    enabled: active && scopeReady && canGps,
    retry: false,
    refetchInterval: active ? 30000 : false,
    queryFn: async ({signal}) => {
      try {
        return await getLiveAgents(undefined, signal);
      } catch (error) {
        if (denied(error)) {
          client.setQueryData(gpsKey, {
            items: [],
            serverTime: '',
            receivedAt: gpsElapsedTime(),
          });
        }
        throw error;
      }
    },
  });
  const hidden = !allowed || denied(query.error);
  const byId = new Map<string, {agent: AgentItem; receivedAt?: number}>();
  if (!hidden) {
    for (const page of query.data?.pages ?? []) {
      for (const agent of page.items) {
        const previous = byId.get(agent.id);
        if (
          !previous ||
          (page.receivedAt ?? -1) >= (previous.receivedAt ?? -1)
        ) {
          byId.set(agent.id, {agent, receivedAt: page.receivedAt});
        }
      }
    }
  }
  const agents = [...byId.values()];
  const total = hidden ? undefined : query.data?.pages[0]?.pagination.total;
  const refresh = () => {
    refreshSites();
    if (allowed) {
      query.refetch().catch(() => undefined);
    }
    if (canGps && scopeReady) {
      gpsQuery.refetch().catch(() => undefined);
    }
  };
  const more = () => {
    if (
      active &&
      allowed &&
      !denied(query.error) &&
      query.hasNextPage &&
      !query.isFetchingNextPage
    ) {
      query.fetchNextPage({cancelRefetch: false}).catch(() => undefined);
    }
  };
  let empty: React.ReactElement;
  if (supervised && sitesError) {
    empty = (
      <ErrorView
        label="Impossible de vérifier les sites de votre périmètre."
        onRetry={refreshSites}
      />
    );
  } else if (supervised && sitesPending) {
    empty = <LoadingView label="Chargement des agents" />;
  } else if (!scopeReady) {
    empty = (
      <EmptyView
        label="Aucun site ne vous est actuellement affecté."
        onRefresh={refreshSites}
      />
    );
  } else if (!selectedAllowed) {
    empty = (
      <ErrorView
        label="Ce site n'est plus disponible dans votre périmètre. Choisissez Tous les sites."
        onRetry={refreshSites}
      />
    );
  } else if (query.error) {
    empty = (
      <ErrorView
        label={
          denied(query.error)
            ? "Vous n'avez pas l'autorisation de consulter ces agents."
            : 'Impossible de charger les agents.'
        }
        onRetry={refresh}
      />
    );
  } else if (query.isPending) {
    empty = <LoadingView label="Chargement des agents" />;
  } else {
    empty = (
      <EmptyView
        label="Aucun agent ne correspond à votre recherche ou à votre périmètre."
        onRefresh={refresh}
      />
    );
  }
  return (
    <FlatList
      data={agents}
      keyExtractor={row => row.agent.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={
        <>
          <AgentsFilters
            filter={filter}
            onChange={setFilter}
            sites={sites}
            loading={sitesPending}
            error={sitesError}
            retry={refreshSites}
          />
          {total !== undefined && (
            <Text style={styles.count}>
              {total} agent
              {total !== 1 ? 's' : ''}
            </Text>
          )}
          {agents.length > 0 && query.isRefetchError && !hidden && (
            <Text accessibilityRole="alert" style={styles.warning}>
              Actualisation impossible. Les dernières données chargées restent
              affichées.
            </Text>
          )}
        </>
      }
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={refresh}
          colors={[colors.navy]}
          tintColor={colors.navy}
        />
      }
      onEndReached={() => {
        if (!query.isFetchNextPageError) {
          more();
        }
      }}
      onEndReachedThreshold={0.3}
      ListEmptyComponent={empty}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator
            accessibilityLabel="Chargement des agents suivants"
            color={colors.navy}
          />
        ) : !hidden && query.isFetchNextPageError ? (
          <ErrorView
            label="La suite des agents n'a pas pu être chargée."
            onRetry={more}
          />
        ) : null
      }
      renderItem={({item}) => (
        <View style={styles.item}>
          <AgentCard
            agent={item.agent}
            receivedAt={item.receivedAt}
            nowElapsed={elapsed}
            gps={agentGpsPresentation(
              item.agent.id,
              user.companyId!,
              gpsQuery.data,
              elapsed,
              !canGps || gpsQuery.isError,
              filter.siteId,
              allowedIds,
            )}
            onPress={() =>
              navigation.navigate('AgentRounds', {
                agentId: item.agent.id,
                agentName: item.agent.name,
              })
            }
          />
        </View>
      )}
    />
  );
}
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
  hidden: {display: 'none'},
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {color: colors.surface, fontSize: 28, fontWeight: '800'},
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#254363',
    borderRadius: 14,
    padding: 3,
  },
  segment: {
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  segmentActive: {backgroundColor: colors.surface},
  segmentText: {color: colors.surface, fontSize: 13, fontWeight: '700'},
  segmentActiveText: {color: colors.navy, fontSize: 13, fontWeight: '800'},
  list: {flexGrow: 1, paddingBottom: 24},
  item: {paddingHorizontal: 16},
  count: {
    color: colors.muted,
    fontSize: 12,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  warning: {
    color: colors.warning,
    fontSize: 12,
    marginHorizontal: 18,
    marginBottom: 12,
  },
});
