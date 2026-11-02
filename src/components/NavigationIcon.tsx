import React from 'react';
import {StyleSheet, View} from 'react-native';
import type {MainTabParamList} from '../types/navigation';

type IconProps = {color: string; size: number};
/** Small native shapes: no font assets, network request or icon dependency. */
export function NavigationIcon({
  name,
  color,
  size,
}: IconProps & {name: keyof MainTabParamList}) {
  const stroke = {borderColor: color};
  const line = {backgroundColor: color};
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View style={styles.canvas}>
        {name === 'Home' ? (
          <>
            <View style={[styles.roofLeft, line]} />
            <View style={[styles.roofRight, line]} />
            <View style={[styles.house, stroke]} />
            <View style={[styles.door, stroke]} />
          </>
        ) : name === 'Rounds' ? (
          <>
            <View style={[styles.clipboard, stroke]} />
            <View style={[styles.clip, stroke]} />
            {[8, 12, 16].map(top => (
              <View key={top} style={[styles.listLine, line, {top}]} />
            ))}
          </>
        ) : name === 'Agents' ? (
          <>
            <View style={[styles.head, stroke]} />
            <View style={[styles.body, stroke]} />
            <View style={[styles.secondHead, stroke]} />
            <View style={[styles.secondBody, stroke]} />
          </>
        ) : (
          <>
            {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
              <View
                key={angle}
                style={[
                  styles.spoke,
                  line,
                  {transform: [{rotate: `${angle}deg`}, {translateY: -9}]},
                ]}
              />
            ))}
            <View style={[styles.gear, stroke]} />
            <View style={[styles.gearCenter, stroke]} />
          </>
        )}
      </View>
    </View>
  );
}
export const HomeIcon = (props: IconProps) => (
  <NavigationIcon {...props} name="Home" />
);
export const RoundsIcon = (props: IconProps) => (
  <NavigationIcon {...props} name="Rounds" />
);
export const AgentsIcon = (props: IconProps) => (
  <NavigationIcon {...props} name="Agents" />
);
export const SettingsIcon = (props: IconProps) => (
  <NavigationIcon {...props} name="Settings" />
);
const styles = StyleSheet.create({
  canvas: {width: 24, height: 24},
  roofLeft: {
    position: 'absolute',
    width: 13,
    height: 2,
    left: 1,
    top: 6,
    transform: [{rotate: '-40deg'}],
  },
  roofRight: {
    position: 'absolute',
    width: 13,
    height: 2,
    right: 1,
    top: 6,
    transform: [{rotate: '40deg'}],
  },
  house: {
    position: 'absolute',
    top: 10,
    left: 4,
    width: 16,
    height: 11,
    borderWidth: 1.6,
    borderTopWidth: 0,
    borderRadius: 2,
  },
  door: {
    position: 'absolute',
    top: 14,
    left: 10,
    width: 5,
    height: 7,
    borderWidth: 1.5,
    borderBottomWidth: 0,
  },
  clipboard: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 16,
    height: 18,
    borderWidth: 1.6,
    borderRadius: 3,
  },
  clip: {
    position: 'absolute',
    left: 9,
    top: 2,
    width: 6,
    height: 4,
    borderWidth: 1.5,
    borderRadius: 1,
  },
  listLine: {
    position: 'absolute',
    left: 8,
    height: 1.5,
    width: 8,
    borderRadius: 1,
  },
  head: {
    position: 'absolute',
    left: 4,
    top: 3,
    width: 7,
    height: 7,
    borderWidth: 1.6,
    borderRadius: 4,
  },
  body: {
    position: 'absolute',
    left: 1,
    top: 12,
    width: 13,
    height: 9,
    borderWidth: 1.6,
    borderRadius: 5,
  },
  secondHead: {
    position: 'absolute',
    right: 3,
    top: 6,
    width: 6,
    height: 6,
    borderWidth: 1.6,
    borderRadius: 4,
  },
  secondBody: {
    position: 'absolute',
    right: 0,
    top: 14,
    width: 8,
    height: 7,
    borderWidth: 1.6,
    borderRadius: 4,
  },
  spoke: {
    position: 'absolute',
    top: 10,
    left: 11,
    width: 2,
    height: 4,
    borderRadius: 1,
  },
  gear: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 16,
    height: 16,
    borderWidth: 1.6,
    borderRadius: 9,
  },
  gearCenter: {
    position: 'absolute',
    top: 9,
    left: 9,
    width: 6,
    height: 6,
    borderWidth: 1.6,
    borderRadius: 4,
  },
});
