// /services/socket.js
import { io } from "socket.io-client";
import { API_ORIGIN } from "./config";

const socket = io(API_ORIGIN, {
  auth: {
    token: localStorage.getItem("token"), // match backend token name
  },
});

export default socket;
