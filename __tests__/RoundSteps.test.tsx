import React from 'react';
import {render} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import {RoundSteps} from '../src/components/RoundSteps';
import {colors} from '../src/theme/colors';

it('displays the measured server count', () => {
  expect(
    render(<RoundSteps round={{stepCount: 321, stepTrackingStatus: 'AVAILABLE'}} />).getByText(
      'Nombre de pas : 321',
    ),
  ).toBeTruthy();
});
it('warns only for an available, exactly zero measurement', () => {
  const view = render(<RoundSteps round={{stepCount: 0, stepTrackingStatus: 'AVAILABLE'}} />);
  expect(StyleSheet.flatten(view.getByText('0 pas — Aucun pas détecté !').props.style).color).toBe(
    colors.danger,
  );
  expect(view.getByText('⚠')).toBeTruthy();
});
it.each([
  {},
  {stepCount: null, stepTrackingStatus: 'AVAILABLE'},
  {stepCount: 0, stepTrackingStatus: 'PARTIAL'},
  {stepCount: 120, stepTrackingStatus: 'PARTIAL'},
  {stepCount: 0, stepTrackingStatus: 'UNAVAILABLE'},
  {stepCount: 0, stepTrackingStatus: 'UNSUPPORTED'},
  {stepCount: 0, stepTrackingStatus: 'DENIED'},
  {stepCount: 0},
  {stepCount: -1, stepTrackingStatus: 'AVAILABLE'},
])('keeps unknown or incomplete measurements neutral: %j', (round) => {
  const view = render(<RoundSteps round={round} />);
  expect(StyleSheet.flatten(view.getByText('Nombre de pas indisponible').props.style).color).toBe(
    colors.muted,
  );
  expect(view.queryByText('0 pas — Aucun pas détecté !')).toBeNull();
});
