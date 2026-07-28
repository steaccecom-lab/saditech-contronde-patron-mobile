import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotificationPreferences, updateNotificationPreferences } from '../services/notificationPreferencesApi';
import { logout } from '../services/authApi';
import { revokeCurrentDevice } from '../services/mobileDevicesApi';
import { disconnectSocket } from '../services/socketService';
import { resetEventDedup } from '../services/eventDedup';
import { useAuthStore } from '../stores/authStore';
import type { ScanNotificationMode } from '../types/api';
import { ErrorView, LoadingView } from '../components/StateViews';
import { notificationModeLabel } from '../presentation/labels';
import { colors } from '../theme/colors';

const options: ScanNotificationMode[] = ['ALL_SCANS', 'OUT_OF_ORDER_ONLY', 'DISABLED'];

export function SettingsScreen() {
  const queryClient = useQueryClient();
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const [saved, setSaved] = useState(false);
  const query = useQuery({ queryKey: ['notificationPreferences'], queryFn: getNotificationPreferences });
  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
    },
  });

  const doLogout = async () => {
    await revokeCurrentDevice().catch(() => undefined);
    await logout(refreshToken);
    disconnectSocket();
    resetEventDedup();
    queryClient.clear();
  };

  if (query.isLoading) {
    return <LoadingView />;
  }
  if (query.isError || !query.data) {
    return <ErrorView label="Impossible de charger les paramètres." onRetry={query.refetch} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Paramètres</Text>
      <Text style={styles.section}>Notifications</Text>
      {options.map((option) => {
        const selected = query.data.scanNotificationMode === option;
        return (
          <TouchableOpacity key={option} style={[styles.option, selected && styles.selected]} onPress={() => mutation.mutate(option)}>
            <Text style={[styles.optionText, selected && styles.selectedText]}>{notificationModeLabel(option)}</Text>
          </TouchableOpacity>
        );
      })}
      {saved ? <Text style={styles.saved}>Préférence sauvegardée.</Text> : null}
      <TouchableOpacity style={styles.logout} onPress={() => Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [{ text: 'Annuler' }, { text: 'Déconnexion', onPress: doLogout }])}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: 20 },
  section: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 10 },
  option: { minHeight: 54, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 14, marginBottom: 10 },
  selected: { borderColor: colors.primary, backgroundColor: '#EAF2FF' },
  optionText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  selectedText: { color: colors.primary },
  saved: { color: colors.success, marginTop: 4, fontWeight: '700' },
  logout: { minHeight: 54, borderRadius: 8, backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', marginTop: 28 },
  logoutText: { color: colors.surface, fontSize: 17, fontWeight: '800' },
});
