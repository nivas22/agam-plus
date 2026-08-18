import { 
  signInWithPopup, 
  signOut, 
  signInWithEmailAndPassword as firebaseSignInWithEmail,
  createUserWithEmailAndPassword as firebaseCreateUser,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  onAuthStateChanged as firebaseAuthStateChanged,
  User as FirebaseUser,
  UserCredential
} from "firebase/auth";
import { auth } from "./firebase";
import { apiUrl, setAuthToken, clearAuthToken } from "./api";
import { AppUser, LoginResult, LoginSuccess, RegisterResult } from "@/types/auth";

// Google provider
const provider = new GoogleAuthProvider();

/** Normalize email */
// function normalizeEmail(email: string): string {
//   return email.trim().toLowerCase();
// }

/** Login with Google */
export async function loginWithGoogle(): Promise<LoginSuccess> {
  try {
    const result: UserCredential = await signInWithPopup(auth, provider);
    const firebaseUser: FirebaseUser = result.user;

    if (!firebaseUser.email) {
      throw new Error("Unable to retrieve Google account email");
    }

    // Get Firebase ID token
    const idToken = await firebaseUser.getIdToken();

    // Call your backend auth API
    const response = await fetch(apiUrl("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Login failed");
    }

    const data = await response.json();
    setAuthToken(data.token);

    // Construct a fully type-safe LoginSuccess response
    return {
      success: true,
      userData: data.user,
      role: data.role,
      user: firebaseUser,                 // Your backend user object
      hospitals: data.hospitals || [], // Array
      currentHospital: data.currentHospital ?? null,
    };
  } catch (error) {
    console.error("loginWithGoogle error:", error);
    throw error;
  }
}

/** Login with email/password */
export async function loginWithEmailAndPassword(email: string, password: string): Promise<LoginResult> {
  try {
    const result: UserCredential = await firebaseSignInWithEmail(auth, email, password);
    const user = result.user;

    const idToken = await user.getIdToken();

    const loginResponse = await fetch(apiUrl("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json();
      throw new Error(errorData.error || 'Login failed');
    }

    const loginData = await loginResponse.json();
    setAuthToken(loginData.token);

    // Create AppUser object from the API response
    const userData: AppUser = {
      id: loginData.userId,
      uid: user.uid,
      email: user.email || '',
      name: user.displayName || user.email || 'Unknown User',
      role: loginData.role,
      status: loginData.status,
      ...loginData.user
    };
    
    return { 
      user, 
      userData,
      role: loginData.role,
      hospitals: loginData.hospitals || [],
      currentHospital: loginData.currentHospital
    } as LoginResult;
  } catch (err) {
    console.error("loginWithEmailAndPassword error:", err);
    throw err;
  }
}

/** Register with email/password */
export async function registerWithEmailAndPassword(email: string, password: string, name?: string): Promise<RegisterResult> {
  try {
    const result: UserCredential = await firebaseCreateUser(auth, email, password);
    const user = result.user;
    
    if (name) await updateProfile(user, { displayName: name });

    const idToken = await user.getIdToken();

    const loginResponse = await fetch(apiUrl("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, name }),
    });

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json();
      throw new Error(errorData.error || 'Registration failed');
    }

    const loginData = await loginResponse.json();
    setAuthToken(loginData.token);

    // Create AppUser object
    const userData: AppUser = {
      id: loginData.userId,
      uid: user.uid,
      email: user.email || '',
      name: name || user.email || 'Unknown User',
      role: loginData.role,
      status: loginData.status,
      ...loginData.user
    };

    return { user, userData };
  } catch (err) {
    console.error("registerWithEmailAndPassword error:", err);
    throw err;
  }
}

/** Send password reset email */
export async function sendPasswordReset(email: string): Promise<boolean> {
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (err) {
    console.error("sendPasswordReset error:", err);
    throw err;
  }
}

/** Logout */
export async function logout(): Promise<boolean> {
  try {
    await fetch(apiUrl("/auth/logout"), { method: "POST" }).catch(() => {});
    clearAuthToken();
    await signOut(auth);
    return true;
  } catch (err) {
    console.error("logout error:", err);
    throw err;
  }
}

/** Get ID token */
export async function getIdToken(): Promise<string | null> {
  try {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  } catch (err) {
    console.error("getIdToken error:", err);
    return null;
  }
}

/** Auth state listener */
export function onAuthStateChange(callback: (user: FirebaseUser | null) => void): () => void {
  return firebaseAuthStateChanged(auth, callback);
}

/** Current user */
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

/** Check authentication */
export function isAuthenticated(): boolean {
  return !!auth.currentUser;
}
