import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import API from '../utils/api';

export default function DeliveriesScreen() {
  const [deliveries, setDeliveries] = useState([]);

  useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const res = await API.get('/deliveries');
        setDeliveries(res.data || []);
      } catch (e) {
        console.error('Failed to fetch deliveries', e);
      }
    };

    fetchDeliveries();
  }, []);

  return (
    <View style={styles.container}>
      <Text variant="titleLarge" style={styles.title}>My Deliveries</Text>
      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Title title={`${item.pickup} → ${item.dropoff}`} />
            <Card.Content>
              <Text>Status: {item.status}</Text>
              <Text>Weight: {item.weight}kg</Text>
              <Text>Size: {item.size}</Text>
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { marginBottom: 12, fontWeight: 'bold' },
  card: { marginBottom: 10 },
});
