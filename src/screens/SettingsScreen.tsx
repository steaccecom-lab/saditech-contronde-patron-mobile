import React, {useState} from 'react';
import {CompanySupervisionSettings} from '../components/CompanySupervisionSettings';
import {
  Alert,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
  updateBatteryPreference,
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
import {colors} from '../theme/colors';

const options: ScanNotificationMode[] = [
  'ALL_SCANS',
  'FINISHED_ONLY',
  'LATE_ONLY',
  'MISSED_ONLY',
  'DISABLED',
];

const optionLabels: Record<(typeof options)[number], string> = {
  ALL_SCANS: 'Tous les scans',
  FINISHED_ONLY: 'Rondes terminées uniquement',
  LATE_ONLY: 'Retards uniquement',
  MISSED_ONLY: 'Rondes manquées uniquement',
  DISABLED: 'Notifications désactivées',
  OUT_OF_ORDER_ONLY: 'Scans hors ordre uniquement',
};

export function SettingsScreen() {
  const user = useAuthStore(state => state.user);
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

  const batteryMutation = useMutation({
    mutationFn: updateBatteryPreference,
    onSuccess: data => {
      queryClient.setQueryData(['notificationPreferences'], data);
    },
  });
  const doLogout = async () => {
    await revokeCurrentDevice().catch(() => undefined);
    await logout(refreshToken);
    disconnectSocket();
    resetEventDedup();
    queryClient.clear();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Paramètres</Text>
      {user && (
        <CompanySupervisionSettings
          key={`${user.companyId}:${user.id}`}
          user={user}
        />
      )}
      <View style={styles.card}>
        <Text style={styles.section}>Mes notifications</Text>
        {query.isLoading ? <LoadingView /> : null}
        {query.isError ? (
          <ErrorView
            label="Impossible de charger les préférences personnelles."
            onRetry={query.refetch}
          />
        ) : null}
        {query.data && (
          <>
            <Text style={styles.description}>
              Choisissez les événements qui vous seront signalés sur vos
              appareils. L’activité en temps réel reste disponible.
            </Text>
            {query.data.scanNotificationMode === 'OUT_OF_ORDER_ONLY' && (
              <Text style={styles.description}>
                Votre ancienne préférence « Scans hors ordre » est conservée.
                Choisissez une option pour la remplacer.
              </Text>
            )}
            {typeof query.data.batteryAlertsEnabled === 'boolean' && (
              <View style={styles.batteryGroup}>
                <Text style={styles.description}>
                  Les alertes batterie sont indépendantes des notifications de
                  rondes ci-dessous.
                </Text>
                <View style={styles.batteryRow}>
                  <Text style={[styles.optionText, styles.batteryLabel]}>
                    Recevoir les alertes batterie
                  </Text>
                  <Switch
                    accessibilityLabel="Recevoir les alertes batterie"
                    value={query.data.batteryAlertsEnabled}
                    disabled={batteryMutation.isPending || mutation.isPending}
                    onValueChange={enabled => batteryMutation.mutate(enabled)}
                  />
                </View>
                {batteryMutation.isPending && (
                  <Text style={styles.description}>Enregistrement…</Text>
                )}
                {batteryMutation.isSuccess && (
                  <Text accessibilityLiveRegion="polite" style={styles.saved}>
                    Préférence batterie sauvegardée.
                  </Text>
                )}
                {batteryMutation.isError && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    Préférence batterie non enregistrée. Réessayez.
                  </Text>
                )}
              </View>
            )}
            {options.map(option => {
              const selected = query.data.scanNotificationMode === option;
              return (
                <TouchableOpacity
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: selected,
                    disabled: mutation.isPending || batteryMutation.isPending,
                  }}
                  disabled={mutation.isPending || batteryMutation.isPending}
                  style={[styles.option, selected && styles.selected]}
                  onPress={() => mutation.mutate(option)}>
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.selectedText,
                    ]}>
                    {optionLabels[option]}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {mutation.isPending ? (
              <Text style={styles.description}>Enregistrement…</Text>
            ) : null}
            {mutation.isError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                Sauvegarde impossible. Réessayez en sélectionnant votre
                préférence.
              </Text>
            ) : null}
            {saved ? (
              <Text accessibilityLiveRegion="polite" style={styles.saved}>
                Préférence sauvegardée.
              </Text>
            ) : null}
          </>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>Session</Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.logout}
          onPress={() =>
            Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
              {text: 'Annuler'},
              {text: 'Déconnexion', onPress: doLogout},
            ])
          }>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  batteryGroup: {marginBottom: 20},
  batteryRow: {flexDirection: 'row', alignItems: 'center', minHeight: 48},
  batteryLabel: {flex: 1},
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: 16, paddingBottom: 40},
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
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
    marginTop: 4,
  },
  logoutText: {color: colors.surface, fontSize: 17, fontWeight: '800'},
});
