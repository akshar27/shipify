import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import api, { errMsg } from '../../lib/api';
import { money, senderActions, senderStatus } from '../../lib/format';
import { Banner, Button, Card, Field, Gap, H1, P, Pill, Screen, Spinner } from '../../ui/ui';
import { colors } from '../../ui/theme';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function DeliveryDetailScreen({ route }) {
  const { id, justCreated } = route.params;
  const [d, setD] = useState(null);
  const [rated, setRated] = useState(false);
  const [msg, setMsg] = useState(justCreated ? { type: 'success', text: 'Delivery created. Pay to make it visible to travelers.' } : null);
  const [busy, setBusy] = useState('');
  const [code, setCode] = useState(null);
  const [panel, setPanel] = useState(null); // 'confirm' | 'report' | null
  const [reason, setReason] = useState('');
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const say = (type, text) => setMsg({ type, text });

  const load = useCallback(async () => {
    try {
      const list = (await api.get('/deliveries/mine')).data;
      const found = list.find((x) => x.id === id);
      if (!found) return say('error', 'We could not find this delivery.');
      setD(found);
      if (found.status === 'confirmed') {
        const r = await api.get(`/ratings/delivery/${id}`);
        setRated(!!r.data);
      }
    } catch (e) {
      say('error', errMsg(e));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const run = (name, fn) => async () => {
    setBusy(name); setMsg(null);
    try { await fn(); } catch (e) { say('error', errMsg(e)); } finally { setBusy(''); }
  };

  // Payment happens on Stripe's page. Coming back proves nothing: only the server's record (set by Stripe's webhook) counts,
  // so wait for it to show up.
  const pay = run('pay', async () => {
    const { data } = await api.post('/payments/create-checkout-session', { deliveryId: id });
    await WebBrowser.openBrowserAsync(data.url);
    for (let i = 0; i < 8; i++) {
      const { data: s } = await api.get(`/payments/delivery/${id}`);
      if (s.paymentStatus === 'paid') { await load(); return say('success', "Payment received. We'll tell you when a traveler accepts."); }
      await sleep(2000);
    }
    say('info', "We haven't received your payment yet. If you paid, it can take a minute: pull down to refresh.");
  });

  const showCode = run('code', async () => setCode((await api.get(`/deliveries/${id}/handover-code`)).data.code));

  const confirm = run('confirm', async () => {
    await api.post(`/deliveries/${id}/confirm`);
    setPanel(null); await load(); say('success', 'Thanks! The traveler will be paid.');
  });

  const report = run('report', async () => {
    if (reason.trim().length < 10) return say('error', 'Please describe what went wrong (at least 10 characters).');
    await api.post(`/deliveries/${id}/dispute`, { reason: reason.trim() });
    setPanel(null); setReason(''); await load(); say('success', "Thanks, an admin will look into it. We'll email you the outcome.");
  });

  const rate = run('rate', async () => {
    if (!stars) return say('error', 'Choose 1 to 5 stars.');
    await api.post('/ratings', { deliveryId: id, rating: stars, comment: comment.trim() || undefined });
    setRated(true); say('success', 'Thanks for rating!');
  });

  if (!d) return msg ? <Screen><Banner type={msg.type}>{msg.text}</Banner></Screen> : <Spinner />;

  const st = senderStatus(d);
  const actions = senderActions(d, { rated });
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Banner type={msg?.type}>{msg?.text}</Banner>
      <H1>{d.pickup} → {d.dropoff}</H1>
      <Pill label={st.label} tone={st.tone} />
      <P muted style={{ marginTop: 8, marginBottom: 12 }}>{st.hint}</P>

      <Card>
        <P>{d.itemType} · {d.size} · {d.weight} kg</P>
        {d.declaredValueCents != null ? <P muted>Declared value {money(d.declaredValueCents)}</P> : null}
      </Card>

      {actions.includes('pay') && <Button title="Pay and publish" onPress={pay} loading={busy === 'pay'} testID="pay" />}

      {actions.includes('code') && (
        <Card>
          <P style={{ fontWeight: '700', marginBottom: 6 }}>Handover code</P>
          <P muted>Show this to the person receiving the package. They give it to the traveler, which proves it was handed over. Don't send it to the traveler yourself.</P>
          {code ? (
            <Text accessibilityLabel={`Handover code ${code}`} style={{ fontSize: 40, fontWeight: '800', letterSpacing: 8, textAlign: 'center', marginVertical: 12 }}>{code}</Text>
          ) : (
            <Button title="Show the code" variant="secondary" onPress={showCode} loading={busy === 'code'} />
          )}
        </Card>
      )}

      {actions.includes('confirm') && (
        panel === 'confirm' ? (
          <Card>
            <P>Confirm the package arrived? This pays the traveler and can't be undone.</P>
            <Button title="Yes, it arrived" onPress={confirm} loading={busy === 'confirm'} testID="confirm-yes" />
            <Button title="Not yet" variant="secondary" onPress={() => setPanel(null)} />
          </Card>
        ) : (
          <Button title="Confirm it arrived" onPress={() => setPanel('confirm')} testID="confirm" />
        )
      )}

      {actions.includes('report') && (
        panel === 'report' ? (
          <Card>
            <Field label="What went wrong?" value={reason} onChangeText={setReason} multiline numberOfLines={4} style={{ minHeight: 96, textAlignVertical: 'top' }} />
            <Button title="Send report" variant="danger" onPress={report} loading={busy === 'report'} testID="report-send" />
            <Button title="Cancel" variant="secondary" onPress={() => setPanel(null)} />
          </Card>
        ) : (
          <Button title="Report a problem" variant="secondary" onPress={() => setPanel('report')} testID="report" />
        )
      )}

      {actions.includes('rate') && (
        <Card>
          <P style={{ fontWeight: '700', marginBottom: 8 }}>Rate your traveler</P>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} onPress={() => setStars(n)}>
                <Text style={{ fontSize: 34, color: n <= stars ? '#f59e0b' : colors.border }}>★</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Comment (optional)" value={comment} onChangeText={setComment} />
          <Button title="Submit rating" onPress={rate} loading={busy === 'rate'} />
        </Card>
      )}
      <Gap />
    </Screen>
  );
}
