import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {AgentItem} from '../types/api';
import type {GpsIndicator} from '../utils/agentGpsPresentation';
import {AgentTelemetry} from './AgentTelemetry';
import {colors} from '../theme/colors';
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
      <AgentTelemetry
        devices={agent.batteryDevices}
        receivedAt={receivedAt}
        nowElapsed={nowElapsed}
        gps={gps}
      />
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 8,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 7},
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {fontWeight: '800', color: colors.navy, fontSize: 12},
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.navy,
    flex: 1,
    minWidth: 0,
  },
  chevron: {fontSize: 20, color: colors.primary},
});
