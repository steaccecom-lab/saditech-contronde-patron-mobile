import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {RoundItem} from '../types/api';
import {colors} from '../theme/colors';

export function RoundSteps({
  round,
  compact = false,
}: {
  round: Pick<RoundItem, 'stepCount' | 'stepTrackingStatus'>;
  compact?: boolean;
}) {
  const count = round.stepCount;
  const available =
    round.stepTrackingStatus === 'AVAILABLE' &&
    typeof count === 'number' &&
    Number.isInteger(count) &&
    count >= 0;
  if (!available) {
    const reason = compact
      ? unavailableReasons[round.stepTrackingStatus ?? '']
      : undefined;
    return (
      <Text style={[styles.unavailable, compact && styles.compactNotice]}>
        Nombre de pas indisponible{reason ? ' · ' + reason : ''}
      </Text>
    );
  }
  if (count === 0) {
    return (
      <View
        style={[styles.warning, compact && styles.compactNotice]}
        accessibilityLabel="0 pas — Aucun pas détecté !">
        <Text style={styles.danger} accessible={false}>
          ⚠
        </Text>
        <Text style={[styles.danger, styles.message]}>
          0 pas — Aucun pas détecté !
        </Text>
      </View>
    );
  }
  return (
    <Text style={[styles.normal, compact && styles.compactCount]}>
      {compact ? ' · ' + count + ' pas' : 'Nombre de pas : ' + count}
    </Text>
  );
}

const unavailableReasons: Record<string, string> = {
  PARTIAL: 'mesure partielle',
  DENIED: 'autorisation refusée',
  UNSUPPORTED: 'capteur non pris en charge',
};

const styles = StyleSheet.create({
  compactCount: {marginBottom: 0, fontWeight: '700', flexShrink: 1},
  compactNotice: {width: '100%', marginTop: 4, marginBottom: 0},
  normal: {color: colors.text, fontSize: 15, marginBottom: 6},
  unavailable: {color: colors.muted, fontSize: 15, marginBottom: 6},
  warning: {flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6},
  danger: {color: colors.danger, fontSize: 15, fontWeight: '700'},
  message: {flex: 1, marginLeft: 6},
});
