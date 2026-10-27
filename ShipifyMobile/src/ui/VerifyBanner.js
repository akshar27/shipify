import React from 'react';
import { Banner, Button } from './ui';
import { useAuth } from '../auth/AuthContext';

/** Shown on the tabs that need an approved ID. Verification is manual (an admin looks at the document). */
export default function VerifyBanner({ navigation }) {
  const { user } = useAuth();
  if (!user || user.isVerified || user.role === 'admin') return null;
  return (
    <>
      <Banner type="warn">Verify your ID before you can send or carry packages. An admin reviews it, usually within a day.</Banner>
      <Button title="Verify my ID" variant="secondary" onPress={() => navigation.navigate('Verification')} />
    </>
  );
}
