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
    <View
      accessible
      accessibilityLabel={`${label} : ${value ?? 'indisponible'}`}
      accessibilityHint={detail}
      style={[styles.card, {borderTopColor: colors[tone]}]}>
      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            {color: value === null ? colors.muted : colors[tone]},
          ]}>
          {value ?? '—'}
        </Text>
        <Text accessible={false} style={[styles.icon, {color: colors[tone]}]}>
          {{info: '◷', success: '✓', warning: '!', danger: '×'}[tone]}
        </Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      {value === null && detail && <Text style={styles.detail}>{detail}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 110,
    padding: 9,
    borderTopWidth: 2,
    minHeight: 76,
  },
  value: {
    fontSize: 23,
    fontWeight: '800',
  },
  label: {
    color: colors.text,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  icon: {fontSize: 17, fontWeight: '700'},
  detail: {color: colors.muted, fontSize: 10, marginTop: 5, lineHeight: 14},
});
