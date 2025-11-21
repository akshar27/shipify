import React, { createContext, useState } from 'react';

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [openChats, setOpenChats] = useState({});
  return (
    <ChatContext.Provider value={{ openChats, setOpenChats }}>
      {children}
    </ChatContext.Provider>
  );
};
