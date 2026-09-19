import React, {useState} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../services/notificationPreferencesApi';
import {logout} from '../services/authApi';
import {revokeCurrentDevice} from '../services/mobileDevicesApi';
import {disconnectSocket} from '../services/socketService';
import {resetEventDedup} from '../services/eventDedup';
import {useAuthStore} from '../stores/authStore';
import type {ScanNotificationMode} from '../types/api';
import {ErrorView, LoadingView} from '../components/StateViews';
import {notificationModeLabel} from '../presentation/labels';
import {colors} from '../theme/colors';

const options: ScanNotificationMode[] = [
  'ALL_SCANS',
  'FINISHED_ONLY',
  'LATE_ONLY',
  'MISSED_ONLY',
  'DISABLED',
];

export function SettingsScreen() {
  const queryClient = useQueryClient();
  const refreshToken = useAuthStore(state => state.refreshToken);
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: getNotificationPreferences,
  });
  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onMutate: () => setSaved(false),
    onSuccess: data => {
      setSaved(true);
      queryClient.setQueryData(['notificationPreferences'], data);
      queryClient.invalidateQueries({queryKey: ['notificationPreferences']});
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
    return (
      <ErrorView
        label="Impossible de charger les paramètres."
        onRetry={query.refetch}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Paramètres</Text>
      <Text style={styles.section}>Notifications</Text>
      <Text style={styles.description}>
        Choisissez les événements qui vous seront signalés sur vos appareils.
        L’activité en temps réel reste disponible.
      </Text>
      {query.data.scanNotificationMode === 'OUT_OF_ORDER_ONLY' && (
        <Text style={styles.description}>
          Votre ancienne préférence « Scans hors ordre » est conservée.
          Choisissez une option pour la remplacer.
        </Text>
      )}
      {options.map(option => {
        const selected = query.data.scanNotificationMode === option;
        return (
          <TouchableOpacity
            key={option}
            accessibilityRole="radio"
            accessibilityState={{
              checked: selected,
              disabled: mutation.isPending,
            }}
            disabled={mutation.isPending}
            style={[styles.option, selected && styles.selected]}
            onPress={() => mutation.mutate(option)}>
            <Text style={[styles.optionText, selected && styles.selectedText]}>
              {notificationModeLabel(option)}
            </Text>
          </TouchableOpacity>
        );
      })}
      {mutation.isPending ? (
        <Text style={styles.description}>Enregistrement…</Text>
      ) : null}
      {mutation.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          Sauvegarde impossible. Réessayez en sélectionnant votre préférence.
        </Text>
      ) : null}
      {saved ? (
        <Text accessibilityLiveRegion="polite" style={styles.saved}>
          Préférence sauvegardée.
        </Text>
      ) : null}
      <TouchableOpacity
        style={styles.logout}
        onPress={() =>
          Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
            {text: 'Annuler'},
            {text: 'Déconnexion', onPress: doLogout},
          ])
        }>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: 20, paddingBottom: 40},
  description: {color: colors.muted, lineHeight: 22, marginBottom: 16},
  error: {color: colors.danger, lineHeight: 22},
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 20,
  },
  section: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 10,
  },
  option: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    padding: 16,
    marginBottom: 10,
  },
  selected: {borderColor: colors.primary, backgroundColor: '#EAF2FF'},
  optionText: {color: colors.text, fontSize: 16, fontWeight: '700'},
  selectedText: {color: colors.primary},
  saved: {color: colors.success, marginTop: 4, fontWeight: '700'},
  logout: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  logoutText: {color: colors.surface, fontSize: 17, fontWeight: '800'},
});
