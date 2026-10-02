// Wires the shared, storage-agnostic client to mobile secure storage.
import * as SecureStore from "expo-secure-store";
import {
  createApiClient,
  createAuthApi,
  createDoctorApi,
  type TokenStore,
} from "@agam/shared";

const TOKEN_KEY = "qdoc_auth_token";

/**
 * SecureStore rather than AsyncStorage: the JWT grants access to patient
 * records, so it belongs in the Keychain / Android Keystore.
 */
const secureTokenStore: TokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

const baseUrl =
  process.env.EXPO_PUBLIC_AGAM_API_URL ?? "http://localhost:3001";

/** Set by the auth provider so a hard 401 can bounce the user to /login. */
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export const apiClient = createApiClient({
  baseUrl,
  tokenStore: secureTokenStore,
  onUnauthorized: () => unauthorizedHandler?.(),
});

export const authApi = createAuthApi(apiClient);
export const doctorApi = createDoctorApi(apiClient);
export { secureTokenStore };
