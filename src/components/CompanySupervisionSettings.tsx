import React, {useState} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
  getCompanyOperationSettings,
  saveCompanyOperationSettings,
  type CompanyOperationSettings,
  type CompanyOperationSettingsResponse,
} from '../services/companyOperationSettingsApi';
import {parseApiError} from '../services/apiError';
import type {User} from '../types/api';
import {colors} from '../theme/colors';

const ruleFields = [
  {
    key: 'roundStartToleranceMinutes',
    label: 'Tolérance de départ',
    min: 0,
    max: 1440,
    description: 'Délai après l’heure prévue avant de signaler un retard.',
  },
  {
    key: 'missedIfNotStartedAfterMinutes',
    label: 'Délai avant ronde manquée',
    min: 1,
    max: 10080,
    description: 'Laisser vide pour conserver le délai de chaque planning.',
  },
  {
    key: 'checkpointLateToleranceMinutes',
    label: 'Tolérance des checkpoints',
    min: 0,
    max: 1440,
    description:
      'Retard autorisé après l’heure prévue du checkpoint, calculée depuis le départ planifié.',
  },
  {
    key: 'maxSessionDurationMinutes',
    label: 'Durée maximale des rondes',
    min: 15,
    max: 10080,
    description:
      'Échéance calculée depuis le départ planifié. Les rondes déjà démarrées conservent leur échéance.',
  },
] as const;
const notificationFields = [
  ['notifyLateRound', 'Notifications des retards'],
  ['notifyMissedRound', 'Notifications des rondes manquées'],
  ['notifyCriticalAnomaly', 'Notifications des anomalies critiques'],
  ['notifyRoundFinished', 'Notification de fin de ronde'],
] as const;
type RuleKey = (typeof ruleFields)[number]['key'];
type RuleDraft = Record<RuleKey, string>;
type NotificationKey = (typeof notificationFields)[number][0];
type NotificationDraft = Pick<CompanyOperationSettings, NotificationKey>;
const rulesOf = (settings: CompanyOperationSettings): RuleDraft => ({
  roundStartToleranceMinutes: String(settings.roundStartToleranceMinutes),
  missedIfNotStartedAfterMinutes:
    settings.missedIfNotStartedAfterMinutes == null
      ? ''
      : String(settings.missedIfNotStartedAfterMinutes),
  checkpointLateToleranceMinutes: String(settings.checkpointLateToleranceMinutes),
  maxSessionDurationMinutes: String(settings.maxSessionDurationMinutes),
});
const notificationsOf = (settings: CompanyOperationSettings): NotificationDraft => ({
  notifyLateRound: settings.notifyLateRound,
  notifyMissedRound: settings.notifyMissedRound,
  notifyCriticalAnomaly: settings.notifyCriticalAnomaly,
  notifyRoundFinished: settings.notifyRoundFinished,
});
function parseRules(draft: RuleDraft) {
  const values: Partial<Record<RuleKey, number | null>> = {};
  const errors: string[] = [];
  ruleFields.forEach((field) => {
    const text = draft[field.key].trim();
    if (field.key === 'missedIfNotStartedAfterMinutes' && text === '') {
      values[field.key] = null;
    } else if (
      !/^\d+$/.test(text) ||
      !Number.isSafeInteger(Number(text)) ||
      Number(text) < field.min ||
      Number(text) > field.max
    ) {
      errors.push(`${field.label} : nombre entier entre ${field.min} et ${field.max} minutes.`);
    } else {
      values[field.key] = Number(text);
    }
  });
  if (
    !errors.length &&
    values.missedIfNotStartedAfterMinutes != null &&
    values.missedIfNotStartedAfterMinutes <= values.roundStartToleranceMinutes!
  ) {
    errors.push('Le délai avant ronde manquée doit dépasser la tolérance de départ.');
  }
  return {values, errors};
}

