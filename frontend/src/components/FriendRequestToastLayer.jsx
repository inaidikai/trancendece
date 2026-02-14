import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { makeSocket } from "../socket";
import { getToken } from "../auth/authApi";
import "./FriendRequestToastLayer.css";

const API_BASE = (import.meta.env?.VITE_API_URL || "/api").replace(/\/$/, "");
const FRIEND_REQUEST_TOAST_MS = 30000;
const INFO_TOAST_MS = 12000;
const NOTIFICATION_CREATED_EVENT = "notification:created";
const COLLAB_FRIENDSHIP_REQUIRED_TYPE = "collaboration_friendship_required";

const toRequestId = (value) => String(value || "");

const normalizeFriendRequestToast = (request) => ({
  id: String(request?.id || `pending-${request?.requestId || ""}`),
  requestId: toRequestId(request?.requestId || request?.id),
  name: request?.name || request?.full_name || request?.username || "A user",
  username: request?.username || request?.name || request?.full_name || "A user",
});

async function diaryRequest(path, { method = "GET", body } = {}) {
  const token = getToken();
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
  };

  const response = await fetch(`${API_BASE}/diary${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  }

  return data;
}

export default function FriendRequestToastLayer() {
  const location = useLocation();
  const [toastRequest, setToastRequest] = useState(null);
  const [infoToast, setInfoToast] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [toastError, setToastError] = useState("");
  const shownToastIdsRef = useRef(new Set());
  const shownInfoToastIdsRef = useRef(new Set());
  const socketRef = useRef(null);

  const isAuthPath =
    location.pathname.startsWith("/auth") ||
    ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-2fa", "/create-profile"].includes(
      location.pathname
    );

  const isEnabled = Boolean(getToken()) && !isAuthPath;

  const loadPendingReceivedRequests = useCallback(async () => {
    try {
      const response = await diaryRequest("/api/friends/requests?scope=received");
      const rows = Array.isArray(response?.requests) ? response.requests : [];
      const pendingReceived = rows
        .map(normalizeFriendRequestToast)
        .filter((request) => request.requestId);

      setToastRequest((current) => {
        const currentRequestId = toRequestId(current?.requestId);
        const currentStillPending =
          currentRequestId &&
          pendingReceived.some((request) => request.requestId === currentRequestId);

        if (currentStillPending) {
          return current;
        }

        const nextUnseen = pendingReceived.find(
          (request) => !shownToastIdsRef.current.has(request.requestId)
        );

        if (!nextUnseen) {
          return null;
        }

        shownToastIdsRef.current.add(nextUnseen.requestId);
        return nextUnseen;
      });
    } catch (error) {
      console.warn("Friend toast pending-requests sync failed:", error?.message || error);
    }
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      setToastRequest(null);
      setInfoToast(null);
      setActionBusy(false);
      setToastError("");
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = makeSocket();
    socketRef.current = socket;

    const handleCreated = (payload = {}) => {
      const notification = payload?.notification || {};
      if (notification?.type === COLLAB_FRIENDSHIP_REQUIRED_TYPE) {
        const toastId = toRequestId(notification?.id || `${notification?.entity_id || ""}-friendship`);
        if (!toastId || shownInfoToastIdsRef.current.has(toastId)) return;

        const missingNames = Array.isArray(notification?.metadata?.missingFriends)
          ? notification.metadata.missingFriends
              .map((item) => item?.username)
              .filter(Boolean)
              .join(", ")
          : "";

        shownInfoToastIdsRef.current.add(toastId);
        setInfoToast({
          id: toastId,
          message:
            notification?.message ||
            (missingNames
              ? `Collaboration editing is locked until you are friends with: ${missingNames}.`
              : "Collaboration editing is locked until all required friendships are created."),
        });
        return;
      }

      if (notification?.type !== "friend_request_received") return;

      const requestId = toRequestId(notification?.metadata?.requestId || notification?.entity_id);
      if (!requestId) return;
      if (shownToastIdsRef.current.has(requestId)) return;

      const senderUsername =
        notification?.metadata?.senderUsername ||
        String(notification?.message || "").replace(/\s+sent you a friend request$/i, "") ||
        "A user";

      shownToastIdsRef.current.add(requestId);
      setToastRequest(
        normalizeFriendRequestToast({
          id: `pending-${requestId}`,
          requestId,
          name: senderUsername,
          username: senderUsername,
        })
      );
      setToastError("");
    };

    const handleConnect = () => {
      loadPendingReceivedRequests();
    };

    socket.on("connect", handleConnect);
    socket.on(NOTIFICATION_CREATED_EVENT, handleCreated);

    loadPendingReceivedRequests();

    return () => {
      socket.off("connect", handleConnect);
      socket.off(NOTIFICATION_CREATED_EVENT, handleCreated);
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [isEnabled, loadPendingReceivedRequests]);

  useEffect(() => {
    if (!isEnabled) return undefined;
    const interval = window.setInterval(() => {
      loadPendingReceivedRequests();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [isEnabled, loadPendingReceivedRequests]);

  useEffect(() => {
    const requestId = toRequestId(toastRequest?.requestId);
    if (!requestId) return;

    const timer = window.setTimeout(() => {
      setToastRequest((current) =>
        toRequestId(current?.requestId) === requestId ? null : current
      );
      setToastError("");
    }, FRIEND_REQUEST_TOAST_MS);

    return () => window.clearTimeout(timer);
  }, [toastRequest?.requestId]);

  useEffect(() => {
    const toastId = toRequestId(infoToast?.id);
    if (!toastId) return;

    const timer = window.setTimeout(() => {
      setInfoToast((current) => (toRequestId(current?.id) === toastId ? null : current));
    }, INFO_TOAST_MS);

    return () => window.clearTimeout(timer);
  }, [infoToast?.id]);

  const handleAction = useCallback(
    async (action) => {
      const requestId = toRequestId(toastRequest?.requestId);
      if (!requestId) return;

      setActionBusy(true);
      setToastError("");
      try {
        await diaryRequest(
          `/api/friends/${action}?requestId=${encodeURIComponent(requestId)}`,
          { method: "POST" }
        );
        setToastRequest(null);
        await loadPendingReceivedRequests();
      } catch (error) {
        setToastError(error?.message || `Failed to ${action} friend request`);
      } finally {
        setActionBusy(false);
      }
    },
    [loadPendingReceivedRequests, toastRequest?.requestId]
  );

  if (!isEnabled || (!toastRequest && !infoToast)) return null;

  return (
    <>
      {toastRequest ? (
        <div className="global-friend-toast">
          <div className="global-friend-toast__message">
            {toastRequest.name} sent you a friend request
          </div>
          <div className="global-friend-toast__actions">
            <button
              className="global-friend-toast__btn"
              onClick={() => handleAction("accept")}
              disabled={actionBusy}
            >
              {actionBusy ? "Processing..." : "Accept"}
            </button>
            <button
              className="global-friend-toast__btn global-friend-toast__btn--danger"
              onClick={() => handleAction("decline")}
              disabled={actionBusy}
            >
              Decline
            </button>
          </div>
          {toastError ? <div className="global-friend-toast__error">{toastError}</div> : null}
        </div>
      ) : null}

      {infoToast ? (
        <div
          className={`global-friend-toast global-friend-toast--info ${
            toastRequest ? "global-friend-toast--stacked" : ""
          }`}
        >
          <div className="global-friend-toast__message global-friend-toast__message--info">
            {infoToast.message}
          </div>
        </div>
      ) : null}
    </>
  );
}
