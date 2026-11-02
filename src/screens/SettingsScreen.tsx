import React, {useEffect, useRef, useState} from 'react';
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
import type {ScanNotificationMode, User} from '../types/api';
import {EmptyView, ErrorView, LoadingView} from '../components/StateViews';
import {colors} from '../theme/colors';
import {readAppInfo} from '../services/appInfo';

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
  if (!user) {
    return (
      <EmptyView label="Connexion requise pour consulter les paramètres." />
    );
  }
  if (
    !user.companyId ||
    !['COMPANY_ADMIN', 'SUPERVISOR'].includes(user.roleType)
  ) {
    return (
      <ErrorView label="Vous n'avez pas l'autorisation de consulter ces paramètres." />
    );
  }
  return (
    <SettingsContent
      key={`${user.companyId}:${user.id}:${user.roleType}:${[
        ...user.permissions,
      ]
        .sort()
        .join(',')}`}
      user={user}
    />
  );
}

function SettingsContent({user}: {user: User}) {
  const queryClient = useQueryClient();
  const refreshToken = useAuthStore(state => state.refreshToken);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const queryKey = [
    'notificationPreferences',
    user.companyId,
    user.id,
    user.roleType,
    [...user.permissions].sort(),
  ];
  const about = readAppInfo();
  const query = useQuery({
    queryKey,
    queryFn: ({signal}) => getNotificationPreferences(signal),
  });
  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onMutate: () => setSaved(false),
    onSuccess: data => {
      if (!mounted.current) {
        return;
      }
      setSaved(true);
      queryClient.setQueryData(queryKey, data);
      queryClient.invalidateQueries({queryKey: ['notificationPreferences']});
    },
  });

  const batteryMutation = useMutation({
    mutationFn: updateBatteryPreference,
    onSuccess: data => {
      if (mounted.current) {
        queryClient.setQueryData(queryKey, data);
      }
    },
  });
  const doLogout = async () => {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      await revokeCurrentDevice().catch(() => undefined);
      await logout(refreshToken);
      mounted.current = false;
      disconnectSocket();
      resetEventDedup();
      queryClient.clear();
    } catch {
      Alert.alert('Déconnexion impossible', 'Réessayez de vous déconnecter.');
    } finally {
      if (mounted.current) {
        setLoggingOut(false);
      }
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Paramètres</Text>
        <Text style={styles.subtitle}>Votre compte et votre supervision</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>Mon compte</Text>
        <Text style={styles.infoLabel}>Nom</Text>
        <Text selectable style={styles.infoValue}>
          {user.fullName.trim() || 'Non renseigné'}
        </Text>
        <Text style={styles.infoLabel}>Adresse e-mail</Text>
        <Text selectable style={styles.infoValue}>
          {user.email.trim() || 'Non renseignée'}
        </Text>
        <Text style={styles.infoLabel}>Rôle</Text>
        <Text style={styles.infoValue}>
          {user.roleType === 'SUPERVISOR'
            ? 'Superviseur'
            : 'Responsable société'}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>Mes notifications</Text>
        {query.isLoading ? <LoadingView /> : null}
        {query.isError ? (
          <ErrorView
            label="Impossible de charger les préférences personnelles."
            onRetry={query.refetch}
          />
        ) : null}
        {query.data && !query.isError && (
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
                    disabled={
                      batteryMutation.isPending ||
                      mutation.isPending ||
                      loggingOut
                    }
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
                    disabled:
                      mutation.isPending ||
                      batteryMutation.isPending ||
                      loggingOut,
                  }}
                  disabled={
                    mutation.isPending ||
                    batteryMutation.isPending ||
                    loggingOut
                  }
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
      <Text style={styles.groupTitle}>Réglages société</Text>
      <View style={styles.company}>
        <CompanySupervisionSettings user={user} />
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>À propos</Text>
        <Text style={styles.appName}>Contronde Patron</Text>
        {[
          ['Version', about.versionName],
          ['Code de version', about.versionCode],
          ['Environnement', about.environment],
          ['Éditeur', about.publisher],
        ].map(([label, value]) => (
          <View key={label} style={styles.infoRow}>
            <Text style={styles.aboutLabel}>{label}</Text>
            <Text selectable style={styles.aboutValue}>
              {value}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>Session</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{disabled: loggingOut}}
          disabled={loggingOut}
          style={[styles.logout, loggingOut && styles.disabled]}
          onPress={() =>
            Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
              {text: 'Annuler', style: 'cancel'},
              {text: 'Déconnexion', onPress: doLogout},
            ])
          }>
          <Text style={styles.logoutText}>
            {loggingOut ? 'Déconnexion…' : 'Se déconnecter'}
          </Text>
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
  content: {paddingBottom: 28},
  header: {
    backgroundColor: colors.navy,
    padding: 18,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  subtitle: {color: '#D9E1EC', fontSize: 13, marginTop: 5},
  company: {marginHorizontal: 16},
  groupTitle: {
    marginHorizontal: 18,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  infoLabel: {color: colors.muted, fontSize: 11, marginTop: 10},
  infoValue: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 3,
  },
  appName: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 7},
  aboutLabel: {color: colors.muted, fontSize: 12, flexGrow: 1},
  aboutValue: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  disabled: {opacity: 0.5},
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  description: {
    color: colors.muted,
    lineHeight: 20,
    fontSize: 13,
    marginBottom: 12,
  },
  error: {color: colors.danger, lineHeight: 22},
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.surface,
  },
  section: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.navy,
    marginBottom: 10,
  },
  option: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    padding: 12,
    marginBottom: 8,
  },
  selected: {borderColor: colors.navy, backgroundColor: colors.primarySoft},
  optionText: {color: colors.text, fontSize: 14, fontWeight: '700'},
  selectedText: {color: colors.navy},
  saved: {color: colors.success, marginTop: 4, fontWeight: '700'},
  logout: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  logoutText: {color: colors.danger, fontSize: 15, fontWeight: '700'},
});
