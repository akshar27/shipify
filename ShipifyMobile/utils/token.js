// utils/token.js
import jwtDecode from "jwt-decode";
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getDecodedUser() {
  const token = await AsyncStorage.getItem("token");
  return token ? jwtDecode(token) : null;
}
