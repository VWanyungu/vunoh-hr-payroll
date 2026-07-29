const ACCESS_TOKEN_KEY = "vunoh_access_token";
const REFRESH_TOKEN_KEY = "vunoh_refresh_token";

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(access, refresh) {
  if (access) localStorage.setItem(ACCESS_TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function decodeRoles() {
  const token = getAccessToken();
  if (!token) return [];

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Array.isArray(payload.role) ? payload.role : [];
  } catch {
    return [];
  }
}

/** Convenience: just the role name strings, e.g. ["hr_admin", "manager"]. */
function getRoleNames() {
  return decodeRoles().map((r) => r.role);
}

/** Decodes the `userId` claim from the access token, or null if absent/invalid. */
function getUserId() {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

function requireAuth() {
  if (!getAccessToken()) {
    window.location.href = "html/public/login.html";
  }
}

/** Redirects to the dashboard if the current user holds none of `allowedRoles`. */
function requireRole(allowedRoles) {
  requireAuth();
  const roleNames = getRoleNames();
  const hasAccess = allowedRoles.some((role) => roleNames.includes(role));
  if (!hasAccess) {
    window.location.href = "html/app/dashboard.html";
  }
}
