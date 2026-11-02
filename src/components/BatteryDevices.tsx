import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {BatteryDevice} from '../types/battery';
import {batteryPresentation} from '../utils/batteryPresentation';
import {gpsElapsedTime} from '../services/gpsClock';
import {colors} from '../theme/colors';

export function BatteryDevices({
  devices,
  compact = false,
  receivedAt,
  nowElapsed = gpsElapsedTime(),
}: {
  devices?: BatteryDevice[];
  compact?: boolean;
  receivedAt?: number;
  nowElapsed?: number;
}) {
  if (!devices?.length) {
    return <Text style={styles.muted}>Batterie indisponible</Text>;
  }
  const elapsed =
    receivedAt !== undefined &&
    Number.isFinite(receivedAt) &&
    nowElapsed >= receivedAt
      ? nowElapsed - receivedAt
      : undefined;
  return (
    <View style={styles.devices}>
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
const styles = StyleSheet.create({
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
