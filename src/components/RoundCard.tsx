import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RoundItem } from '../types/api';
import { colors } from '../theme/colors';
import { formatDateTime, statusLabel } from '../utils/format';

export function RoundCard({ round, onPress }: { round: RoundItem; onPress: () => void }) {
  const tone = round.status === 'FINISHED' ? colors.success : round.status === 'MISSED' ? colors.danger : round.status === 'LATE' ? colors.warning : colors.info;

  return (
    <TouchableOpacity accessibilityRole="button" style={styles.card} onPress={onPress}>
      <View style={styles.row}>
        <Text style={styles.title}>{round.round.name}</Text>
        <Text style={[styles.status, { color: tone }]}>{statusLabel(round.status)}</Text>
      </View>
      <Text style={styles.meta}>{round.site.name}</Text>
      <Text style={styles.meta}>{round.agent?.name ?? 'Agent non assigné'}</Text>
      <Text style={styles.meta}>Prévue: {formatDateTime(round.plannedStartAt)}</Text>
      <Text style={styles.progress}>
        {round.progress.validated}/{round.progress.total} points
        {round.outOfOrderCount > 0 ? ` · ${round.outOfOrderCount} hors ordre` : ''}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  status: {
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 5,
  },
  progress: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
});
