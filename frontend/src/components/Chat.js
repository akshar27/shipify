import { useEffect, useState, useRef } from "react";
import API from "../services/api";
import { useParams } from "react-router-dom";

export default function ChatPage() {
  const { deliveryId } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [receiverId, setReceiverId] = useState(null);
  const messagesEndRef = useRef(null);

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const res = await API.get(`/messages/${deliveryId}`);
      setMessages(res.data);

      // Set receiver (assuming current user is always sender)
      const currentUser = JSON.parse(localStorage.getItem("user"));
      const other = res.data.find((msg) => msg.sender.id !== currentUser.id);
      if (other) setReceiverId(other.sender.id);
    } catch (err) {
      console.error("Failed to load messages", err);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [deliveryId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage || !receiverId) return;
    try {
      await API.post("/messages", {
        deliveryId,
        receiverId,
        content: newMessage,
      });
      setNewMessage("");
      fetchMessages();
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  return (
    <div className="container mt-4">
      <h4>Chat for Delivery #{deliveryId}</h4>

      <div className="border p-3 rounded mb-3 bg-light" style={{ height: 400, overflowY: "scroll" }}>
        {messages.map((msg, i) => {
          const isMine = msg.sender.id === JSON.parse(localStorage.getItem("user")).id;
          return (
            <div
              key={i}
              className={`mb-2 d-flex ${isMine ? "justify-content-end" : "justify-content-start"}`}
            >
              <div
                className={`p-2 rounded ${isMine ? "bg-primary text-white" : "bg-white border"}`}
                style={{ maxWidth: "70%" }}
              >
                <small className="d-block fw-bold">{msg.sender.name}</small>
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="d-flex">
        <input
          className="form-control me-2"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}
