// screens/CreateTripScreen.js
import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import API from '../utils/api';

export default function CreateTripScreen({ navigation }) {
  const [form, setForm] = useState({
    pickup: '',
    dropoff: '',
    itemType: '',
    size: '',
    weight: '',
  });

  const handleSubmit = async () => {
    try {
      await API.post('/trips', form);
      Alert.alert("Success", "Trip created successfully");
      navigation.goBack();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || "Failed to create trip");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create New Trip</Text>

      <TextInput label="Pickup Location" value={form.pickup} onChangeText={(val) => setForm({ ...form, pickup: val })} style={styles.input} />
      <TextInput label="Dropoff Location" value={form.dropoff} onChangeText={(val) => setForm({ ...form, dropoff: val })} style={styles.input} />
      <TextInput label="Item Type" value={form.itemType} onChangeText={(val) => setForm({ ...form, itemType: val })} style={styles.input} />
      <TextInput label="Size" value={form.size} onChangeText={(val) => setForm({ ...form, size: val })} style={styles.input} />
      <TextInput label="Weight (kg)" keyboardType="numeric" value={form.weight} onChangeText={(val) => setForm({ ...form, weight: val })} style={styles.input} />

      <Button mode="contained" onPress={handleSubmit} style={styles.button}>Create Trip</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  input: { marginBottom: 12 },
  button: { marginTop: 20 }
});
