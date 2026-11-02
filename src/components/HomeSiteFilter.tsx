import React, {useState} from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {SiteItem} from '../types/api';
import {colors} from '../theme/colors';
import {ErrorView, LoadingView} from './StateViews';

export function HomeSiteFilter({
  sites,
  siteId,
  onChange,
  pending,
  error,
  retry,
}: {
  sites: SiteItem[];
  siteId?: string;
  onChange: (id?: string) => void;
  pending: boolean;
  error: boolean;
  retry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const choose = (id?: string) => {
    onChange(id);
    setOpen(false);
  };
  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Filtrer l'accueil par site"
        onPress={() => setOpen(true)}
        style={styles.filter}>
        <Text style={styles.label}>Site</Text>
        <Text style={styles.value}>
          {sites.find(site => site.id === siteId)?.name ??
            (siteId ? 'Site sélectionné' : 'Tous les sites')}
        </Text>
        <Text accessible={false} style={styles.arrow}>
          ⌄
        </Text>
      </TouchableOpacity>
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
              accessibilityState={{selected: !siteId}}
              onPress={() => choose()}
              style={styles.option}>
              <Text style={styles.value}>Tous les sites</Text>
            </TouchableOpacity>
            {pending ? (
              <LoadingView label="Chargement des sites" />
            ) : error ? (
              <ErrorView
                label="La liste des sites est indisponible."
                onRetry={retry}
              />
            ) : (
              <FlatList
                data={sites}
                style={styles.options}
                keyExtractor={site => site.id}
                renderItem={({item}) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Site : ${item.name}`}
                    accessibilityState={{selected: item.id === siteId}}
                    onPress={() => choose(item.id)}
                    style={styles.option}>
                    <Text style={styles.value}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={styles.option}>
              <Text style={styles.label}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  filter: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  label: {fontSize: 12, color: colors.muted, fontWeight: '700'},
  value: {
    fontSize: 14,
    color: colors.navy,
    fontWeight: '700',
    flexShrink: 1,
    flexGrow: 1,
  },
  arrow: {fontSize: 20, color: colors.navy},
  scrim: {
    flex: 1,
    backgroundColor: '#102D5080',
    padding: 20,
    justifyContent: 'center',
  },
  dialog: {
    backgroundColor: colors.surface,
    padding: 18,
    borderRadius: 20,
    maxHeight: '85%',
  },
  title: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  options: {flexGrow: 0},
  option: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
});
