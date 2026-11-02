import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {AgentItem} from '../types/api';
import type {GpsIndicator} from '../utils/agentGpsPresentation';
import {AgentTelemetry} from './AgentTelemetry';
import {colors} from '../theme/colors';
import {statusLabel} from '../utils/format';

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
  const measured =
    last &&
    Number.isFinite(last.progress.validated) &&
    Number.isFinite(last.progress.total) &&
    last.progress.total > 0;
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
        <Text style={styles.name} numberOfLines={2}>
          {agent.name}
        </Text>
        {last && (
          <Text
            style={styles.site}
            numberOfLines={1}
            ellipsizeMode="tail"
            accessibilityLabel={`Site de la dernière ronde : ${last.siteName}`}>
            {last.siteName}
          </Text>
        )}
        <Text accessible={false} style={styles.chevron}>
          ›
        </Text>
      </View>
      <View style={styles.round}>
        {last ? (
          <>
            <Text style={styles.status}>{status}</Text>
            <Text style={styles.meta}>
              {measured
                ? `${last.progress.validated}/${last.progress.total} points`
                : 'Progression indisponible'}
              {last.outOfOrderCount > 0
                ? ` · ${last.outOfOrderCount} hors ordre`
                : ''}
            </Text>
          </>
        ) : (
          <Text style={styles.meta}>Aucune ronde sur cette période.</Text>
        )}
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    minHeight: 88,
  },
  identity: {flexDirection: 'row', alignItems: 'center', gap: 7},
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {color: colors.navy, fontWeight: '800', fontSize: 13},
  name: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    minWidth: 0,
  },
  site: {
    color: colors.muted,
    fontSize: 11,
    flexBasis: '34%',
    flexShrink: 1,
    minWidth: 0,
  },
  chevron: {fontSize: 20, color: colors.primary},
  round: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  status: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: colors.primarySoft,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexShrink: 1,
  },
  meta: {color: colors.muted, fontSize: 11, flexShrink: 1},
});
