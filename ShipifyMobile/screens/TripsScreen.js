import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import API from '../utils/api';

export default function TripsScreen() {
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const res = await API.get('/trips');
        setTrips(res.data || []);
      } catch (e) {
        console.error('Failed to fetch trips', e);
      }
    };

    fetchTrips();
  }, []);

  return (
    <View style={styles.container}>
      <Text variant="titleLarge" style={styles.title}>My Trips</Text>
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Title title={`Trip to ${item.dropoff}`} />
            <Card.Content>
              <Text>Date: {item.date}</Text>
              <Text>Status: {item.status}</Text>
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
