import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import { Banner, Button, Card, Gap, H1, P, Pill, Screen } from '../../ui/ui';

export default function AccountScreen({ navigation }) {
  const { user, refresh, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { refresh().catch(() => {}); }, [refresh]));
  const pull = async () => { setRefreshing(true); await refresh().catch(() => {}); setRefreshing(false); };

  return (
    <Screen onRefresh={pull} refreshing={refreshing}>
      <H1>{user.name}</H1>
      <P muted>{user.email}</P>
      <Gap />
      <Card>
        <P style={{ fontWeight: '700', marginBottom: 8 }}>ID verification</P>
        {user.isVerified ? (
          <Pill label="Verified" tone="good" />
        ) : (
          <>
            <Pill label="Not verified" tone="warn" />
            <P muted style={{ marginVertical: 8 }}>You need an approved ID to send or carry packages.</P>
            <Button title="Verify my ID" onPress={() => navigation.navigate('Verification')} />
          </>
        )}
      </Card>
      {user.role === 'admin' ? <Banner type="info">Admin tools (payouts and disputes) are on the website.</Banner> : null}
      <Button title="Terms and prohibited items" variant="secondary" onPress={() => navigation.navigate('Rules')} />
      <Button title="Log out" variant="secondary" onPress={signOut} testID="logout" />
    </Screen>
  );
}
