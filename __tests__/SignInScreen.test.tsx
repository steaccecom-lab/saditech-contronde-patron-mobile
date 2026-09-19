import React from 'react';
import {Alert} from 'react-native';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import {SignInScreen} from '../src/screens/SignInScreen';
import {signIn} from '../src/services/authApi';
jest.mock('../src/services/authApi', () => ({
  signIn: jest.fn().mockResolvedValue(undefined),
}));
it('toggles password visibility without changing the entered value', () => {
  const view = render(<SignInScreen />);
  fireEvent.changeText(view.getByLabelText('Mot de passe'), 'secret test');
  expect(view.getByLabelText('Mot de passe').props.secureTextEntry).toBe(true);
  fireEvent.press(view.getByRole('button', {name: 'Afficher le mot de passe'}));
  expect(view.getByLabelText('Mot de passe').props.secureTextEntry).toBe(false);
  expect(view.getByLabelText('Mot de passe').props.value).toBe('secret test');
  fireEvent.press(view.getByRole('button', {name: 'Masquer le mot de passe'}));
  expect(view.getByLabelText('Mot de passe').props.secureTextEntry).toBe(true);
});
it('shows branding and the honest recovery message', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const view = render(<SignInScreen />);
  expect(view.getByLabelText('SADITECH PRO')).toBeTruthy();
  expect(view.getByText('Supervision des rondes en temps réel')).toBeTruthy();
  fireEvent.press(view.getByText('Mot de passe oublié ?'));
  expect(alert).toHaveBeenCalledWith(
    'Mot de passe oublié ?',
    'Récupération du mot de passe bientôt disponible. Veuillez contacter votre administrateur.',
  );
  alert.mockRestore();
});
it('preserves the login request and trims only the email', async () => {
  const view = render(<SignInScreen />);
  fireEvent.changeText(view.getByLabelText('Email'), ' admin@example.test ');
  fireEvent.changeText(view.getByLabelText('Mot de passe'), ' test ');
  fireEvent.press(view.getByText('Se connecter'));
  await waitFor(() =>
    expect(signIn).toHaveBeenCalledWith('admin@example.test', ' test '),
  );
});
