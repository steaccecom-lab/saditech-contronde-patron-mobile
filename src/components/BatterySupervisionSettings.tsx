import React, {useEffect, useRef, useState} from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {
  saveBatterySettings,
  type BatterySettings,
  type CompanyOperationSettingsResponse,
} from '../services/companyOperationSettingsApi';
import {colors} from '../theme/colors';
import {parseApiError} from '../services/apiError';

type Draft = {enabled: boolean; low: string; critical: string; rearm: string};
const fields = [
  ['low', 'Seuil de batterie faible'],
  ['critical', 'Seuil de batterie critique'],
  ['rearm', 'Réarmement au-dessus de'],
] as const;
export function batteryDraftErrors(draft: Draft) {
  const low = Number(draft.low),
    critical = Number(draft.critical),
    rearm = Number(draft.rearm);
  if (
    [draft.low, draft.critical, draft.rearm].some(
      value => !/^\d+$/.test(value),
    ) ||
    ![low, critical, rearm].every(Number.isSafeInteger) ||
    low < 1 ||
    low > 99 ||
    critical < 0 ||
    critical >= low ||
    rearm <= low ||
    rearm > 99
  ) {
    return 'Utilisez des pourcentages entiers : 0 ≤ critique < faible < réarmement ≤ 99.';
  }
  return null;
}
export function BatterySupervisionSettings({
  companyId,
  canEdit,
  data,
  queryKey,
}: {
  companyId: string;
  canEdit: boolean;
  data: CompanyOperationSettingsResponse;
  queryKey: string[];
}) {
  const settings = data.settings;
  const available = typeof settings.batteryAlertsEnabled === 'boolean';
  const initial: Draft = {
    enabled: settings.batteryAlertsEnabled ?? false,
    low: String(settings.batteryLowThreshold ?? 20),
    critical: String(settings.batteryCriticalThreshold ?? 10),
    rearm: String(settings.batteryRearmThreshold ?? 25),
  };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);
  const client = useQueryClient();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const mutation = useMutation({
    mutationFn: (values: BatterySettings) =>
      saveBatterySettings(companyId, values),
    onSuccess: result => {
      if (!mounted.current) {
        return;
      }
      client.setQueryData(queryKey, result);
      setDraft(null);
      setSaved(true);
    },
  });
  const value = draft ?? initial;
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);
  const error = batteryDraftErrors(value);
  const disabled = !canEdit || mutation.isPending;
  const change = (next: Draft) => {
    setDraft(next);
    setSaved(false);
    mutation.reset();
  };
  return (
    <View style={styles.group}>
      <Text style={styles.title}>Batterie des téléphones Agent</Text>
      <Text style={styles.description}>
        Indépendante des rondes et du GPS. Les alertes sont désactivées par
        défaut. Aucune nouvelle alerte pendant la charge ou avec une mesure
        ancienne.
      </Text>
      {!available ? (
        <Text style={styles.description}>
          Réglages batterie indisponibles sur cette version du serveur.
        </Text>
      ) : (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>Alertes batterie de la société</Text>
            <Switch
              accessibilityLabel="Alertes batterie de la société"
              disabled={disabled}
              value={value.enabled}
              onValueChange={enabled => change({...value, enabled})}
            />
          </View>
          {fields.map(([key, label]) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{label} (%)</Text>
              <TextInput
                accessibilityLabel={label + ' (%)'}
                keyboardType="number-pad"
                editable={!disabled}
                value={value[key]}
                onChangeText={text => change({...value, [key]: text})}
                style={styles.input}
              />
            </View>
          ))}
          <Text style={styles.description}>
            Une alerte faible puis, si nécessaire, une alerte critique par
            épisode. Le réarmement exige un niveau strictement supérieur au
            seuil choisi. Vos préférences de rondes ne filtrent pas ces alertes.
          </Text>
          {!canEdit && (
            <Text style={styles.description}>Consultation uniquement.</Text>
          )}
          {dirty && error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {canEdit && (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={disabled || !dirty || Boolean(error)}
              accessibilityState={{
                disabled: disabled || !dirty || Boolean(error),
              }}
              style={[
                styles.button,
                disabled || !dirty || error ? styles.disabled : null,
              ]}
              onPress={() => {
                if (disabled || !dirty || error) {
                  return;
                }
                mutation.mutate({
                  batteryAlertsEnabled: value.enabled,
                  batteryLowThreshold: Number(value.low),
                  batteryCriticalThreshold: Number(value.critical),
                  batteryRearmThreshold: Number(value.rearm),
                });
              }}>
              <Text style={styles.buttonText}>
                Enregistrer les règles batterie
              </Text>
            </TouchableOpacity>
          )}
          {canEdit && dirty && !mutation.isPending && (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.cancel}
              onPress={() => {
                setDraft(null);
                setSaved(false);
                mutation.reset();
              }}>
              <Text style={styles.link}>
                Annuler les modifications batterie
              </Text>
            </TouchableOpacity>
          )}
          {mutation.isPending && (
            <Text style={styles.description}>Enregistrement…</Text>
          )}
          {mutation.isError && (
            <Text accessibilityRole="alert" style={styles.error}>
              Enregistrement impossible. Modifications conservées.{' '}
              {parseApiError(mutation.error).messages.join(' ')}
            </Text>
          )}
          {saved && (
            <Text accessibilityLiveRegion="polite" style={styles.success}>
              Règles batterie enregistrées.
            </Text>
          )}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  group: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
    marginBottom: 10,
  },
  description: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    marginBottom: 14,
  },
  label: {flex: 1, fontWeight: '700', color: colors.text, marginRight: 12},
  field: {marginBottom: 14},
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    marginTop: 8,
  },
  button: {
    minHeight: 48,
    backgroundColor: colors.navy,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {color: colors.surface, fontWeight: '700', textAlign: 'center'},
  disabled: {opacity: 0.45},
  error: {color: colors.danger, lineHeight: 21, marginTop: 8},
  success: {color: colors.success, lineHeight: 21, marginTop: 8},
  cancel: {minHeight: 48, justifyContent: 'center'},
  link: {color: colors.primary, fontWeight: '700'},
});
