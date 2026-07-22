import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export function MetricCard({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'danger' }) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color: colors[tone] }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    minHeight: 96,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
  },
  label: {
    color: colors.text,
    fontSize: 14,
    marginTop: 6,
  },
});
