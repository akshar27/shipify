import React, { useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api, { errMsg } from '../../lib/api';
import { Banner, Button, Field, H1, P, Screen } from '../../ui/ui';

// FormData wants a Blob on the web and a {uri, name, type} descriptor on iOS/Android.
async function fileField(asset) {
  const type = asset.mimeType || 'image/jpeg';
  const name = asset.fileName || `id.${type.split('/')[1] || 'jpg'}`;
  if (Platform.OS === 'web') return { value: await (await fetch(asset.uri)).blob(), name };
  return { value: { uri: asset.uri, name, type }, name };
}

export default function VerificationScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [asset, setAsset] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets?.length) setAsset(res.assets[0]);
  };

  const submit = async () => {
    setError('');
    if (!fullName.trim()) return setError('Enter your full name as it appears on the document.');
    if (!asset) return setError('Choose a photo of your ID document.');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('fullName', fullName.trim());
      const f = await fileField(asset);
      form.append('document', f.value, f.name);
      await api.post('/verification', form, { headers: { 'Content-Type': 'multipart/form-data' }, transformRequest: (d) => d });
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
        <H1>Submitted</H1>
        <P>An admin will review your document, usually within a day. Pull down on the Account tab to refresh your status.</P>
        <Button title="Done" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <P muted style={{ marginBottom: 12 }}>Upload a clear photo of a government ID. It is stored privately and only admins can see it.</P>
      <Banner type="error">{error}</Banner>
      <Field label="Full name" value={fullName} onChangeText={setFullName} />
      <Button title={asset ? 'Choose a different photo' : 'Choose a photo'} variant="secondary" onPress={pick} testID="pick" />
      {asset ? <P muted style={{ marginTop: 8 }}>Selected: {asset.fileName || 'photo'}</P> : null}
      <Button title="Submit for review" onPress={submit} loading={busy} testID="submit-id" style={{ marginTop: 16 }} />
    </Screen>
  );
}
