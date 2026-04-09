export const AUTH_STORAGE_KEY = "asc_auth_user";
export const STUDENT_ID_STORAGE_KEY = "asc_student_id";

export type AuthRole = "student" | "teacher" | "admin" | "user";

export interface AuthUser {
  id: string;
  email: string;
  role: AuthRole;
  name?: string;
}

export function saveAuthUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));

  if (user.role === "student") {
    window.localStorage.setItem(STUDENT_ID_STORAGE_KEY, user.id);
  }
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuthUser(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.localStorage.removeItem(STUDENT_ID_STORAGE_KEY);
}

export function hasRole(
  requiredRole: "student" | "teacher",
  role?: AuthRole,
): boolean {
  if (!role) return false;
  if (requiredRole === "teacher") return role === "teacher" || role === "admin";
  return role === "student";
}
