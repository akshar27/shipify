import React, { useMemo, useState } from 'react';
import api, { errMsg } from '../../lib/api';
import { geocode } from '../../lib/geocode';
import { departureOptions } from '../../lib/format';
import { Banner, Button, Chips, Field, P, Screen } from '../../ui/ui';

export default function PostTripScreen({ navigation }) {
  const options = useMemo(() => departureOptions(), []);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [when, setWhen] = useState(options[1].label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!start.trim() || !end.trim()) return setError('Enter where you are leaving from and where you are going.');
    setBusy(true);
    try {
      const [from, to] = await Promise.all([geocode(start), geocode(end)]);
      if (from.lat == null || to.lat == null) {
        setError("We couldn't find one of those places on the map, so we couldn't match packages to your route. Try a fuller address (street, city).");
        return setBusy(false);
      }
      await api.post('/trips', {
        start: start.trim(), end: end.trim(), departure: options.find((o) => o.label === when).date.toISOString(),
        startLat: from.lat, startLng: from.lng, endLat: to.lat, endLng: to.lng,
      });
      navigation.goBack();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <P muted style={{ marginBottom: 12 }}>Tell us where you're going. We'll show you paid packages along the way that you can choose to carry.</P>
      <Banner type="error">{error}</Banner>
      <Field label="Leaving from" value={start} onChangeText={setStart} placeholder="e.g. Oakland, CA" />
      <Field label="Going to" value={end} onChangeText={setEnd} placeholder="e.g. Austin, TX" />
      <P style={{ fontWeight: '600', marginBottom: 6 }}>When</P>
      <Chips options={options.map((o) => o.label)} value={when} onChange={setWhen} />
      <Button title="Post trip" onPress={submit} loading={busy} testID="submit-trip" style={{ marginTop: 16 }} />
    </Screen>
  );
}
