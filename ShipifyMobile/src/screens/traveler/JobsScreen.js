import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api, { errMsg } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { CARRYING, isMine, money } from '../../lib/format';
import { Banner, Button, Card, Field, Gap, H1, P, Pill, Screen, Spinner } from '../../ui/ui';
import VerifyBanner from '../../ui/VerifyBanner';

const MINE_LABEL = {
  accepted: ['Pick it up', 'info'], 'in-transit': ['On the way', 'info'], delivered: ['Delivered: awaiting confirmation', 'warn'],
  confirmed: ['Confirmed: payout due', 'good'], disputed: ['Under review', 'bad'],
};

export default function JobsScreen({ navigation }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState('');
  const [codes, setCodes] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const say = (type, text) => setMsg({ type, text });

  const load = useCallback(async () => {
    try {
      const rows = (await api.get('/match/matches-for-traveler')).data;
      const seen = new Set();
      setJobs(rows.map((r) => r.delivery).filter((d) => d && !seen.has(d.id) && seen.add(d.id)));
    } catch (e) {
      say('error', errMsg(e));
      setJobs((cur) => cur || []);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const accept = (d) => async () => {
    setBusy(d.id); setMsg(null);
    try {
      await api.patch(`/deliveries/${d.id}/accept`);
      await load();
      say('success', 'Accepted! Pick up the package, then deliver it and enter the code from the recipient.');
    } catch (e) {
      say('error', errMsg(e));
      await load(); // someone else may have taken it
    } finally {
      setBusy('');
    }
  };

  const complete = (d) => async () => {
    const code = (codes[d.id] || '').trim();
    if (!/^\d{6}$/.test(code)) return say('error', 'Enter the 6-digit code from the recipient.');
    setBusy(d.id); setMsg(null);
    try {
      await api.patch(`/deliveries/${d.id}/complete`, { code });
      await load();
      say('success', "Delivery recorded. You'll be paid once the sender confirms (or automatically after the window).");
    } catch (e) {
      say('error', errMsg(e));
    } finally {
      setBusy('');
    }
  };

  if (!jobs) return <Spinner />;
  const mine = jobs.filter((d) => isMine(d, user.id));
  const open = jobs.filter((d) => !isMine(d, user.id));

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <VerifyBanner navigation={navigation} />
      <Banner type={msg?.type}>{msg?.text}</Banner>
      <Button title="Post a trip" onPress={() => navigation.navigate('PostTrip')} testID="post-trip" />
      <Gap />

      {mine.length > 0 && <H1>Your jobs</H1>}
      {mine.map((d) => {
        const [label, tone] = MINE_LABEL[d.status] || [d.status, 'neutral'];
        return (
          <Card key={d.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ fontWeight: '700', fontSize: 16, flex: 1 }}>{d.pickup} → {d.dropoff}</Text>
              <Pill label={label} tone={tone} />
            </View>
            <P muted style={{ marginTop: 6 }}>{d.itemType} · {d.size} · {d.weight} kg</P>
            {CARRYING.includes(d.status) && (
              <View style={{ marginTop: 12 }}>
                <Field
                  label="Handover code"
                  hint="Ask the recipient for the 6-digit code from the sender's app."
                  value={codes[d.id] || ''}
                  onChangeText={(v) => setCodes((c) => ({ ...c, [d.id]: v.replace(/\D/g, '').slice(0, 6) }))}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Button title="Mark delivered" onPress={complete(d)} loading={busy === d.id} testID={`complete-${d.id}`} />
              </View>
            )}
          </Card>
        );
      })}

      <H1 style={{ marginTop: 8 }}>Packages going your way</H1>
      {open.length === 0 && <P muted>Nothing matches your trips yet. Post a trip and check back, or pull down to refresh.</P>}
      {open.map((d) => (
        <Card key={d.id}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{d.pickup} → {d.dropoff}</Text>
          <P muted style={{ marginTop: 6 }}>
            {d.itemType} · {d.size} · {d.weight} kg{d.declaredValueCents != null ? ` · worth ${money(d.declaredValueCents)}` : ''}
          </P>
          {d.sender?.name ? <P muted>Sender: {d.sender.name.split(' ')[0]}</P> : null}
          <P muted style={{ marginTop: 6 }}>Don't open the package, and say no if anything looks wrong.</P>
          <Button title="Accept" onPress={accept(d)} loading={busy === d.id} testID={`accept-${d.id}`} />
        </Card>
      ))}
    </Screen>
  );
}