export function CompanySupervisionSettings({user}: {user: User}) {
  const companyId = user.companyId;
  const canRead = Boolean(companyId) && ['COMPANY_ADMIN', 'SUPERVISOR'].includes(user.roleType);
  const canEdit =
    user.roleType === 'COMPANY_ADMIN' && user.permissions.includes('companies.manage');
  const client = useQueryClient();
  const queryKey = ['companyOperationSettings', companyId, user.id];
  const query = useQuery({
    queryKey,
    queryFn: () => getCompanyOperationSettings(companyId!),
    enabled: canRead,
    retry: false,
  });
  // Drafts are independent of query refreshes and of personal preferences.
  const [rules, setRules] = useState<RuleDraft | null>(null);
  const [notifications, setNotifications] = useState<NotificationDraft | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: ({
      section,
      settings,
    }: {
      section: 'rules' | 'notifications';
      settings: CompanyOperationSettings;
    }) => saveCompanyOperationSettings(companyId!, section, settings),
    onSuccess: (data: CompanyOperationSettingsResponse, variables) => {
      client.setQueryData(queryKey, data);
      if (variables.section === 'rules') {
        setRules(null);
        setSaved('Règles de supervision enregistrées.');
      } else {
        setNotifications(null);
        setSaved('Notifications société enregistrées.');
      }
    },
  });
  if (!canRead) {
    return null;
  }
  if (query.isPending) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Règles de supervision</Text>
        <ActivityIndicator accessibilityLabel="Chargement des règles de supervision" />
      </View>
    );
  }
  if (!query.data || query.isError) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Règles de supervision</Text>
        <Text accessibilityRole="alert" style={styles.error}>
          {parseApiError(query.error).messages.join('\n')}
        </Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => query.refetch()}>
          <Text style={styles.link}>Réessayer le chargement</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const settings = query.data.settings;
  const currentRules = rules ?? rulesOf(settings);
  const currentNotifications = notifications ?? notificationsOf(settings);
  const ruleDirty = JSON.stringify(currentRules) !== JSON.stringify(rulesOf(settings));
  const notificationDirty =
    JSON.stringify(currentNotifications) !== JSON.stringify(notificationsOf(settings));
  const parsed = parseRules(currentRules);
  const disabled = !canEdit || mutation.isPending;
  const change = () => {
    setSaved(null);
    mutation.reset();
  };
  const save = (section: 'rules' | 'notifications') => {
    if (disabled || (section === 'rules' && parsed.errors.length)) {
      return;
    }
    setSaved(null);
    mutation.mutate({
      section,
      settings: {
        ...settings,
        ...(section === 'rules' ? parsed.values : currentNotifications),
      },
    });
  };
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Règles de supervision</Text>
      <Text style={styles.description}>
        Règles de votre société, partagées entre ses utilisateurs autorisés.
      </Text>
      {!canEdit && (
        <Text style={styles.notice}>
          Consultation uniquement : votre rôle ou vos permissions ne permettent pas la modification.
        </Text>
      )}
      {!query.data.configured && (
        <Text style={styles.notice}>
          La tolérance de départ de chaque planning est actuellement utilisée. Enregistrer les
          règles activera la tolérance société ci-dessous.
        </Text>
      )}
      <Text style={styles.notice}>
        Les nouvelles tolérances peuvent modifier les prochaines vérifications des rondes en attente
        et des checkpoints des rondes en cours. Elles ne recalculent pas les événements historiques.
      </Text>
      {ruleFields.map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={styles.label}>{field.label} (minutes)</Text>
          <Text style={styles.description}>{field.description}</Text>
          <TextInput
            accessibilityLabel={`${field.label} (minutes)`}
            value={currentRules[field.key]}
            editable={!disabled}
            keyboardType="number-pad"
            style={[styles.input, !canEdit && styles.readOnly]}
            placeholder={
              field.key === 'missedIfNotStartedAfterMinutes' ? 'Délai du planning' : undefined
            }
            onChangeText={(text) => {
              change();
              setRules({...currentRules, [field.key]: text});
            }}
          />
        </View>
      ))}
      {canEdit &&
        ruleDirty &&
        parsed.errors.map((error) => (
          <Text key={error} accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ))}
      {canEdit && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{disabled: disabled || !ruleDirty || parsed.errors.length > 0}}
          disabled={disabled || !ruleDirty || parsed.errors.length > 0}
          style={[
            styles.button,
            (disabled || !ruleDirty || parsed.errors.length > 0) && styles.disabled,
          ]}
          onPress={() => save('rules')}
        >
          <Text style={styles.buttonText}>Enregistrer les règles</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.subtitle}>Notifications de la société</Text>
      <Text style={styles.description}>
        Ces réglages autorisent l’émission. Vos préférences personnelles ci-dessous filtrent les
        notifications push reçues. Pour les anomalies critiques, choisissez « Tous les scans » dans
        vos préférences personnelles.
      </Text>
      {notificationFields.map(([key, label]) => (
        <View key={key} style={styles.switchRow}>
          <Text style={[styles.label, styles.switchLabel]}>{label}</Text>
          <Switch
            accessibilityLabel={label}
            disabled={disabled}
            value={currentNotifications[key]}
            onValueChange={(value) => {
              change();
              setNotifications({...currentNotifications, [key]: value});
            }}
            trackColor={{true: colors.primary}}
          />
        </View>
      ))}
      {canEdit && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{disabled: disabled || !notificationDirty}}
          disabled={disabled || !notificationDirty}
          style={[styles.button, (disabled || !notificationDirty) && styles.disabled]}
          onPress={() => save('notifications')}
        >
          <Text style={styles.buttonText}>Enregistrer les notifications société</Text>
        </TouchableOpacity>
      )}
      {mutation.isPending && (
        <Text accessibilityLiveRegion="polite" style={styles.description}>
          Enregistrement…
        </Text>
      )}
      {mutation.isError && (
        <Text accessibilityRole="alert" style={styles.error}>
          Enregistrement impossible. Vos modifications sont conservées.{' '}
          {parseApiError(mutation.error).messages.join(' ')}
        </Text>
      )}
      {saved && (
        <Text accessibilityLiveRegion="polite" style={styles.success}>
          {saved}
        </Text>
      )}
      {canEdit && (ruleDirty || notificationDirty) && !mutation.isPending && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            setRules(null);
            setNotifications(null);
            change();
          }}
        >
          <Text style={styles.link}>Annuler les modifications de supervision</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  title: {fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 10},
  subtitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 24,
    marginBottom: 10,
  },
  description: {color: colors.muted, lineHeight: 21, marginBottom: 8, flexShrink: 1},
  notice: {color: colors.navy, lineHeight: 21, marginBottom: 14},
  field: {marginBottom: 14},
  label: {fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6},
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
  },
  readOnly: {backgroundColor: colors.background, color: colors.muted},
  switchRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 12, minHeight: 48},
  switchLabel: {flex: 1, marginRight: 12},
  button: {
    minHeight: 48,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  buttonText: {color: colors.surface, fontWeight: '700', textAlign: 'center', flexShrink: 1},
  disabled: {opacity: 0.45},
  error: {color: colors.danger, lineHeight: 21, marginBottom: 8},
  success: {color: colors.success, lineHeight: 21, fontWeight: '700'},
  link: {color: colors.primary, paddingVertical: 12, fontWeight: '700'},
});
