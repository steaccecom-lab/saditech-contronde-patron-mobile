import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../theme/colors';

export function MetricCard({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: number | null;
  tone: 'success' | 'warning' | 'danger' | 'info';
  detail?: string;
}) {
  return (
    <View style={[styles.card, {borderTopColor: colors[tone]}]}>
      <Text
        style={[
          styles.value,
          {color: value === null ? colors.muted : colors[tone]},
        ]}>
        {value ?? '—'}
      </Text>
      <Text style={styles.label}>{label}</Text>
      {detail && <Text style={styles.detail}>{detail}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 110,
    padding: 14,
    borderTopWidth: 3,
    minHeight: 112,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
  },
  label: {
    color: colors.text,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700',
  },
  detail: {color: colors.muted, fontSize: 10, marginTop: 5, lineHeight: 14},
});
