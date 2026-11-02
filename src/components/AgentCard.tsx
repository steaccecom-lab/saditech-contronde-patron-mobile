import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {AgentItem} from '../types/api';
import type {GpsIndicator} from '../utils/agentGpsPresentation';
import {BatteryDevices} from './BatteryDevices';
import {colors} from '../theme/colors';
import {formatPlannedDateTime, statusLabel} from '../utils/format';

const gpsLabels = {
  RECENT: 'Position récente',
  OLD: 'Position ancienne',
  UNAVAILABLE: 'Position indisponible',
};
export function AgentCard({
  agent,
  receivedAt,
  nowElapsed,
  gps,
  onPress,
}: {
  agent: AgentItem;
  receivedAt?: number;
  nowElapsed: number;
  gps: GpsIndicator;
  onPress: () => void;
}) {
  const last = agent.lastRound;
  const status =
    last?.finalStatus === 'INCOMPLETE'
      ? 'Incomplète'
      : last?.finalStatus === 'MISSED'
      ? 'Manquée'
      : last?.finalStatus === 'COMPLETED'
      ? 'Terminée'
      : last
      ? statusLabel(last.status)
      : null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityHint="Consulter l'historique des rondes de cet agent"
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.card}>
      <View style={styles.identity}>
        <View style={styles.avatar} accessible={false}>
          <Text style={styles.initial}>
            {agent.name.trim().slice(0, 1).toLocaleUpperCase('fr') || '—'}
          </Text>
        </View>
        <Text style={styles.name}>{agent.name}</Text>
        <Text accessible={false} style={styles.chevron}>
          ›
        </Text>
      </View>
      {last ? (
        <View style={styles.context}>
          <Text style={styles.label}>Site de la dernière ronde</Text>
          <Text style={styles.site}>{last.siteName}</Text>
          <Text style={styles.meta}>
            {last.roundName} · {formatPlannedDateTime(last.plannedStartAt)}
          </Text>
          <Text style={styles.meta}>
            {status} · {last.progress.validated}/{last.progress.total} points
            {last.outOfOrderCount > 0
              ? ` · ${last.outOfOrderCount} hors ordre`
              : ''}
          </Text>
        </View>
      ) : (
        <Text style={styles.meta}>Aucune ronde sur cette période.</Text>
      )}
      <View style={styles.telemetry}>
        <Text style={styles.label}>Batterie</Text>
        <BatteryDevices
          devices={agent.batteryDevices}
          compact
          receivedAt={receivedAt}
          nowElapsed={nowElapsed}
        />
        <View style={styles.gps}>
          <Text
            style={[
              styles.dot,
              {
                color:
                  gps === 'RECENT'
                    ? colors.success
                    : gps === 'OLD'
                    ? colors.warning
                    : colors.muted,
              },
            ]}
            accessible={false}>
            ●
          </Text>
          <Text style={styles.meta}>GPS · {gpsLabels[gps]}</Text>
        </View>
      </View>
      <Text style={styles.history}>
        Historique des rondes <Text accessible={false}>›</Text>
      </Text>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  identity: {flexDirection: 'row', alignItems: 'center', gap: 10},
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {color: colors.navy, fontWeight: '800', fontSize: 16},
  name: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    minWidth: 0,
  },
  chevron: {fontSize: 24, color: colors.primary},
  context: {marginTop: 10},
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
  },
  site: {color: colors.navy, fontSize: 14, fontWeight: '700'},
  meta: {color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3},
  telemetry: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 10,
  },
  gps: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7},
  dot: {fontSize: 9},
  history: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
});
