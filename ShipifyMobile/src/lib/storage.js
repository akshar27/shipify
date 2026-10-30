import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// The login token lives in the iOS Keychain / Android Keystore. On the web build (used only for development) there is no
// secure store, so it falls back to localStorage.
const web = Platform.OS === 'web';
const ls = () => (typeof localStorage !== 'undefined' ? localStorage : null);

export const storage = {
  get: async (key) => (web ? ls()?.getItem(key) ?? null : SecureStore.getItemAsync(key)),
  set: async (key, value) => (web ? ls()?.setItem(key, value) : SecureStore.setItemAsync(key, value)),
  remove: async (key) => (web ? ls()?.removeItem(key) : SecureStore.deleteItemAsync(key)),
};
