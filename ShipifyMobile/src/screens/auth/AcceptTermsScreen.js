import React, { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { errMsg } from '../../lib/api';
import { Banner, Button, Check, H1, P, Screen } from '../../ui/ui';
import { colors } from '../../ui/theme';

export default function AcceptTermsScreen({ navigation }) {
  const { acceptTerms, signOut } = useAuth();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await acceptTerms();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <H1>Please accept the Terms</H1>
      <P style={{ marginBottom: 16 }}>Our Terms and the list of items you may not send have changed (or you signed up before they existed). You need to accept them to send or carry packages.</P>
      <Banner type="error">{error}</Banner>
      <Check checked={agree} onChange={setAgree}>
        <P>
          I accept the Terms and agree not to send anything on the{' '}
          <Text style={{ color: colors.primary, textDecorationLine: 'underline' }} onPress={() => navigation.navigate('Rules')}>prohibited items list</Text>.
        </P>
      </Check>
      <Button title="Accept and continue" onPress={submit} loading={busy} disabled={!agree} />
      <Button title="Log out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
