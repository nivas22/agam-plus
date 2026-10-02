// Typed wrappers over the /auth routes in apps/api/src/auth/auth.controller.ts.
import type { ApiClient } from "./client";
import type { AppUser, Hospital, ROLE } from "../types/auth";
import type { HospitalMember } from "../types/doctorNew";

export interface LoginResponse {
  token: string;
  user: AppUser;
  role: ROLE;
  hospitals?: HospitalMember[];
  currentHospital?: Hospital | null;
  mustChangePassword?: boolean;
}

export interface SessionResponse {
  user: AppUser;
  role: ROLE;
  hospitals: HospitalMember[];
  currentHospital?: Hospital | null;
}

export function createAuthApi(client: ApiClient) {
  /**
   * Persists the token as a side effect so every later call through this
   * client is authenticated — callers never touch the token store directly.
   */
  async function persist(response: LoginResponse): Promise<LoginResponse> {
    await client.tokenStore.set(response.token);
    return response;
  }

  return {
    /** Username + password — the doctor/team-member path. */
    loginWithPassword: (
      username: string,
      password: string,
      keepSignedIn = true,
    ) =>
      client
        .post<LoginResponse>(
          "/auth/login-password",
          { username, password, keepSignedIn },
          { anonymous: true },
        )
        .then(persist),

    /** Google ID token, from @react-native-google-signin or GIS on web. */
    loginWithGoogle: (idToken: string) =>
      client
        .post<LoginResponse>("/auth/login", { idToken }, { anonymous: true })
        .then(persist),

    getSession: () => client.get<SessionResponse>("/auth/session"),

    getUser: () => client.get<AppUser>("/auth/user"),

    switchHospital: (hospitalId: string) =>
      client.post<LoginResponse>("/auth/hospital", { hospitalId }).then(persist),

    changePassword: (currentPassword: string, newPassword: string) =>
      client.post<{ success: boolean }>("/auth/change-password", {
        currentPassword,
        newPassword,
      }),

    forgotPassword: (username: string) =>
      client.post<{ success: boolean }>(
        "/auth/forgot-password",
        { username },
        { anonymous: true },
      ),

    /** Clears the token even if the network call fails — same as web. */
    logout: async () => {
      await client.post("/auth/logout").catch(() => {});
      await client.tokenStore.clear();
    },
  };
}
