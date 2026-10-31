import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {BatteryDevice} from '../types/battery';
import {batteryPresentation} from '../utils/batteryPresentation';
import {colors} from '../theme/colors';
export function BatteryDevices({devices}: {devices?: BatteryDevice[]}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  if (!devices?.length) {
    return <Text style={styles.muted}>Batterie indisponible</Text>;
  }
  return (
    <View>
      {devices.map(device => {
        const value = batteryPresentation(device, now);
        const color =
          value.severity === 'CRITICAL'
            ? colors.danger
            : value.severity === 'LOW'
            ? colors.warning
            : value.severity === 'UNKNOWN'
            ? colors.muted
            : colors.text;
        return (
          <View key={device.id} style={styles.row}>
            <Text style={[styles.text, {color}]}>
              {devices.length > 1
                ? 'Téléphone ' + device.id.slice(0, 6) + ' · '
                : ''}
              {value.text}
            </Text>
            <Text style={styles.muted}>{value.age}</Text>
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {marginTop: 8},
  text: {fontSize: 14, fontWeight: '700', flexShrink: 1},
  muted: {color: colors.muted, fontSize: 12, marginTop: 4, flexShrink: 1},
});
