import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {AgentItem} from '../types/api';
import type {GpsIndicator} from '../utils/agentGpsPresentation';
import {BatteryDevices} from './BatteryDevices';
import {colors} from '../theme/colors';

const gpsLabel = {
  RECENT: 'Position récente',
  OLD: 'Position ancienne',
  UNAVAILABLE: 'Position indisponible',
};
export function HomeAgentCard({
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
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityHint="Consulter l'historique des rondes de cet agent"
      onPress={onPress}
      style={styles.card}>
      <View style={styles.row}>
        <View accessible={false} style={styles.avatar}>
          <Text style={styles.initial}>
            {agent.name.trim().slice(0, 1).toLocaleUpperCase('fr') || '—'}
          </Text>
        </View>
        <Text style={styles.name}>{agent.name}</Text>
        <Text accessible={false} style={styles.chevron}>
          ›
        </Text>
      </View>
      <View style={styles.telemetry}>
        <View accessible={false} style={styles.battery}>
          <View style={styles.batteryFill} />
          <View style={styles.batteryTip} />
        </View>
        <View style={styles.measure}>
          <BatteryDevices
            compact
            devices={agent.batteryDevices}
            receivedAt={receivedAt}
            nowElapsed={nowElapsed}
          />
        </View>
      </View>
      <View style={styles.gpsRow}>
        <Text accessible={false} style={styles.gps}>
          ⌖
        </Text>
        <Text style={styles.gps}>GPS · {gpsLabel[gps]}</Text>
      </View>
      <Text style={styles.history}>Historique des rondes ›</Text>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 10,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 10},
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {fontWeight: '800', color: colors.navy},
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
    flex: 1,
    minWidth: 0,
  },
  chevron: {fontSize: 22, color: colors.primary},
  telemetry: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 7,
    alignItems: 'center',
  },
  battery: {
    width: 17,
    height: 10,
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: 2,
    padding: 2,
  },
  batteryFill: {flex: 1, width: 5, backgroundColor: colors.muted},
  batteryTip: {
    position: 'absolute',
    right: -3,
    top: 2,
    width: 2,
    height: 4,
    backgroundColor: colors.muted,
  },
  measure: {flex: 1},
  gps: {fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 18},
  gpsRow: {flexDirection: 'row', gap: 5},
  history: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 8,
  },
});
