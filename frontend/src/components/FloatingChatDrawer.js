import { useContext } from "react";
import { ChatContext } from "../context/ChatContext";
import ChatBox from "./ChatBox";

export default function FloatingChatDrawer() {
  const { openChats, setOpenChats } = useContext(ChatContext);

  if (Object.keys(openChats).length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        width: "400px",
        maxHeight: "80vh",
        background: "#fff",
        border: "1px solid #ccc",
        borderRadius: "12px 12px 0 0",
        overflowY: "auto",
        zIndex: 9999,
        boxShadow: "0 0 10px rgba(0,0,0,0.3)",
      }}
    >
      {Object.entries(openChats).map(([deliveryId, { receiverId, senderName }]) => (
        <div key={deliveryId} style={{ borderTop: "1px solid #eee", padding: "10px" }}>
          <div className="d-flex justify-content-between align-items-center">
            <strong>Chat with {senderName}</strong>
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={() => {
                const updated = { ...openChats };
                delete updated[deliveryId];
                setOpenChats(updated);
              }}
            >
              ❌
            </button>
          </div>
          <ChatBox deliveryId={deliveryId} receiverId={receiverId} />
        </div>
      ))}
    </div>
  );
}
