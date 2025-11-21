import { useState } from "react";
import ChatBox from "./ChatBox"; // your existing component
import "./ChatDrawer.css"; // optional CSS

export default function ChatDrawer({ openChats }) {
  const [activeTab, setActiveTab] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
    if (!activeTab && Object.keys(openChats).length > 0) {
      setActiveTab(Object.keys(openChats)[0]);
    }
  };

  return (
    <>
      <button className="floating-chat-button" onClick={toggleDrawer}>
        💬
      </button>

      {isOpen && (
        <div className="chat-drawer">
          <div className="chat-tabs">
            {Object.keys(openChats).map((deliveryId) => (
              <button
                key={deliveryId}
                className={activeTab === deliveryId ? "tab active" : "tab"}
                onClick={() => setActiveTab(deliveryId)}
              >
                {openChats[deliveryId].senderName}
              </button>
            ))}
          </div>

          <div className="chat-box">
            {activeTab && (
              <ChatBox
                deliveryId={activeTab}
                receiverId={openChats[activeTab].receiverId}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
