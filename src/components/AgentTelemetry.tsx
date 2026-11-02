import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {BatteryDevice} from '../types/battery';
import type {GpsIndicator} from '../utils/agentGpsPresentation';
import {BatteryDevices} from './BatteryDevices';
import {colors} from '../theme/colors';

const gpsLabels = {
  RECENT: 'Position récente',
  OLD: 'Position ancienne',
  UNAVAILABLE: 'Position indisponible',
};
export function AgentTelemetry({
  devices,
  receivedAt,
  nowElapsed,
  gps,
}: {
  devices?: BatteryDevice[];
  receivedAt?: number;
  nowElapsed: number;
  gps: GpsIndicator;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.battery}>
        <BatteryDevices
          devices={devices}
          compact
          dense
          receivedAt={receivedAt}
          nowElapsed={nowElapsed}
        />
      </View>
      <View style={styles.position}>
        <Text
          accessible={false}
          style={[
            styles.icon,
            {
              color:
                gps === 'RECENT'
                  ? colors.success
                  : gps === 'OLD'
                  ? colors.warning
                  : colors.muted,
            },
          ]}>
          ⌖
        </Text>
        <Text style={styles.text}>GPS · {gpsLabels[gps]}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    columnGap: 10,
    rowGap: 4,
    marginTop: 5,
  },
  battery: {flexShrink: 1, maxWidth: '100%'},
  position: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
    maxWidth: '100%',
  },
  icon: {fontSize: 13},
  text: {color: colors.muted, fontSize: 11, flexShrink: 1},
});
