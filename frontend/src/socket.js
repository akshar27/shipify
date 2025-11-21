// /services/socket.js
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: {
    token: localStorage.getItem("token"), // match backend token name
  },
});

export default socket;
