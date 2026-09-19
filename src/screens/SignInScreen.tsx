import React, {useState} from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {signIn} from '../services/authApi';
import {colors} from '../theme/colors';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      Alert.alert(
        'Connexion impossible',
        error instanceof Error ? error.message : 'Vérifiez vos identifiants.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <Image
            source={require('../../assets/branding/saditech-pro-logo.png')}
            accessibilityLabel="SADITECH PRO"
            resizeMode="contain"
            style={styles.logo}
          />
          <Text style={styles.eyebrow}>ESPACE SUPERVISION</Text>
          <Text style={styles.title}>Contronde Patron</Text>
          <Text style={styles.subtitle}>
            Supervision des rondes en temps réel
          </Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.formTitle}>Bienvenue</Text>
          <Text style={styles.hint}>
            Connectez-vous à votre espace de supervision.
          </Text>
          <Text style={styles.label}>Adresse e-mail</Text>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.passwordRow}>
            <TextInput
              accessibilityLabel="Mot de passe"
              placeholder="Mot de passe"
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
              }
              accessibilityState={{selected: visible}}
              onPress={() => setVisible(value => !value)}
              style={styles.eyeButton}>
              <View accessible={false} style={styles.eye}>
                <View style={styles.pupil} />
                {visible && <View style={styles.slash} />}
              </View>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.forgot}
            onPress={() =>
              Alert.alert(
                'Mot de passe oublié ?',
                'Récupération du mot de passe bientôt disponible. Veuillez contacter votre administrateur.',
              )
            }>
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={loading || !email || !password}
            style={[
              styles.button,
              (loading || !email || !password) && styles.disabled,
            ]}
            onPress={submit}>
            <Text style={styles.buttonText}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {flexGrow: 1, justifyContent: 'center', padding: 24},
  brand: {marginBottom: 24},
  logo: {
    width: 156,
    height: 90,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 24,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '800',
    marginBottom: 8,
  },
  form: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
  },
  formTitle: {color: colors.navy, fontSize: 22, fontWeight: '800'},
  hint: {color: colors.muted, lineHeight: 21, marginTop: 6, marginBottom: 22},
  label: {color: colors.text, fontWeight: '700', marginBottom: 8},
  passwordRow: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.text,
  },
  eyeButton: {
    minWidth: 48,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eye: {
    width: 24,
    height: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pupil: {width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted},
  slash: {
    position: 'absolute',
    width: 28,
    height: 2,
    backgroundColor: colors.muted,
    transform: [{rotate: '-40deg'}],
  },
  forgot: {
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginVertical: 4,
  },
  forgotText: {color: colors.primary, fontWeight: '700'},
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    fontSize: 17,
    color: colors.muted,
    lineHeight: 24,
    marginTop: 6,
  },
  input: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    marginBottom: 12,
    fontSize: 17,
    color: colors.text,
  },
  button: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  disabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: '800',
  },
});
