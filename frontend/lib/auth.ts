/**
 * Veritas Frontend Auth Helpers
 * Retrieves signed JWT token for teacher and admin API calls.
 */
export function getTeacherAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const directToken = localStorage.getItem("veritas_teacher_token");
    if (directToken) return { Authorization: `Bearer ${directToken}` };
    const auth = JSON.parse(localStorage.getItem("veritas_teacher_auth") || "{}");
    if (auth.token) return { Authorization: `Bearer ${auth.token}` };
  } catch (e) {}
  return {};
}
