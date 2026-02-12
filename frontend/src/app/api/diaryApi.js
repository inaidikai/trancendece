import { getToken } from "../../auth/authApi";

const API_BASE = (import.meta.env?.VITE_API_URL || "/api").replace(/\/$/, "");

function looksLikeHtmlDocument(value = "") {
  const trimmed = String(value).trim();
  if (!trimmed) return false;
  return (
    /^<!doctype html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed) ||
    /^<head[\s>]/i.test(trimmed) ||
    /^<body[\s>]/i.test(trimmed) ||
    /<html[\s>]/i.test(trimmed)
  );
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  if (isJson) {
    try {
      return JSON.parse(text);
    } catch {
      return { message: "Invalid JSON response from server" };
    }
  }
  if (looksLikeHtmlDocument(text)) {
    return { message: "Gateway rejected the request payload. Please try again." };
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function diaryRequest(path, { method = "GET", body, headers } = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE}/diary${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    const errorMessage =
      data?.error ||
      data?.message ||
      (response.status === 413
        ? "Request payload too large. Please reduce content size and try again."
        : "Request failed");
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function diaryRequestWithFallback(paths, options) {
  let lastError = null;
  for (const candidate of paths) {
    const [path, method = options?.method || "GET"] = Array.isArray(candidate)
      ? candidate
      : [candidate, options?.method || "GET"];
    try {
      return await diaryRequest(path, { ...options, method });
    } catch (error) {
      lastError = error;
      if (error?.status !== 404 && error?.status !== 405 && error?.status !== 403) {
        throw error;
      }
    }
  }
  throw lastError || new Error("Request failed");
}

export function getMyDiaryProfile() {
  return diaryRequest("/api/users/me");
}

export function getEntries() {
  return diaryRequest("/api/entries");
}

export function createEntry({ title, content = [], coverImage = null, isPrivate = true }) {
  return diaryRequest("/api/entries", {
    method: "POST",
    body: { title, content, coverImage, isPrivate },
  });
}

export function getEntry(entryId) {
  return diaryRequest(`/api/entries/${entryId}`);
}

export function updateEntry(entryId, payload) {
  return diaryRequestWithFallback(
    [
      [`/api/entries/${entryId}/update`, "POST"],
      [`/api/entries/${entryId}`, "PUT"],
    ],
    { body: payload }
  );
}

export function getFriends() {
  return diaryRequest("/api/friends");
}

export function searchUsers(query) {
  return diaryRequest(`/api/users/search?q=${encodeURIComponent(query)}`);
}

export function getCollaborators(entryId) {
  return diaryRequest(`/api/collaborators/entries/${entryId}`);
}

export function inviteCollaborator(entryId, { collaboratorId, role = "editor" }) {
  return diaryRequest(`/api/collaborators/entries/${entryId}/invite`, {
    method: "POST",
    body: { collaboratorId, role },
  });
}

export function removeCollaborator(entryId, collaboratorId) {
  // Use POST remove route so calls pass through WAF, which may block DELETE.
  return diaryRequest(`/api/collaborators/entries/${entryId}/users/${collaboratorId}/remove`, {
    method: "POST",
  });
}

export function getMyCollaborationInvites() {
  return diaryRequest("/api/collaborators/invites");
}

export function acceptCollaborationInvite(inviteId) {
  return diaryRequest(`/api/collaborators/invites/${inviteId}/accept`, {
    method: "POST",
  });
}

export function declineCollaborationInvite(inviteId) {
  return diaryRequest(`/api/collaborators/invites/${inviteId}/decline`, {
    method: "POST",
  });
}
