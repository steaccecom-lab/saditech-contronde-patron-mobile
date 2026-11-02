import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {BatteryDevice} from '../types/battery';
import {batteryPresentation} from '../utils/batteryPresentation';
import {gpsElapsedTime} from '../services/gpsClock';
import {colors} from '../theme/colors';

export function BatteryDevices({
  devices,
  compact = false,
  dense = false,
  receivedAt,
  nowElapsed = gpsElapsedTime(),
}: {
  devices?: BatteryDevice[];
  compact?: boolean;
  dense?: boolean;
  receivedAt?: number;
  nowElapsed?: number;
}) {
  if (!devices?.length) {
    if (dense) {
      return (
        <View
          accessibilityLabel="Batterie indisponible"
          style={styles.denseLine}>
          <BatteryIcon color={colors.muted} />
          <Text style={styles.denseMuted}>Indisponible</Text>
        </View>
      );
    }
    return <Text style={styles.muted}>Batterie indisponible</Text>;
  }
  const elapsed =
    receivedAt !== undefined &&
    Number.isFinite(receivedAt) &&
    nowElapsed >= receivedAt
      ? nowElapsed - receivedAt
      : undefined;
  return (
    <View style={dense ? styles.denseDevices : styles.devices}>
      {devices.map(device => {
        const value = batteryPresentation(device, elapsed);
        const color =
          value.freshness !== 'RECENT'
            ? colors.muted
            : value.classification === 'CRITICAL'
            ? colors.danger
            : value.classification === 'LOW'
            ? colors.warning
            : value.classification === 'NORMAL'
            ? colors.success
            : colors.muted;
        const short = device.id.slice(-8);
        const label =
          compact && devices.filter(row => row.id.endsWith(short)).length === 1
            ? short
            : device.id;
        if (dense) {
          const available = value.text !== 'Batterie indisponible';
          const age =
            value.freshness === 'OLD'
              ? ' · ancienne'
              : value.freshness === 'UNAVAILABLE'
              ? ' · âge inconnu'
              : '';
          return (
            <View
              key={device.id}
              accessibilityLabel={`Appareil ${device.id}`}
              style={styles.denseLine}>
              {devices.length > 1 && (
                <Text style={styles.denseMuted}>Tél. {label}</Text>
              )}
              <BatteryIcon color={color} />
              <Text
                accessibilityLabel={`${value.text}. ${value.age}`}
                style={[styles.denseText, {color}]}>
                {available ? `${device.batteryLevel} %${age}` : 'Indisponible'}
              </Text>
            </View>
          );
        }
        return (
          <View
            key={device.id}
            style={styles.row}
            accessibilityLabel={`Appareil ${device.id}`}>
            {devices.length > 1 && (
              <Text style={styles.deviceLabel}>Téléphone {label}</Text>
            )}
            <View style={styles.measure}>
              <Text style={[styles.text, {color}]}>{value.text}</Text>
              <Text style={styles.muted}>{value.age}</Text>
            </View>
            {!compact && (
              <>
                <Text style={styles.muted}>
                  Dernière mesure : {value.capturedLabel}
                </Text>
                {device.batteryChargingStatus === 'CHARGING' && (
                  <Text style={styles.muted}>En charge</Text>
                )}
                {device.batteryChargingStatus === 'FULL' && (
                  <Text style={styles.muted}>Charge complète</Text>
                )}
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}
function BatteryIcon({color}: {color: string}) {
  return (
    <View accessible={false} style={[styles.icon, {borderColor: color}]}>
      <View style={[styles.iconFill, {backgroundColor: color}]} />
      <View style={[styles.iconTip, {backgroundColor: color}]} />
    </View>
  );
}
const styles = StyleSheet.create({
  denseDevices: {gap: 3, maxWidth: '100%'},
  denseLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  denseText: {fontSize: 11, fontWeight: '700', flexShrink: 1},
  denseMuted: {fontSize: 11, color: colors.muted, flexShrink: 1},
  icon: {
    width: 13,
    height: 9,
    borderWidth: 1,
    borderRadius: 2,
    padding: 1,
    marginRight: 2,
  },
  iconFill: {width: 5, flex: 1},
  iconTip: {position: 'absolute', width: 2, height: 3, right: -3, top: 2},
  devices: {gap: 8},
  row: {marginTop: 4},
  deviceLabel: {color: colors.muted, fontSize: 11, marginBottom: 3},
  measure: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  text: {fontSize: 14, fontWeight: '800', flexShrink: 1},
  muted: {color: colors.muted, fontSize: 12, flexShrink: 1, lineHeight: 18},
});
