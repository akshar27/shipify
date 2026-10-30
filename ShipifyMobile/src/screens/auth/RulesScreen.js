import React, { useEffect, useState } from 'react';
import api, { errMsg } from '../../lib/api';
import { Banner, Card, H1, P, Screen, Spinner } from '../../ui/ui';
import { money } from '../../lib/format';
import { Text } from 'react-native';

export default function RulesScreen() {
  const [rules, setRules] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/legal/rules').then((r) => setRules(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <Screen><Banner type="error">{error}</Banner></Screen>;
  if (!rules) return <Spinner />;

  return (
    <Screen>
      <H1>What you can't send</H1>
      <P muted style={{ marginBottom: 12 }}>Items worth more than {money(rules.maxItemValueCents, rules.currency)} are not allowed either. These rules apply to everyone.</P>
      {rules.prohibited.map((p) => (
        <Card key={p.id}>
          <Text style={{ fontWeight: '700', marginBottom: 4 }}>{p.title}</Text>
          <P>{p.detail}</P>
        </Card>
      ))}
      <H1 style={{ marginTop: 16 }}>If you carry packages</H1>
      {rules.travelerRules.map((r, i) => <P key={i} style={{ marginBottom: 8 }}>• {r}</P>)}
      <P muted style={{ marginTop: 16 }}>
        {rules.companyName ? `${rules.companyName}. ` : ''}{rules.supportEmail ? `Questions: ${rules.supportEmail}` : ''}
      </P>
    </Screen>
  );
}
