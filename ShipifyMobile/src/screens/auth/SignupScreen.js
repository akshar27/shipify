import React, { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { errMsg } from '../../lib/api';
import { Banner, Button, Check, Field, H1, P, Screen } from '../../ui/ui';
import { colors } from '../../ui/theme';

export default function SignupScreen({ navigation }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError('');
    if (!form.name.trim()) return setError('Enter your name.');
    if (!form.email.trim()) return setError('Enter your email.');
    if (form.password.length < 8) return setError('Your password needs at least 8 characters.');
    if (!agree) return setError('You must accept the Terms and the prohibited-items rules to create an account.');
    setBusy(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      setDone(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen>
        <H1>Check your email</H1>
        <P>We sent a link to {form.email.trim()}. Open it to verify your address, then come back and log in.</P>
        <Button title="Back to log in" onPress={() => navigation.navigate('Login')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Banner type="error">{error}</Banner>
      <Field label="Full name" value={form.name} onChangeText={set('name')} autoComplete="name" textContentType="name" />
      <Field label="Email" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label="Password" value={form.password} onChangeText={set('password')} secureTextEntry hint="At least 8 characters" textContentType="newPassword" />
      <Check checked={agree} onChange={setAgree}>
        <P>
          I accept the Terms and agree not to send anything on the{' '}
          <Text style={{ color: colors.primary, textDecorationLine: 'underline' }} onPress={() => navigation.navigate('Rules')}>prohibited items list</Text>.
        </P>
      </Check>
      <Button title="Create account" onPress={submit} loading={busy} />
    </Screen>
  );
}
