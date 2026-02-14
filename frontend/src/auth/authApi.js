const API_BASE = (import.meta.env?.VITE_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEYS = ["authToken", "token"];

export function getToken() {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_KEYS) {
    const stored = localStorage.getItem(key);
    if (stored) return stored;
  }
  for (const key of TOKEN_KEYS) {
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
  }
  return null;
}

export function setToken(token, { remember = true } = {}) {
  if (typeof window === "undefined") return;
  if (!token) {
    TOKEN_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    return;
  }
  const storage = remember ? localStorage : sessionStorage;
  const otherStorage = remember ? sessionStorage : localStorage;
  TOKEN_KEYS.forEach((key) => {
    storage.setItem(key, token);
    otherStorage.removeItem(key);
  });
}

export function clearToken() {
  if (typeof window === "undefined") return;
  TOKEN_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

async function apiRequest(path, { method = "POST", body, headers, auth } = {}) {
  const config = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  };

  if (auth) {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, config);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
if (!res.ok) {
    // Global 401 handler - token expired or invalid
    if (res.status === 401) {
      clearToken();
      // Redirect to login page
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth/login';
      }
    }

    const serverMessage = data?.message || data?.error || "Request failed";
    const safeMessage =
      res.status >= 500
        ? "Service temporarily unavailable. Please try again."
        : serverMessage;

    throw {
      status: res.status,
      message: safeMessage,
      serverMessage,
    };
  }

  return { status: res.status, data };
}

async function requestWithFallback(paths, options) {
  let lastError = null;
  for (const path of paths) {
    try {
      return await apiRequest(path, options);
    } catch (err) {
      lastError = err;
      if (err?.status !== 404) {
        throw err;
      }
    }
  }
  throw lastError || { status: 404, message: "Request failed" };
}

export function login({ email, password }) {
  return apiRequest("/auth/login", {
    body: { email, password },
  });
}

export function register({ fullName, username, email, password }) {
  return apiRequest("/auth/register", {
    body: { fullName, full_name: fullName, username, email, password },
  });
}

export function forgotPassword({ email }) {
  return requestWithFallback(
    ["/auth/forgot-password"],
    { body: { email } }
  );
}

export function resetPassword({ token, password }) {
  return requestWithFallback(
    ["/auth/reset-password"],
    { body: { token, password } }
  );
}

export function verify2FA({ user_id, code, temp_token }) {
  return requestWithFallback(
    ["/auth/verify-2fa-login", "/auth/verify-2fa"],
    { body: { user_id, code, temp_token, tempToken: temp_token } }
  );
}

export function resend2FALogin({ user_id, temp_token }) {
  return requestWithFallback(
    ["/auth/resend-2fa-login"],
    { body: { user_id, temp_token, tempToken: temp_token } }
  );
}

export function enable2FA() {
  return requestWithFallback(
    ["/auth/2fa/enable"],
    { auth: true, body: {} }
  );
}

export function disable2FA({ password }) {
  return requestWithFallback(
    ["/auth/2fa/disable"],
    { auth: true, body: { password } }
  );
}

export function regenerateRecoveryCodes() {
  return requestWithFallback(
    ["/auth/2fa/recovery-codes"],
    { auth: true, body: {} }
  );
}

export function logout() {
  return apiRequest("/auth/logout", { method: "POST", auth: true });
}

export function getMe() {
  return apiRequest("/auth/me", { method: "GET", auth: true });
}

export function updateProfile({ full_name, bio } = {}) {
  return apiRequest("/auth/profile", {
    method: "PATCH",
    auth: true,
    body: {
      full_name: full_name || null,
      bio: bio || null,
    },
  });
}

export function updateDiaryProfile({ fullName, bio, avatar } = {}) {
  const payload = {
    ...(fullName !== undefined ? { fullName } : {}),
    ...(bio !== undefined ? { bio } : {}),
    ...(avatar !== undefined ? { avatar } : {}),
  };

  return requestWithFallback(
    ["/diary/api/users/me/update", "/auth/profile"],
    {
      method: "POST",
      auth: true,
      body: payload,
    }
  );
}
