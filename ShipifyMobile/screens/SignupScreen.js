import React, { useState } from "react";
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { TextInput, Button, Text, Title, useTheme } from "react-native-paper";
import API from "../utils/api";

export default function SignupScreen({ navigation }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const handleSignup = async () => {
    if (!form.name || !form.email || !form.password) {
      Alert.alert("Error", "All fields are required");
      return;
    }

    try {
      setLoading(true);
      await API.post("/auth/signup", form);
      Alert.alert("✅ Success", "Account created successfully!");
      navigation.navigate("Login");
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Title style={styles.title}>Create an Account</Title>

        <TextInput
          label="Full Name"
          mode="outlined"
          value={form.name}
          onChangeText={(val) => setForm({ ...form, name: val })}
          style={styles.input}
        />

        <TextInput
          label="Email"
          mode="outlined"
          value={form.email}
          onChangeText={(val) => setForm({ ...form, email: val })}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          label="Password"
          mode="outlined"
          secureTextEntry
          value={form.password}
          onChangeText={(val) => setForm({ ...form, password: val })}
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleSignup}
          loading={loading}
          style={styles.button}
        >
          Sign Up
        </Button>

        <Text style={styles.loginText}>
          Already have an account?{" "}
          <Text
            onPress={() => navigation.navigate("Login")}
            style={{ color: theme.colors.primary }}
          >
            Login
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    alignSelf: "center",
    marginBottom: 32,
  },
  input: {
    marginBottom: 20,
  },
  button: {
    marginTop: 10,
    paddingVertical: 6,
  },
  loginText: {
    marginTop: 20,
    textAlign: "center",
  },
});
