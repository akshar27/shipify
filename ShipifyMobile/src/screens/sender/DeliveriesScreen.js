import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api, { errMsg } from '../../lib/api';
import { senderStatus } from '../../lib/format';
import { Banner, Button, Card, Gap, P, Pill, Screen, Spinner } from '../../ui/ui';
import VerifyBanner from '../../ui/VerifyBanner';

export default function DeliveriesScreen({ navigation }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setItems((await api.get('/deliveries/mine')).data);
    } catch (e) {
      setError(errMsg(e));
      setItems((cur) => cur || []);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!items) return <Spinner />;

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <VerifyBanner navigation={navigation} />
      <Banner type="error">{error}</Banner>
      <Button title="New delivery" onPress={() => navigation.navigate('CreateDelivery')} testID="new-delivery" />
      <Gap />
      {items.length === 0 && !error ? <P muted style={{ textAlign: 'center', marginTop: 24 }}>You haven't sent anything yet.</P> : null}
      {items.map((d) => {
        const st = senderStatus(d);
        return (
          <Card key={d.id} onPress={() => navigation.navigate('DeliveryDetail', { id: d.id })}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <Text style={{ fontWeight: '700', fontSize: 16, flex: 1 }}>{d.pickup} → {d.dropoff}</Text>
              <Pill label={st.label} tone={st.tone} />
            </View>
            <P muted style={{ marginTop: 6 }}>{d.itemType} · {d.size} · {d.weight} kg</P>
          </Card>
        );
      })}
    </Screen>
  );
}
