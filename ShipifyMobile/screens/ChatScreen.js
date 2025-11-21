import React, { useEffect, useState } from 'react';
import { View, TextInput, Button, FlatList, Text } from 'react-native';
import { getSocket } from '../utils/socket';
import API from '../utils/api';

export default function ChatScreen({ route }) {
  const { deliveryId, receiverId } = route.params;
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState('');
  const socket = getSocket();

  useEffect(() => {
    const fetchMessages = async () => {
      const res = await API.get(`/messages/${deliveryId}`);
      setMessages(res.data);
    };

    fetchMessages();
    socket.emit("joinDeliveryRoom", { deliveryId });

    socket.on("receiveMessage", (m) => {
      if (m.deliveryId === deliveryId) {
        setMessages((prev) => [...prev, m]);
      }
    });

    return () => {
      socket.off("receiveMessage");
    };
  }, []);

  const send = () => {
    socket.emit("sendMessage", { deliveryId, receiverId, content: msg });
    setMsg("");
  };

  return (
    <View style={{ flex: 1, padding: 10 }}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Text style={{ alignSelf: item.senderId === receiverId ? 'flex-start' : 'flex-end' }}>
            {item.content}
          </Text>
        )}
      />
      <TextInput value={msg} onChangeText={setMsg} placeholder="Type..." />
      <Button title="Send" onPress={send} />
    </View>
  );
}
