import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import api, { errMsg } from '../../lib/api';
import { Banner, Button, Field, Gap, H1, P, Screen } from '../../ui/ui';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsVerify, setNeedsVerify] = useState(false);

  const submit = async () => {
    setError(''); setNotice(''); setNeedsVerify(false);
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(errMsg(e));
      setNeedsVerify(e.response?.status === 401);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await api.post('/auth/resend-verification', { email: email.trim() });
      setNotice('If that account exists, we sent a new verification email.');
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <Screen style={{ paddingTop: 80 }}>
      <H1 style={{ fontSize: 32 }}>Shipify</H1>
      <P muted>Send a package with someone already going your way.</P>
      <Gap h={24} />
      <Banner type="error">{error}</Banner>
      <Banner type="success">{notice}</Banner>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      <Button title="Log in" onPress={submit} loading={busy} />
      {needsVerify ? <Button title="Resend verification email" variant="secondary" onPress={resend} /> : null}
      <View style={{ marginTop: 16 }}>
        <Button title="Create an account" variant="secondary" onPress={() => navigation.navigate('Signup')} />
      </View>
    </Screen>
  );
}
