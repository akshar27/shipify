import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

let socket;

export const connectSocket = async () => {
  const token = await AsyncStorage.getItem('token');
  socket = io('http://localhost:5000', {
    auth: { token },
  });
};

export const getSocket = () => socket;
