import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {RoundDetail} from '../types/api';
import {colors} from '../theme/colors';

export function RoundSteps({
  round,
}: {
  round: Pick<RoundDetail, 'stepCount' | 'stepTrackingStatus'>;
}) {
  const count = round.stepCount;
  const available =
    round.stepTrackingStatus === 'AVAILABLE' &&
    typeof count === 'number' &&
    Number.isInteger(count) &&
    count >= 0;
  if (!available) {
    return <Text style={styles.unavailable}>Nombre de pas indisponible</Text>;
  }
  if (count === 0) {
    return (
      <View style={styles.warning} accessibilityLabel="0 pas — Aucun pas détecté !">
        <Text style={styles.danger} accessible={false}>
          ⚠
        </Text>
        <Text style={[styles.danger, styles.message]}>0 pas — Aucun pas détecté !</Text>
      </View>
    );
  }
  return <Text style={styles.normal}>Nombre de pas : {count}</Text>;
}

const styles = StyleSheet.create({
  normal: {color: colors.text, fontSize: 15, marginBottom: 6},
  unavailable: {color: colors.muted, fontSize: 15, marginBottom: 6},
  warning: {flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6},
  danger: {color: colors.danger, fontSize: 15, fontWeight: '700'},
  message: {flex: 1, marginLeft: 6},
});
