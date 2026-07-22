import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../services/patronApi';
import { MetricCard } from '../components/MetricCard';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { colors } from '../theme/colors';
import { formatDateTime } from '../utils/format';

export function HomeScreen() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, refetchInterval: 30000 });

  if (query.isLoading) {
    return <LoadingView />;
  }

  if (query.isError || !query.data) {
    return <ErrorView label="Impossible de charger l'accueil." onRetry={query.refetch} />;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Accueil</Text>
          <View style={styles.metrics}>
            <MetricCard label="Terminées aujourd'hui" value={query.data.summary.completedToday} tone="success" />
            <MetricCard label="En retard" value={query.data.summary.late} tone="warning" />
            <MetricCard label="Manquées" value={query.data.summary.missed} tone="danger" />
          </View>
          <Text style={styles.section}>Activité en temps réel</Text>
        </>
      }
      data={query.data.liveActivity}
      keyExtractor={(item) => item.scanId}
      ListEmptyComponent={<EmptyView label="Aucun scan récent." />}
      renderItem={({ item }) => (
        <View style={styles.activity}>
          <Text style={styles.activityTitle}>{item.agent.name} · {item.checkpoint.name}</Text>
          <Text style={styles.meta}>{item.round.name} · {item.site.name}</Text>
          <Text style={styles.meta}>{formatDateTime(item.scannedAt ?? item.scan?.scannedAt)}</Text>
          <Text style={[styles.order, { color: item.isOutOfOrder ? colors.warning : colors.success }]}>
            {item.isOutOfOrder ? '! Ordre non respecté' : '✓ Ordre respecté'}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: 14 },
  metrics: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  section: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 10 },
  activity: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 10 },
  activityTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.muted, marginTop: 4, fontSize: 14 },
  order: { marginTop: 8, fontWeight: '800' },
});
