import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAgents, getRounds, getSites } from '../services/patronApi';
import type { RootStackParamList } from '../types/navigation';
import type { AgentItem, RoundStatus, SiteItem } from '../types/api';
import { RoundCard } from '../components/RoundCard';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { colors } from '../theme/colors';
import { casablancaRange, defaultHistoryDates } from '../utils/businessDates';

const statuses: Array<{ value?: RoundStatus; label: string }> = [{ label: 'Tous' }, { value: 'PLANNED', label: 'Planifi\u00e9es' }, { value: 'STARTED', label: 'En cours' }, { value: 'FINISHED', label: 'Termin\u00e9es' }, { value: 'LATE', label: 'En retard' }, { value: 'MISSED', label: 'Manqu\u00e9es' }];

export function HistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const defaults = useMemo(() => defaultHistoryDates(), []);
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [siteId, setSiteId] = useState<string>();
  const [agentId, setAgentId] = useState<string>();
  const [status, setStatus] = useState<RoundStatus>();
  const [search, setSearch] = useState('');
  const datesAreValid = isDateInput(start) && isDateInput(end) && start <= end;
  const range = useMemo(() => datesAreValid ? casablancaRange(start, end) : null, [datesAreValid, end, start]);
  const agentsQuery = useInfiniteQuery({
    queryKey: ['historyAgents', siteId],
    queryFn: ({ pageParam = 1 }) => getAgents({ page: pageParam, limit: 100, period: '30d', siteId }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  });
  const sitesQuery = useQuery({ queryKey: ['supervisorSites'], queryFn: getSites });
  const query = useInfiniteQuery({
    queryKey: ['history', range, siteId, agentId, status, search],
    queryFn: ({ pageParam = 1 }) => {
      if (!range) {
        throw new Error('La p\u00e9riode saisie est invalide.');
      }
      return getRounds({ page: pageParam, limit: 20, period: 'custom', ...range, siteId, agentId, status, search: search.trim() || undefined });
    },
    enabled: Boolean(range),
    placeholderData: (previous) => previous,
    initialPageParam: 1,
    getNextPageParam: (last) => last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  });
  const rounds = query.data?.pages.flatMap((page) => page.items) ?? [];
  const agents = agentsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const sites: SiteItem[] = sitesQuery.data ?? [];
  return <View style={styles.container}>
    <Text style={styles.title}>Historique</Text>
    <ScrollView horizontal contentContainerStyle={styles.filters} keyboardShouldPersistTaps="handled">
      <TextInput accessibilityLabel={'Date de d\u00e9but'} value={start} onChangeText={setStart} placeholder="AAAA-MM-JJ" style={styles.input} />
      <TextInput accessibilityLabel="Date de fin" value={end} onChangeText={setEnd} placeholder="AAAA-MM-JJ" style={styles.input} />
      <TextInput accessibilityLabel="Recherche" value={search} onChangeText={setSearch} placeholder="Recherche" style={styles.input} />
    </ScrollView>
    {!datesAreValid ? <Text accessibilityRole="alert" style={styles.validation}>{'Saisissez une p\u00e9riode valide au format AAAA-MM-JJ.'}</Text> : null}
    <ScrollView horizontal contentContainerStyle={styles.chips}>
      {statuses.map((item) => <Chip key={item.label} label={item.label} selected={status === item.value} onPress={() => setStatus(item.value)} />)}
    </ScrollView>
    {sites.length ? <ScrollView horizontal contentContainerStyle={styles.chips}><Chip label="Tous les sites" selected={!siteId} onPress={() => setSiteId(undefined)} />{sites.map((site) => <Chip key={site.id} label={site.name} selected={siteId === site.id} onPress={() => { setSiteId(site.id); setAgentId(undefined); }} />)}</ScrollView> : null}
    {agents.length ? <ScrollView horizontal contentContainerStyle={styles.chips} onScroll={({ nativeEvent }) => { if (nativeEvent.contentOffset.x + nativeEvent.layoutMeasurement.width >= nativeEvent.contentSize.width - 80 && agentsQuery.hasNextPage && !agentsQuery.isFetchingNextPage) { agentsQuery.fetchNextPage().catch(() => undefined); } }} scrollEventThrottle={200}><Chip label="Tous les agents" selected={!agentId} onPress={() => setAgentId(undefined)} />{agents.map((agent: AgentItem) => <Chip key={agent.id} label={agent.name} selected={agentId === agent.id} onPress={() => setAgentId(agent.id)} />)}</ScrollView> : null}
    {query.isLoading ? <LoadingView label={'Chargement de l\u2019historique...'} /> : query.isError ? <ErrorView label={query.error instanceof Error ? query.error.message : 'Historique inaccessible.'} onRetry={query.refetch} /> : <FlatList data={rounds} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />} onEndReached={() => query.hasNextPage && query.fetchNextPage()} ListEmptyComponent={<EmptyView label={datesAreValid ? 'Aucune ronde pour ces filtres.' : 'Corrigez la p\u00e9riode pour afficher les rondes.'} />} renderItem={({ item }) => <RoundCard round={item} onPress={() => navigation.navigate('RoundDetail', { id: item.id })} />} />}
  </View>;
}

function isDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.selected]}><Text style={[styles.chipText, selected && styles.selectedText]}>{label}</Text></TouchableOpacity>; }
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background, paddingTop: 12 }, title: { fontSize: 27, fontWeight: '900', color: colors.text, paddingHorizontal: 16 }, filters: { gap: 8, padding: 12 }, input: { width: 140, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, paddingHorizontal: 10, color: colors.text }, validation: { color: colors.danger, paddingHorizontal: 12, paddingBottom: 8 }, chips: { gap: 8, paddingHorizontal: 12, paddingBottom: 8 }, chip: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 11, backgroundColor: colors.surface }, selected: { backgroundColor: colors.primary }, chipText: { color: colors.text, fontWeight: '700' }, selectedText: { color: colors.surface }, list: { padding: 16 } });
