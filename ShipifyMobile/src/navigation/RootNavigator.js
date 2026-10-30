import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { Button, Center, H1, P, Spinner } from '../ui/ui';
import { colors } from '../ui/theme';

import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import AcceptTermsScreen from '../screens/auth/AcceptTermsScreen';
import RulesScreen from '../screens/auth/RulesScreen';
import DeliveriesScreen from '../screens/sender/DeliveriesScreen';
import CreateDeliveryScreen from '../screens/sender/CreateDeliveryScreen';
import DeliveryDetailScreen from '../screens/sender/DeliveryDetailScreen';
import JobsScreen from '../screens/traveler/JobsScreen';
import PostTripScreen from '../screens/traveler/PostTripScreen';
import AccountScreen from '../screens/account/AccountScreen';
import VerificationScreen from '../screens/account/VerificationScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const icon = (glyph) => ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>;

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ tabBarActiveTintColor: colors.primary, headerTitleAlign: 'left' }}>
      <Tabs.Screen name="Send" component={DeliveriesScreen} options={{ title: 'Send', tabBarIcon: icon('📦') }} />
      <Tabs.Screen name="Carry" component={JobsScreen} options={{ title: 'Carry', tabBarIcon: icon('🧳') }} />
      <Tabs.Screen name="Account" component={AccountScreen} options={{ title: 'Account', tabBarIcon: icon('👤') }} />
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const { status, user, retry } = useAuth();

  if (status === 'loading') return <Spinner />;
  if (status === 'offline') {
    return (
      <Center>
        <H1>Can't reach Shipify</H1>
        <P muted style={{ textAlign: 'center', marginBottom: 16 }}>Check your connection and try again.</P>
        <Button title="Try again" onPress={retry} />
      </Center>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {status === 'out' ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Create account' }} />
            <Stack.Screen name="Rules" component={RulesScreen} options={{ title: 'Terms and prohibited items' }} />
          </>
        ) : !user.termsAccepted ? (
          <>
            <Stack.Screen name="AcceptTerms" component={AcceptTermsScreen} options={{ title: 'Before you continue' }} />
            <Stack.Screen name="Rules" component={RulesScreen} options={{ title: 'Terms and prohibited items' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="CreateDelivery" component={CreateDeliveryScreen} options={{ title: 'New delivery' }} />
            <Stack.Screen name="DeliveryDetail" component={DeliveryDetailScreen} options={{ title: 'Delivery' }} />
            <Stack.Screen name="PostTrip" component={PostTripScreen} options={{ title: 'Post a trip' }} />
            <Stack.Screen name="Verification" component={VerificationScreen} options={{ title: 'Verify your ID' }} />
            <Stack.Screen name="Rules" component={RulesScreen} options={{ title: 'Terms and prohibited items' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
