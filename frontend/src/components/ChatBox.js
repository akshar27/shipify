import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import API from "../services/api";

// ✅ Create a single socket instance (outside the component to avoid re‑connecting)
const socket = io("http://localhost:5000", {
  auth: {
    token: localStorage.getItem("token"), // token from login
  },
  transports: ["websocket"], // optional: ensures WebSocket transport first
});

export default function ChatBox({ deliveryId, receiverId }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const currentUser = JSON.parse(localStorage.getItem("user")); // contains id, email etc.

  // ✅ Load old messages & subscribe to new ones
  useEffect(() => {
    if (!deliveryId) return;

    // 1️⃣ Fetch previous chat messages from REST API
    const fetchMessages = async () => {
      try {
        const res = await API.get(`/messages/${deliveryId}`);
        setMessages(res.data);
      } catch (err) {
        console.error("❌ Failed to load messages", err);
      }
    };
    fetchMessages();

    // 2️⃣ Join socket room for this delivery
    socket.emit("joinDeliveryRoom", { deliveryId });

    // 3️⃣ Listen for new incoming messages
    socket.on("receiveMessage", (msg) => {
      if (msg.deliveryId === deliveryId) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    // 4️⃣ Cleanup on unmount or deliveryId change
    return () => {
      socket.off("receiveMessage");
    };
  }, [deliveryId]);

  // ✅ Send message via Socket.IO (no reload)
  const sendMessage = () => {
    if (!newMsg.trim()) return;

    socket.emit("sendMessage", {
      deliveryId,
      receiverId,
      content: newMsg,
    });

    setNewMsg(""); // clear input instantly
  };

  return (
    <div>
      <h5 className="mb-3">Chat</h5>

      {/* Messages List */}
      <div
        style={{
          maxHeight: "50vh",
          overflowY: "auto",
          marginBottom: "1rem",
          paddingRight: "5px",
        }}
      >
        {messages.map((m) => {
          const isMine = m.senderId === currentUser.id;
          return (
            <div
              key={m.id}
              style={{
                textAlign: isMine ? "right" : "left",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  background: isMine ? "#007bff" : "#eee",
                  color: isMine ? "#fff" : "#000",
                  borderRadius: "12px",
                  padding: "6px 10px",
                  maxWidth: "80%",
                  wordWrap: "break-word",
                }}
              >
                <div style={{ fontSize: "0.8em", opacity: 0.8 }}>
                  {isMine ? "You" : m.sender?.name || "Sender"}
                </div>
                {m.content}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="input-group">
        <input
          className="form-control"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Type your message"
        />
        <button className="btn btn-primary" onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}
