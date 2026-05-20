const DEFAULT_API_BASE = "http://127.0.0.1:5000";

export const getApiBase = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // If running on a deployed domain (not localhost / 127.0.0.1)
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return "https://fakereview-duij.onrender.com";
    }
  }
  return import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_APP_BASE_URL || DEFAULT_API_BASE;
};


export const apiFetch = (path, options = {}) => {
  const base = getApiBase();
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  return fetch(url, { ...options, headers });
};

export const fetchJson = async (path, options = {}) => {
  const response = await apiFetch(path, options);
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error || data?.message || "Request failed";
    const error = new Error(message);
    if (data && typeof data === "object") {
      Object.assign(error, data);
    }
    throw error;
  }

  return data;
};

export const postJson = (path, body = {}, options = {}) =>
  fetchJson(path, {
    method: "POST",
    body: JSON.stringify(body),
    ...options
  });

export const fireAndForgetJson = async (path, body = {}, options = {}) => {
  try {
    await postJson(path, body, options);
  } catch (error) {
    console.warn(`Failed to send ${path}`, error);
  }
};
