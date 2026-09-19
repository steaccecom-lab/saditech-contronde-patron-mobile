import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../theme/colors';
import {cardSurface} from '../theme/surfaces';

export function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'danger';
}) {
  return (
    <View style={[styles.card, {borderTopColor: colors[tone]}]}>
      <Text style={[styles.value, {color: colors[tone]}]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardSurface,
    flex: 1,
    minWidth: 92,
    padding: 12,
    borderTopWidth: 3,
    minHeight: 110,
  },
  value: {
    fontSize: 30,
    fontWeight: '800',
  },
  label: {
    color: colors.text,
    fontSize: 12,
    marginTop: 4,
  },
});
