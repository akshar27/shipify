import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import api, { errMsg } from '../../lib/api';
import { geocode } from '../../lib/geocode';
import { money, SIZES } from '../../lib/format';
import { Banner, Button, Check, Chips, Field, P, Screen } from '../../ui/ui';
import { colors } from '../../ui/theme';

export default function CreateDeliveryScreen({ navigation }) {
  const [f, setF] = useState({ pickup: '', dropoff: '', itemType: '', size: 'small', weight: '', declaredValue: '' });
  const [confirmed, setConfirmed] = useState(false);
  const [rules, setRules] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => { api.get('/legal/rules').then((r) => setRules(r.data)).catch(() => {}); }, []);

  const submit = async () => {
    setError('');
    const weight = Number(f.weight);
    const value = Number(f.declaredValue);
    if (!f.pickup.trim() || !f.dropoff.trim()) return setError('Enter where the package starts and where it is going.');
    if (!f.itemType.trim()) return setError('Say what you are sending.');
    if (!(weight > 0)) return setError('Enter the weight in kg.');
    if (!(value > 0)) return setError("Enter the item's value.");
    if (rules && value * 100 > rules.maxItemValueCents) return setError(`The declared value cannot be more than ${money(rules.maxItemValueCents, rules.currency)}: more valuable items are not allowed.`);
    if (!confirmed) return setError('Confirm the package contains nothing on the prohibited list.');

    setBusy(true);
    try {
      const [from, to] = await Promise.all([geocode(f.pickup), geocode(f.dropoff)]);
      // Travelers are matched by where the package is. Without both points the delivery would be paid for and never matched.
      if (from.lat == null || to.lat == null) {
        setError("We couldn't find one of those addresses on the map, so travelers couldn't be matched to your package. Try a fuller address (street, city, state).");
        return setBusy(false);
      }
      const { data } = await api.post('/deliveries', {
        pickup: f.pickup.trim(), dropoff: f.dropoff.trim(),
        pickupLat: from.lat, pickupLng: from.lng, dropoffLat: to.lat, dropoffLng: to.lng,
        itemType: f.itemType.trim(), size: f.size, weight, declaredValue: value, contentsConfirmed: true,
      });
      navigation.replace('DeliveryDetail', { id: data.id, justCreated: true });
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Banner type="error">{error}</Banner>
      <Field label="Pickup address" value={f.pickup} onChangeText={set('pickup')} placeholder="e.g. 123 Main St, Oakland, CA" />
      <Field label="Drop-off address" value={f.dropoff} onChangeText={set('dropoff')} placeholder="e.g. 456 Elm St, Austin, TX" />
      <Field label="What are you sending?" value={f.itemType} onChangeText={set('itemType')} placeholder="e.g. a book" />
      <P style={{ fontWeight: '600', marginBottom: 6 }}>Size</P>
      <Chips options={SIZES} value={f.size} onChange={set('size')} />
      <Field label="Weight (kg)" value={f.weight} onChangeText={set('weight')} keyboardType="decimal-pad" style={{ marginTop: 12 }} />
      <Field
        label="Declared value"
        value={f.declaredValue}
        onChangeText={set('declaredValue')}
        keyboardType="decimal-pad"
        hint={rules ? `What it is worth. Items over ${money(rules.maxItemValueCents, rules.currency)} are not allowed.` : undefined}
      />
      <Check checked={confirmed} onChange={setConfirmed}>
        <P>
          I confirm this package contains nothing on the{' '}
          <Text style={{ color: colors.primary, textDecorationLine: 'underline' }} onPress={() => navigation.navigate('Rules')}>prohibited items list</Text>.
        </P>
      </Check>
      <Button title="Create delivery" onPress={submit} loading={busy} />
    </Screen>
  );
}
