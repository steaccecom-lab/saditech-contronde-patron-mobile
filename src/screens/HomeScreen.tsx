import React, {useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import moment from 'moment-timezone';
import {
  getAgents,
  getDashboard,
  getRounds,
  getSites,
} from '../services/patronApi';
import {getLiveAgents} from '../services/liveGpsApi';
import {gpsElapsedTime} from '../services/gpsClock';
import {MetricCard} from '../components/MetricCard';
import {HomeSiteFilter} from '../components/HomeSiteFilter';
import {HomeAgentCard} from '../components/HomeAgentCard';
import {EmptyView, ErrorView, LoadingView} from '../components/StateViews';
import {useAuthStore} from '../stores/authStore';
import {useBatteryRefresh} from '../hooks/useBatteryRefresh';
import {useSupervisionClock} from '../hooks/useSupervisionClock';
import {agentsQueryKey} from '../query/agentsQuery';
import {supervisorSitesQueryKey} from '../query/roundsQuery';
import {
  accessDenied,
  authorizedHomeRead,
  homeQueryKeys,
  serverCount,
} from '../query/homeQuery';
import {agentGpsPresentation} from '../utils/agentGpsPresentation';
import type {
  AgentItem,
  DashboardResponse,
  RoundsResponse,
  SiteItem,
  User,
} from '../types/api';
import type {GpsSnapshot} from '../utils/agentGpsPresentation';
import type {RootStackParamList} from '../types/navigation';
import {colors} from '../theme/colors';
import {formatDateTime} from '../utils/format';

export function HomeScreen() {
  const user = useAuthStore(state => state.user);
  if (!user) {
    return <EmptyView label="Connexion requise pour consulter l'accueil." />;
  }
  if (
    !user.companyId ||
    !['COMPANY_ADMIN', 'SUPERVISOR'].includes(user.roleType) ||
    !user.permissions.includes('dashboard.read')
  ) {
    return (
      <ErrorView label="Vous n'avez pas l'autorisation de consulter l'accueil." />
    );
  }
  return (
    <HomeContent
      key={`${user.companyId}:${user.id}:${user.roleType}:${[
        ...user.permissions,
      ]
        .sort()
        .join(',')}`}
      user={user}
    />
  );
}
function HomeContent({user}: {user: User}) {
  const client = useQueryClient();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [siteId, setSiteId] = useState<string>();
  const active = !!useBatteryRefresh();
  const clock = useSupervisionClock(active);
  const elapsed = Math.max(clock, gpsElapsedTime());
  const interval = active ? 30000 : false;
  const sitesQuery = useQuery<SiteItem[]>({
    queryKey: supervisorSitesQueryKey(user, true),
    queryFn: ({signal}) => getSites({includeInactive: true}, signal),
    enabled: active,
    retry: false,
    refetchInterval: interval,
  });
  const sites: SiteItem[] = sitesQuery.data ?? [];
  const supervised = user.roleType === 'SUPERVISOR';
  const allowedIds = supervised ? sites.map(site => site.id) : undefined;
  const scopeReady = !supervised || (sitesQuery.isSuccess && sites.length > 0);
  const selectedAllowed =
    !siteId || (sitesQuery.isSuccess && sites.some(site => site.id === siteId));
  const allowed = scopeReady && selectedAllowed;
  const keys = homeQueryKeys(user, siteId, allowedIds);
  const enabled = active && allowed;
  const canRounds = user.permissions.some(permission =>
    ['scheduled_rounds.read', 'round_sessions.read'].includes(permission),
  );
  const dashboard = useQuery<DashboardResponse>({
    queryKey: keys.dashboard,
    queryFn: ({signal}) =>
      authorizedHomeRead(
        () => getDashboard({siteId}, signal),
        () => {
          client.setQueryData(keys.dashboard, null);
        },
      ),
    enabled,
    retry: false,
    refetchInterval: interval,
  });
  const pending = useQuery<RoundsResponse>({
    queryKey: keys.pending,
    // The server counts today's PLANNED occurrences; do not count list rows.
    queryFn: ({signal}) =>
      authorizedHomeRead(
        () =>
          getRounds(
            {page: 1, limit: 1, period: 'today', status: 'PLANNED', siteId},
            signal,
          ),
        () => {
          client.setQueryData(keys.pending, null);
        },
      ),
    enabled: enabled && canRounds,
    retry: false,
    refetchInterval: interval,
  });
  const agentKey = agentsQueryKey(
    user,
    {search: '', period: 'today', siteId},
    allowedIds,
  );
  const agentsQuery = useInfiniteQuery({
    queryKey: agentKey,
    queryFn: ({pageParam = 1, signal}) =>
      authorizedHomeRead(
        () =>
          getAgents(
            {page: pageParam, limit: 20, period: 'today', siteId},
            signal,
          ),
        () => {
          client.setQueryData(agentKey, {pages: [], pageParams: []});
        },
      ),
    initialPageParam: 1,
    getNextPageParam: last =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
    enabled,
    retry: false,
    refetchInterval: interval,
  });
  const gpsQuery = useQuery<GpsSnapshot>({
    queryKey: keys.gps,
    queryFn: ({signal}) =>
      authorizedHomeRead(
        () => getLiveAgents(siteId, signal),
        () => {
          client.setQueryData(keys.gps, {
            items: [],
            serverTime: '',
            receivedAt: gpsElapsedTime(),
          });
        },
      ),
    enabled,
    retry: false,
    refetchInterval: interval,
  });
  const refreshSites = () => {
    sitesQuery.refetch().catch(() => undefined);
  };
  const refresh = () => {
    refreshSites();
    if (!allowed) {
      return;
    }
    dashboard.refetch().catch(() => undefined);
    agentsQuery.refetch().catch(() => undefined);
    gpsQuery.refetch().catch(() => undefined);
    if (canRounds) {
      pending.refetch().catch(() => undefined);
    }
  };
  const hiddenAgents = !allowed || accessDenied(agentsQuery.error);
  const byId = new Map<string, {agent: AgentItem; receivedAt?: number}>();
  if (!hiddenAgents) {
    for (const page of agentsQuery.data?.pages ?? []) {
      for (const agent of page.items) {
        if (
          !byId.has(agent.id) ||
          (page.receivedAt ?? -1) >= (byId.get(agent.id)?.receivedAt ?? -1)
        ) {
          byId.set(agent.id, {agent, receivedAt: page.receivedAt});
        }
      }
    }
  }
  const loadMore = () => {
    if (
      enabled &&
      !hiddenAgents &&
      agentsQuery.hasNextPage &&
      !agentsQuery.isFetchingNextPage
    ) {
      agentsQuery.fetchNextPage({cancelRefetch: false}).catch(() => undefined);
    }
  };
  const snapshot: DashboardResponse | null | undefined =
    !allowed || accessDenied(dashboard.error) ? undefined : dashboard.data;
  const pendingCount =
    !allowed || !canRounds || accessDenied(pending.error)
      ? null
      : serverCount(pending.data?.pagination.total);
  let scopeMessage: React.ReactElement | null = null;
  if (supervised && sitesQuery.isError) {
    scopeMessage = (
      <ErrorView
        label="Impossible de vérifier les sites de votre périmètre."
        onRetry={refreshSites}
      />
    );
  } else if (supervised && sitesQuery.isPending) {
    scopeMessage = <LoadingView label="Chargement des sites" />;
  } else if (!scopeReady) {
    scopeMessage = (
      <EmptyView
        label="Aucun site ne vous est actuellement affecté."
        onRefresh={refreshSites}
      />
    );
  } else if (!selectedAllowed) {
    scopeMessage = (
      <ErrorView
        label="Ce site n'est plus disponible. Choisissez Tous les sites."
        onRetry={refreshSites}
      />
    );
  }
  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      data={[...byId.values()]}
      keyExtractor={item => item.agent.id}
      refreshControl={
        <RefreshControl
          refreshing={dashboard.isRefetching || agentsQuery.isRefetching}
          onRefresh={refresh}
          colors={[colors.navy]}
          tintColor={colors.navy}
        />
      }
      onEndReached={() => {
        if (!agentsQuery.isFetchNextPageError) {
          loadMore();
        }
      }}
      onEndReachedThreshold={0.3}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Accueil</Text>
          </View>
          <View style={styles.inset}>
            <HomeSiteFilter
              sites={sites}
              siteId={siteId}
              onChange={setSiteId}
              pending={sitesQuery.isPending}
              error={sitesQuery.isError}
              retry={refreshSites}
            />
            {scopeMessage}
            {allowed && (
              <>
                <View style={styles.metrics}>
                  <MetricCard
                    label="Rondes en attente"
                    value={pendingCount}
                    tone="info"
                    detail={
                      !canRounds
                        ? 'Lecture des rondes non autorisée'
                        : 'Planifiées aujourd’hui'
                    }
                  />
                  <MetricCard
                    label="Terminées aujourd'hui"
                    value={serverCount(snapshot?.summary.completedToday)}
                    tone="success"
                    detail="Selon la date réelle de fin"
                  />
                  <MetricCard
                    label="En retard aujourd'hui"
                    value={serverCount(snapshot?.summary.late)}
                    tone="warning"
                    detail="Selon la date planifiée"
                  />
                  <MetricCard
                    label="Manquées aujourd'hui"
                    value={serverCount(snapshot?.summary.missed)}
                    tone="danger"
                    detail="Selon la date planifiée"
                  />
                </View>
                {snapshot && (
                  <Text style={styles.caption}>
                    Situation du{' '}
                    {moment(snapshot.generatedAt)
                      .tz('Africa/Casablanca')
                      .format('DD/MM/YYYY')}{' '}
                    · Casablanca
                  </Text>
                )}
                {dashboard.isPending && (
                  <LoadingView label="Chargement des indicateurs" />
                )}
                {dashboard.isError && (
                  <ErrorView
                    label={
                      accessDenied(dashboard.error)
                        ? 'Accès aux indicateurs refusé.'
                        : "Impossible d'actualiser les indicateurs."
                    }
                    onRetry={refresh}
                  />
                )}
                {canRounds && pending.isError && (
                  <ErrorView
                    label="Le nombre de rondes en attente est indisponible."
                    onRetry={refresh}
                  />
                )}
                <Text style={styles.section}>Agents</Text>
                {byId.size > 0 && agentsQuery.isRefetchError && (
                  <Text accessibilityRole="alert" style={styles.warning}>
                    Actualisation impossible. Les dernières données chargées
                    restent affichées.
                  </Text>
                )}
              </>
            )}
          </View>
        </>
      }
      ListEmptyComponent={
        !allowed ? null : agentsQuery.isError ? (
          <ErrorView
            label={
              accessDenied(agentsQuery.error)
                ? 'Accès aux agents refusé.'
                : 'Impossible de charger les agents.'
            }
            onRetry={refresh}
          />
        ) : agentsQuery.isPending ? (
          <LoadingView label="Chargement des agents" />
        ) : (
          <EmptyView label="Aucun agent dans ce périmètre." />
        )
      }
      renderItem={({item}) => (
        <View style={styles.inset}>
          <HomeAgentCard
            agent={item.agent}
            receivedAt={item.receivedAt}
            nowElapsed={elapsed}
            gps={agentGpsPresentation(
              item.agent.id,
              user.companyId!,
              gpsQuery.data,
              elapsed,
              gpsQuery.isError,
              siteId,
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
      ListFooterComponent={
        <>
          {allowed && agentsQuery.isFetchingNextPage && (
            <ActivityIndicator
              accessibilityLabel="Chargement des agents suivants"
              color={colors.navy}
            />
          )}
          {allowed && !hiddenAgents && agentsQuery.isFetchNextPageError && (
            <ErrorView
              label="La suite des agents n'a pas pu être chargée."
              onRetry={loadMore}
            />
          )}
          {allowed && (
            <View style={styles.inset}>
              <Text style={styles.section}>Activité en temps réel</Text>
              {!snapshot && !dashboard.isPending ? (
                <Text style={styles.caption}>Activité indisponible.</Text>
              ) : snapshot?.liveActivity.length === 0 ? (
                <EmptyView label="Aucune activité récente. Les prochains scans apparaîtront ici automatiquement." />
              ) : (
                snapshot?.liveActivity.map(item => (
                  <View key={item.scanId} style={styles.activity}>
                    <Text style={styles.activityTitle}>
                      {item.agent.name} · {item.checkpoint.name}
                    </Text>
                    <Text style={styles.meta}>
                      {item.round.name} · {item.site.name}
                    </Text>
                    <Text style={styles.meta}>
                      {formatDateTime(item.scannedAt ?? item.scan?.scannedAt)}
                    </Text>
                    <Text
                      style={[
                        styles.order,
                        {
                          color: item.isOutOfOrder
                            ? colors.warning
                            : colors.success,
                        },
                      ]}>
                      {item.isOutOfOrder
                        ? '! Ordre non respecté'
                        : '✓ Ordre respecté'}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </>
      }
    />
  );
}
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
  content: {paddingBottom: 28},
  inset: {paddingHorizontal: 16},
  header: {
    backgroundColor: colors.navy,
    padding: 12,
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  title: {fontSize: 24, fontWeight: '800', color: colors.surface},
  metrics: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  caption: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
    marginBottom: 4,
  },
  section: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
    marginTop: 6,
    marginBottom: 4,
  },
  activity: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  activityTitle: {color: colors.text, fontSize: 14, fontWeight: '700'},
  meta: {color: colors.muted, marginTop: 4, fontSize: 12},
  order: {marginTop: 5, fontWeight: '700', fontSize: 12},
  warning: {color: colors.warning, fontSize: 12, marginBottom: 12},
});
