import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Text,
  Button,
  Appbar,
  Card,
  useTheme,
  Surface,
  Title,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../utils/api';
import { connectSocket } from '../utils/socket';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState({});
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await API.get('/dashboard/summary');
        setStats(res.data.stats || {});
        setDeliveries(res.data.recentDeliveries || []);
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    connectSocket();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    navigation.replace('Login');
  };

  const StatCard = ({ label, count }) => (
    <Surface style={styles.statCard} elevation={2}>
      <Title style={styles.statNumber}>{count || 0}</Title>
      <Text style={styles.statLabel}>{label}</Text>
    </Surface>
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
      <Appbar.Header>
        <Appbar.Content title="Dashboard" />
        <Appbar.Action icon="account" onPress={() => navigation.navigate('Profile')} />
        <Appbar.Action icon="logout" onPress={handleLogout} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 10 }}>Loading dashboard...</Text>
        </View>
      ) : (
        <View style={styles.container}>
          {/* Stat Cards */}
          <View style={styles.statsRow}>
            <StatCard label="Total Trips" count={stats.totalTrips} />
            <StatCard label="Deliveries Sent" count={stats.totalDeliveries} />
            <StatCard label="In Transit" count={stats.inTransit} />
            <StatCard label="Delivered" count={stats.delivered} />
          </View>

          {/* Deliveries */}
          <Text style={styles.heading}>Recent Deliveries</Text>

          {deliveries.length === 0 ? (
            <Text style={styles.noDeliveries}>🚚 No recent deliveries.</Text>
          ) : (
            <FlatList
              data={deliveries}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <Card style={styles.card} mode="elevated">
                  <Card.Title
                    title={`${item.pickup} → ${item.dropoff}`}
                    subtitle={`Status: ${item.status}`}
                  />
                  <Card.Content>
                    <Text>
                      Type: {item.itemType} | Size: {item.size} | {item.weight}kg
                    </Text>
                  </Card.Content>
                  <Card.Actions>
                    <Button
                      mode="contained"
                      onPress={() =>
                        navigation.navigate('Chat', {
                          deliveryId: item.id,
                          receiverId: item.senderId,
                        })
                      }
                    >
                      Chat
                    </Button>
                  </Card.Actions>
                </Card>
              )}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 16,
  },
  noDeliveries: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: 'gray',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 14,
    color: '#555',
  },
  card: {
    marginBottom: 12,
    borderRadius: 8,
  },
});
