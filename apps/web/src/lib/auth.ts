import type { LoginSuccess } from "@/types/auth";
import { apiUrl, clearAuthToken, setAuthToken } from "./api";

/** Login with the ID token from Google Identity Services (GoogleLogin credential) */
export async function loginWithGoogle(
  credential: string,
): Promise<LoginSuccess> {
  const response = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: credential }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Login failed");
  }

  const data = await response.json();
  setAuthToken(data.token);

  return {
    success: true,
    userData: data.user,
    role: data.role,
    hospitals: data.hospitals || [],
    currentHospital: data.currentHospital ?? null,
  };
}

/** Login with a username + password (doctors/team members) */
export async function loginWithPassword(
  username: string,
  password: string,
  keepSignedIn = false,
): Promise<LoginSuccess> {
  const response = await fetch(apiUrl("/auth/login-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, keepSignedIn }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Login failed");
  }

  const data = await response.json();
  setAuthToken(data.token);

  return {
    success: true,
    userData: data.user,
    role: data.role,
    hospitals: data.hospitals || [],
    currentHospital: data.currentHospital ?? null,
    mustChangePassword: !!data.mustChangePassword,
  };
}

/** Logout */
export async function logout(): Promise<boolean> {
  await fetch(apiUrl("/auth/logout"), { method: "POST" }).catch(() => {});
  clearAuthToken();
  return true;
}
