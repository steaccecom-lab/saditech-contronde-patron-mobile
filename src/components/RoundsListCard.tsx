import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import moment from 'moment-timezone';
import type {RoundItem} from '../types/api';
import {colors} from '../theme/colors';
import {statusLabel} from '../utils/format';
import {RoundSteps} from './RoundSteps';

// Presentation of the server's result only: no time-based status calculation.
function presentation(round: RoundItem) {
  const status =
    round.finalStatus === 'COMPLETED'
      ? 'FINISHED'
      : round.finalStatus ?? round.status;
  switch (status) {
    case 'INCOMPLETE':
      return {
        label: 'Incomplète',
        color: colors.warning,
        background: '#FFF4E6',
      };
    case 'MISSED':
      return {label: 'Manquée', color: colors.danger, background: '#FFF0F0'};
    case 'LATE':
      return {label: 'En retard', color: colors.warning, background: '#FFF4E6'};
    case 'FINISHED':
      return {label: 'Terminée', color: colors.success, background: '#EAF7EF'};
    case 'STARTED':
      return {
        label: 'En cours',
        color: colors.primary,
        background: colors.primarySoft,
      };
    case 'PLANNED':
      return {label: 'En attente', color: colors.navy, background: '#EDF1F7'};
    default:
      return {
        label: statusLabel(status),
        color: colors.muted,
        background: colors.background,
      };
  }
}

export function RoundsListCard({
  round,
  onPress,
}: {
  round: RoundItem;
  onPress: () => void;
}) {
  const badge = presentation(round);
  const {validated, total} = round.progress ?? {};
  const measured =
    Number.isFinite(validated) &&
    Number.isFinite(total) &&
    total > 0 &&
    validated >= 0;
  const progress = measured ? Math.min(100, (validated / total) * 100) : 0;
  const progressText = measured
    ? `${validated}/${total} points`
    : 'Progression indisponible';
  const planned = round.plannedStartAt
    ? moment.utc(round.plannedStartAt)
    : null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityHint="Ouvrir le détail de la ronde"
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.card}>
      <View style={[styles.accent, {backgroundColor: badge.color}]} />
      <View style={styles.body}>
        <View style={styles.heading}>
          <Text style={styles.name}>{round.round.name}</Text>
          <View style={[styles.badge, {backgroundColor: badge.background}]}>
            <Text style={[styles.badgeText, {color: badge.color}]}>
              {badge.label}
            </Text>
          </View>
        </View>
        <Text style={styles.site}>{round.site.name}</Text>
        <Text style={styles.agent}>
          {round.agent?.name ?? 'Agent non assigné'}
        </Text>
        <Text style={styles.planned}>
          Prévue :{' '}
          {planned?.isValid()
            ? planned.format('DD/MM/YYYY [à] HH:mm')
            : 'Horaire indisponible'}
        </Text>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>{progressText}</Text>
          <Text style={styles.detail}>
            Voir le détail <Text accessible={false}>›</Text>
          </Text>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Progression des checkpoints QR"
          accessibilityValue={
            measured
              ? {min: 0, max: 100, now: progress, text: progressText}
              : {text: progressText}
          }
          style={styles.track}>
          <View
            style={[
              styles.fill,
              {width: `${progress}%`, backgroundColor: badge.color},
            ]}
          />
        </View>
        {(round.outOfOrderCount > 0 ||
          round.missedCheckpointCount > 0 ||
          round.autoClosedAt) && (
          <View style={styles.notices}>
            {round.outOfOrderCount > 0 && (
              <Text style={styles.notice}>
                {round.outOfOrderCount} hors ordre
              </Text>
            )}
            {round.missedCheckpointCount > 0 && (
              <Text style={styles.notice}>
                {round.missedCheckpointCount} point
                {round.missedCheckpointCount > 1 ? 's' : ''} manqué
                {round.missedCheckpointCount > 1 ? 's' : ''}
              </Text>
            )}
            {round.autoClosedAt && (
              <Text style={styles.notice}>Clôture automatique</Text>
            )}
          </View>
        )}
        {round.status === 'FINISHED' && (
          <View style={styles.steps}>
            <RoundSteps round={round} compact />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
  },
  accent: {width: 4},
  body: {flex: 1, minWidth: 0, padding: 14},
  heading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 8,
  },
  name: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
    minWidth: 0,
    color: colors.navy,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  badgeText: {fontSize: 12, fontWeight: '800', flexShrink: 1},
  site: {color: colors.navy, fontSize: 14, fontWeight: '700', marginTop: 8},
  agent: {color: colors.muted, fontSize: 13, marginTop: 4},
  planned: {color: colors.muted, fontSize: 13, marginTop: 7},
  progressRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  progressText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  detail: {color: colors.primary, fontWeight: '700', fontSize: 12},
  track: {
    height: 5,
    backgroundColor: '#EDF1F7',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  fill: {height: '100%', borderRadius: 3},
  notices: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9},
  notice: {color: colors.warning, fontSize: 12, fontWeight: '600'},
  steps: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 8},
});
