import React, {useState} from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {SiteItem} from '../types/api';
import type {AgentFilters} from '../query/agentsQuery';
import {colors} from '../theme/colors';
import {ErrorView, LoadingView} from './StateViews';

export function AgentsFilters({
  filter,
  onChange,
  sites,
  loading,
  error,
  retry,
}: {
  filter: AgentFilters;
  onChange: (next: AgentFilters) => void;
  sites: SiteItem[];
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = sites.find(site => site.id === filter.siteId);
  return (
    <View style={styles.filters}>
      <TextInput
        accessibilityLabel="Rechercher un agent"
        placeholder="Recherche par nom"
        value={filter.search}
        onChangeText={search => onChange({...filter, search})}
        autoCorrect={false}
        style={styles.search}
      />
      <View style={styles.row}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Filtrer les agents par site"
          style={styles.site}
          onPress={() => setOpen(true)}>
          <Text style={styles.siteText}>
            {selected?.name ??
              (filter.siteId ? 'Site sélectionné' : 'Tous les sites')}
          </Text>
          <Text accessible={false} style={styles.arrow}>
            ⌄
          </Text>
        </TouchableOpacity>
        {[
          {label: "Aujourd'hui", period: 'today' as const},
          {label: '7 jours', period: '7d' as const},
        ].map(item => (
          <TouchableOpacity
            key={item.period}
            accessibilityRole="button"
            accessibilityState={{selected: filter.period === item.period}}
            onPress={() => onChange({...filter, period: item.period})}
            style={[
              styles.period,
              filter.period === item.period && styles.selected,
            ]}>
            <Text
              style={
                filter.period === item.period
                  ? styles.selectedText
                  : styles.periodText
              }>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <View style={styles.scrim}>
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text style={styles.title}>Choisir un site</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.option}
              onPress={() => {
                onChange({...filter, siteId: undefined});
                setOpen(false);
              }}>
              <Text style={styles.siteText}>Tous les sites</Text>
            </TouchableOpacity>
            {loading ? (
              <LoadingView label="Chargement des sites" />
            ) : error ? (
              <ErrorView
                label="La liste des sites est indisponible."
                onRetry={retry}
              />
            ) : (
              <FlatList
                data={sites}
                keyExtractor={site => site.id}
                style={styles.options}
                renderItem={({item}) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Site : ${item.name}`}
                    accessibilityState={{selected: filter.siteId === item.id}}
                    style={styles.option}
                    onPress={() => {
                      onChange({...filter, siteId: item.id});
                      setOpen(false);
                    }}>
                    <Text style={styles.siteText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.close}
              onPress={() => setOpen(false)}>
              <Text style={styles.periodText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  filters: {marginHorizontal: 16, marginTop: 8, marginBottom: 6},
  search: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.navy,
  },
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4},
  site: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 115,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  siteText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
    flexGrow: 1,
  },
  arrow: {color: colors.navy, fontSize: 18},
  period: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  periodText: {color: colors.navy, fontSize: 12, fontWeight: '700'},
  selected: {backgroundColor: colors.navy},
  selectedText: {color: colors.surface, fontSize: 12, fontWeight: '700'},
  scrim: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#102D5080',
  },
  dialog: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.surface,
    maxHeight: '85%',
  },
  title: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  option: {minHeight: 48, paddingVertical: 12, paddingHorizontal: 8},
  options: {flexGrow: 0},
  close: {minHeight: 44, justifyContent: 'center', alignItems: 'center'},
});
