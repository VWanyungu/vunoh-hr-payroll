const API_BASE_URL = "http://localhost:3000/v1";
// const API_BASE_URL = "https://vunoh-hr-payroll.vercel.app/v1";

async function apiRequest(method, path, body) {
  const token = getAccessToken();

  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (token && (response.status === 401 || response.status === 403)) {
    clearTokens();
    window.location.href = "html/public/login.html";
    return Promise.reject(
      new Error(`Request failed with status ${response.status}`),
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function apiGet(path) {
  return apiRequest("GET", path);
}

function apiPost(path, body) {
  return apiRequest("POST", path, body);
}

function apiPut(path, body) {
  return apiRequest("PUT", path, body);
}

function apiPatch(path, body) {
  return apiRequest("PATCH", path, body);
}

function apiDelete(path, body) {
  return apiRequest("DELETE", path, body);
}
