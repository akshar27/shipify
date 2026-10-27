import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { render } from '@testing-library/react-native';

const Stack = createNativeStackNavigator();

/** Renders a screen inside a real navigator (needed for useFocusEffect), passing it extra props. */
export async function renderInNav(Screen, props = {}) {
  const navigation = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
  const Wrapped = (p) => <Screen {...p} navigation={{ ...p.navigation, ...navigation }} {...props} />;
  const utils = await render(
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Test" component={Wrapped} />
      </Stack.Navigator>
    </NavigationContainer>
  );
  return { ...utils, navigation };
}

export const axiosError = (status, data) => Object.assign(new Error('x'), { response: { status, data } });
export const networkError = () => Object.assign(new Error('Network Error'), { request: {} });
