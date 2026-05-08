const API_URL = import.meta.env.VITE_API_URL ?? "";

let _tokens = JSON.parse(localStorage.getItem("tokens") || "null");
let _onTokenChange = null;

export function setTokenListener(fn) {
  _onTokenChange = fn;
}

export function getTokens() {
  return _tokens;
}

export function setTokens(t) {
  _tokens = t;
  if (t) localStorage.setItem("tokens", JSON.stringify(t));
  else localStorage.removeItem("tokens");
  _onTokenChange?.(t);
}

async function refreshTokens() {
  if (!_tokens?.refresh_token) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: _tokens.refresh_token }),
    });
    if (res.ok) {
      const next = await res.json();
      setTokens(next);
      return true;
    }
  } catch {}
  setTokens(null);
  return false;
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (_tokens?.access_token) headers.set("Authorization", `Bearer ${_tokens.access_token}`);

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && _tokens?.refresh_token) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      headers.set("Authorization", `Bearer ${_tokens.access_token}`);
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    }
  }
  return res;
}

export async function apiJSON(path, options = {}) {
  const res = await api(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

/**
 * Upload a file with progress tracking via XMLHttpRequest.
 * @param {string} path - API endpoint
 * @param {File} file - File to upload
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<object>} Parsed JSON response
 */
export function uploadFile(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("upload", file);

    xhr.open("POST", `${API_URL}${path}`);
    if (_tokens?.access_token) {
      xhr.setRequestHeader("Authorization", `Bearer ${_tokens.access_token}`);
    }

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({});
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || err.detail || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.send(formData);
  });
}

export async function login(username, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || "Login failed");
  }
  const tokens = await res.json();
  setTokens(tokens);
  return tokens;
}

export async function register(username, email, password) {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || "Registration failed");
  }
  return res.json();
}

export function logout() {
  if (_tokens?.refresh_token) {
    fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: _tokens.refresh_token }),
    }).catch(() => {});
  }
  setTokens(null);
}
