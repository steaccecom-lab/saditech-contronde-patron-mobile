import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { getRoundDetail } from '../services/patronApi';
import type { RootStackParamList } from '../types/navigation';
import type { RoundDetail } from '../types/api';
import { ErrorView, LoadingView } from '../components/StateViews';
import { checkpointStatusLabel } from '../presentation/labels';
import { colors } from '../theme/colors';
import { formatDateTime, formatDuration, statusLabel } from '../utils/format';

export function RoundDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'RoundDetail'>>();
  const query = useQuery({ queryKey: ['roundDetail', route.params.id], queryFn: () => getRoundDetail(route.params.id) });

  if (query.isLoading) {
    return <LoadingView />;
  }
  if (query.isError || !query.data) {
    return <ErrorView label="Ronde inaccessible." onRetry={query.refetch} />;
  }

  const round = query.data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{round.round.name}</Text>
      <Text style={styles.meta}>{round.site.name} · {round.agent?.name ?? 'Agent non assigné'}</Text>
      <View style={styles.card}>
        <Text style={styles.line}>Statut: {statusLabel(round.status)}</Text>
        <Text style={styles.line}>Prévue: {formatDateTime(round.plannedStartAt)}</Text>
        <Text style={styles.line}>Début: {formatDateTime(round.startedAt)}</Text>
        <Text style={styles.line}>Fin: {formatDateTime(round.finishedAt)}</Text>
        <Text style={styles.line}>Durée: {formatDuration(round.durationSeconds)}</Text>
        <Text style={styles.line}>Progression: {round.progress.validated}/{round.progress.total}</Text>
        <Text style={styles.line}>Hors ordre: {round.outOfOrderCount}</Text>
        <Text style={styles.line}>Points manqués: {round.missedCheckpointCount}</Text>
      </View>
      <Text style={styles.section}>Points</Text>
      {round.checkpoints.map((checkpoint: RoundDetail['checkpoints'][number]) => {
        const color = checkpoint.status === 'MISSED' ? colors.danger : checkpoint.isOutOfOrder ? colors.warning : checkpoint.status === 'VALIDATED' ? colors.success : colors.muted;
        return (
          <View key={checkpoint.checkpointId} style={styles.checkpoint}>
            <Text style={[styles.badge, { color }]}>{checkpoint.status === 'VALIDATED' ? (checkpoint.isOutOfOrder ? '!' : '✓') : checkpoint.status === 'MISSED' ? '×' : '·'}</Text>
            <View style={styles.checkpointBody}>
              <Text style={styles.checkpointTitle}>{checkpoint.expectedOrder}. {checkpoint.name}</Text>
              <Text style={styles.meta}>{checkpointStatusLabel(checkpoint.status)} · {formatDateTime(checkpoint.scannedAt)}</Text>
            </View>
          </View>
        );
      })}
      <Text style={styles.section}>Anomalies</Text>
      {round.anomalies.length === 0 ? <Text style={styles.meta}>Aucune anomalie.</Text> : round.anomalies.map((anomaly: RoundDetail['anomalies'][number]) => (
        <View key={anomaly.id} style={styles.anomaly}>
          <Text style={styles.line}>{anomaly.type}</Text>
          <Text style={styles.meta}>{anomaly.checkpointName ?? 'Ronde'} · {formatDateTime(anomaly.createdAt)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  title: { fontSize: 26, fontWeight: '900', color: colors.text },
  section: { fontSize: 20, fontWeight: '900', color: colors.text, marginTop: 18, marginBottom: 8 },
  meta: { color: colors.muted, fontSize: 14, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 14, marginTop: 14 },
  line: { color: colors.text, fontSize: 15, marginBottom: 6 },
  checkpoint: { flexDirection: 'row', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  badge: { width: 30, fontSize: 24, fontWeight: '900' },
  checkpointBody: { flex: 1 },
  checkpointTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  anomaly: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
});
