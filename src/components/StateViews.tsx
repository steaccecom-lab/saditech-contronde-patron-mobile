import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

export function LoadingView({ label = 'Chargement...' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export function EmptyView({label, onRefresh}: {label: string; onRefresh?: () => void}) {
  return (
    <View style={styles.center}>
      <Text style={styles.text}>{label}</Text>
      {onRefresh ? (
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={onRefresh}>
          <Text style={styles.buttonText}>Actualiser</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function ErrorView({ label, onRetry }: { label: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.error}>{label}</Text>
      {onRetry ? (
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Réessayer</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 16,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 8,
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: colors.surface,
    fontWeight: '700',
  },
});
