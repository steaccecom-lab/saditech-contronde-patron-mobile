import React, {useState} from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment-timezone';
import type {RoundStatus, SiteItem} from '../types/api';
import {customRoundPeriod, type RoundFilter} from '../query/roundsQuery';
import {businessDateKey} from '../utils/business-time';
import {colors} from '../theme/colors';
import {ErrorView, LoadingView} from './StateViews';

const statuses: {label: string; status?: RoundStatus}[] = [
  {label: 'Tous'},
  {label: 'En attente', status: 'PLANNED'},
  {label: 'En cours', status: 'STARTED'},
  {label: 'Terminées', status: 'FINISHED'},
  {label: 'En retard', status: 'LATE'},
  {label: 'Manquées', status: 'MISSED'},
];
type Props = {
  filter: RoundFilter;
  sites: SiteItem[];
  loadingSites: boolean;
  sitesError: boolean;
  onRetrySites: () => void;
  onChange: (filter: RoundFilter) => void;
};

export function RoundsFilters({
  filter,
  sites,
  loadingSites,
  sitesError,
  onRetrySites,
  onChange,
}: Props) {
  const [modal, setModal] = useState<'sites' | 'dates' | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dateError, setDateError] = useState(false);
  const selectedSite = sites.find(site => site.id === filter.siteId);
  const customLabel =
    filter.period === 'custom' && filter.from && filter.to
      ? `${moment.utc(filter.from).format('DD/MM/YYYY')} – ${moment
          .utc(filter.to)
          .subtract(1, 'day')
          .format('DD/MM/YYYY')}`
      : 'Période personnalisée';
  const chooseSite = (siteId?: string) => {
    onChange({...filter, siteId});
    setModal(null);
  };
  const openDates = () => {
    const today = moment.utc(businessDateKey()).format('DD/MM/YYYY');
    setFrom(filter.from ? moment.utc(filter.from).format('DD/MM/YYYY') : today);
    setTo(
      filter.to
        ? moment.utc(filter.to).subtract(1, 'day').format('DD/MM/YYYY')
        : today,
    );
    setDateError(false);
    setModal('dates');
  };
  const applyDates = () => {
    const range = customRoundPeriod(from, to);
    if (!range) {
      setDateError(true);
      return;
    }
    onChange({...filter, period: 'custom', ...range});
    setModal(null);
  };
  return (
    <View style={styles.panel}>
      <View style={styles.siteRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Filtrer par site"
          onPress={() => setModal('sites')}
          style={styles.siteButton}>
          <Text style={styles.fieldLabel}>Site</Text>
          <Text style={styles.siteName} numberOfLines={1} ellipsizeMode="tail">
            {selectedSite?.name ??
              (filter.siteId ? 'Site sélectionné' : 'Tous les sites')}
          </Text>
          <Text accessible={false} style={styles.chevron}>
            ⌄
          </Text>
        </TouchableOpacity>
        {(filter.siteId || filter.period !== 'today' || filter.status) && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Réinitialiser les filtres"
            onPress={() => onChange({period: 'today'})}
            style={styles.reset}>
            <Text
              accessible={false}
              style={[styles.resetText, styles.resetIcon]}>
              ↺
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.periods}>
        {[
          {label: "Aujourd'hui", period: 'today'},
          {label: '7 jours', period: '7d'},
        ].map(item => (
          <TouchableOpacity
            key={item.period}
            accessibilityRole="button"
            accessibilityState={{selected: filter.period === item.period}}
            onPress={() =>
              onChange({
                ...filter,
                period: item.period as 'today' | '7d',
                from: undefined,
                to: undefined,
              })
            }
            style={[
              styles.period,
              filter.period === item.period && styles.selected,
            ]}>
            <Text
              style={[
                styles.chipText,
                filter.period === item.period && styles.selectedText,
              ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Choisir une période personnalisée"
          accessibilityState={{selected: filter.period === 'custom'}}
          onPress={openDates}
          style={[
            styles.period,
            filter.period === 'custom' && styles.selected,
          ]}>
          <Text
            style={[
              styles.chipText,
              filter.period === 'custom' && styles.selectedText,
            ]}>
            {filter.period === 'custom' ? 'Dates choisies' : 'Autres dates'}
          </Text>
        </TouchableOpacity>
      </View>
      {filter.period === 'custom' && (
        <Text style={styles.hint}>{customLabel}</Text>
      )}
      <ScrollView
        horizontal
        accessibilityLabel="Filtres de statut des rondes"
        style={styles.statusScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statuses}>
        <Text style={styles.fieldLabel}>Statut</Text>
        {statuses.map(item => (
          <TouchableOpacity
            key={item.status ?? 'all'}
            accessibilityRole="button"
            accessibilityState={{selected: filter.status === item.status}}
            onPress={() =>
              onChange({
                ...filter,
                status: filter.status === item.status ? undefined : item.status,
              })
            }
            style={[
              styles.chip,
              filter.status === item.status && styles.selected,
            ]}>
            <Text
              style={[
                styles.chipText,
                filter.status === item.status && styles.selectedText,
              ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Modal
        visible={modal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(null)}>
        <View style={styles.scrim}>
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text style={styles.title}>
              {modal === 'sites' ? 'Choisir un site' : 'Choisir les dates'}
            </Text>
            {modal === 'sites' ? (
              <>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{selected: !filter.siteId}}
                  style={styles.siteOption}
                  onPress={() => chooseSite()}>
                  <Text style={styles.siteName}>Tous les sites</Text>
                </TouchableOpacity>
                {loadingSites ? (
                  <LoadingView label="Chargement des sites" />
                ) : sitesError ? (
                  <ErrorView
                    label="La liste des sites est indisponible."
                    onRetry={onRetrySites}
                  />
                ) : (
                  <FlatList
                    data={sites}
                    keyExtractor={site => site.id}
                    style={styles.siteList}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({item}) => (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Site : ${item.name}`}
                        accessibilityState={{
                          selected: filter.siteId === item.id,
                        }}
                        style={[
                          styles.siteOption,
                          filter.siteId === item.id && styles.optionSelected,
                        ]}
                        onPress={() => chooseSite(item.id)}>
                        <Text style={styles.siteName}>{item.name}</Text>
                        {item.status !== 'ACTIVE' && (
                          <Text style={styles.hint}>
                            Site inactif · historique
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  />
                )}
              </>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.hint}>
                  Dates incluses, au format jj/mm/aaaa.
                </Text>
                <Text style={styles.label}>Du</Text>
                <TextInput
                  accessibilityLabel="Date de début"
                  value={from}
                  onChangeText={setFrom}
                  placeholder="02/11/2026"
                  maxLength={10}
                  style={styles.input}
                />
                <Text style={styles.label}>Au</Text>
                <TextInput
                  accessibilityLabel="Date de fin"
                  value={to}
                  onChangeText={setTo}
                  placeholder="02/11/2026"
                  maxLength={10}
                  style={styles.input}
                />
                {dateError && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    Indiquez des dates valides ; la fin doit être égale ou
                    postérieure au début.
                  </Text>
                )}
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.apply}
                  onPress={applyDates}>
                  <Text style={styles.selectedText}>Appliquer la période</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setModal(null)}
              style={styles.close}>
              <Text style={styles.resetText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    padding: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
  },
  label: {
    fontWeight: '700',
    fontSize: 12,
    color: colors.muted,
    marginBottom: 7,
    marginTop: 10,
  },
  siteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 8,
    backgroundColor: colors.background,
  },
  siteName: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
    flexGrow: 1,
  },
  chevron: {color: colors.navy, fontSize: 20},
  fieldLabel: {color: colors.muted, fontSize: 12, fontWeight: '600'},
  siteRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
  periods: {flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4},
  period: {
    flexGrow: 1,
    minHeight: 44,
    paddingHorizontal: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  statusScroll: {marginTop: 4},
  statuses: {gap: 4, alignItems: 'center'},
  chip: {
    minHeight: 44,
    borderRadius: 22,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: colors.background,
  },
  chipText: {color: colors.navy, fontSize: 12, fontWeight: '700'},
  selected: {backgroundColor: colors.navy},
  selectedText: {color: colors.surface, fontWeight: '700', fontSize: 12},
  hint: {color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7},
  reset: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetText: {color: colors.primary, fontSize: 13, fontWeight: '700'},
  resetIcon: {fontSize: 20},
  scrim: {
    flex: 1,
    padding: 20,
    backgroundColor: '#102D5080',
    justifyContent: 'center',
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    maxHeight: '85%',
  },
  title: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  siteList: {flexGrow: 0},
  siteOption: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  optionSelected: {backgroundColor: colors.primarySoft},
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.navy,
  },
  error: {color: colors.danger, marginTop: 10},
  apply: {
    minHeight: 48,
    backgroundColor: colors.navy,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  close: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
});
