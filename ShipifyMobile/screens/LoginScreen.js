import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Title, useTheme, IconButton } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../utils/api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const theme = useTheme();

  const login = async () => {
    try {
      const res = await API.post('/auth/login', {
        email: email.trim(),
        password: password.trim(),
      });
      await AsyncStorage.setItem('token', res.data.token);
  
      // Don’t manually navigate here – let AppNavigator handle it
      // navigation.replace('Dashboard'); ❌ REMOVE this
  
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Login failed");
    }
  };  

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Title style={styles.title}>Login to Your Account</Title>

        <TextInput
          label="Email"
          mode="outlined"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          label="Password"
          mode="outlined"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={styles.input}
          right={
            <TextInput.Icon
              icon={showPassword ? "eye-off" : "eye"}
              onPress={() => setShowPassword(prev => !prev)}
            />
          }
        />

        <Button mode="contained" onPress={login} style={styles.button}>
          Login
        </Button>

        <Text style={styles.registerText}>
          Don’t have an account?{" "}
          <Text
            onPress={() => navigation.navigate('Signup')}
            style={{ color: theme.colors.primary }}
          >
            Sign up
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    marginBottom: 32,
    alignSelf: 'center',
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 20,
  },
  button: {
    marginTop: 12,
    paddingVertical: 6,
  },
  registerText: {
    marginTop: 20,
    textAlign: 'center',
  },
});
