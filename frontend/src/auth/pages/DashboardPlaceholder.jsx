import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthButton from "../components/AuthButton";
import { clearToken, disable2FA, enable2FA, getMe, getToken } from "../authApi";
import { makeSocket } from "../../socket";

const defaultCurrentUser = {
  id: "",
  name: "User",
  username: "",
  email: "",
  channelName: "",
  avatar: null,
};

const initialFriends = [];
const initialNotifications = [];

const defaultActionModalState = {
  isOpen: false,
  type: "",
  title: "",
  subtitle: "",
  message: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  requiresPassword: false,
  password: "",
  error: "",
  isBusy: false,
  friend: null,
};

const API_BASE = (import.meta.env?.VITE_API_URL || "/api").replace(/\/$/, "");
const FRIEND_REQUEST_TOAST_MS = 30000;

const NOTIFICATION_EVENTS = {
  CREATED: "notification:created",
  MARK_READ: "notification:mark_read",
  MARK_ALL_READ: "notification:mark_all_read",
  ARCHIVE: "notification:archive",
  READ_SUCCESS: "notification:read_success",
  LIST_REQUEST: "notification:list_request",
  LIST_RESPONSE: "notification:list_response",
  COUNT_REQUEST: "notification:count_request",
  COUNT_RESPONSE: "notification:count_response",
  SUBSCRIBED: "notification:subscribed",
};

const SOCIAL_EVENTS = {
  FRIENDS_LIST: "friends_list",
  FRIEND_ONLINE: "friend_online",
  FRIEND_OFFLINE: "friend_offline",
};

const toTimestamp = (value) => {
  if (!value) return Date.now();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

const toAvatarPreview = (value) => {
  if (!value) return null;
  const avatar = String(value);
  if (
    avatar.startsWith("data:") ||
    avatar.startsWith("http://") ||
    avatar.startsWith("https://") ||
    avatar.startsWith("/")
  ) {
    return avatar;
  }
  if (avatar.startsWith("b64url:")) {
    const raw = avatar.slice("b64url:".length);
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return `data:image/jpeg;base64,${padded}`;
  }
  return `data:image/jpeg;base64,${avatar}`;
};

const toAvatarPayload = (value) => {
  if (!value) return null;
  const avatar = String(value).trim();
  if (!avatar) return null;
  if (avatar.startsWith("b64url:")) return avatar;
  const encodeB64Url = (base64) =>
    `b64url:${base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
  if (avatar.startsWith("data:")) {
    const [, base64 = ""] = avatar.split(",");
    return base64 ? encodeB64Url(base64) : null;
  }
  return encodeB64Url(avatar);
};

const normalizeMetadata = (metadata) => {
  if (!metadata) return {};
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return metadata && typeof metadata === "object" ? metadata : {};
};

const getCollaborationInviteId = (note) => {
  const metadata = normalizeMetadata(note?.metadata);
  const inviteId = metadata.inviteId || metadata.invite_id || "";
  return inviteId ? String(inviteId) : "";
};

const getFriendRequestId = (note) => {
  const metadata = normalizeMetadata(note?.metadata);
  const requestId = metadata.requestId || metadata.request_id || note?.entityId || "";
  return requestId ? String(requestId) : "";
};

const normalizeNotification = (note) => ({
  id: String(note?.id ?? `tmp-${Date.now()}`),
  title: note?.title || "Notification",
  message: note?.message || "",
  type: note?.type || "",
  metadata: normalizeMetadata(note?.metadata),
  entityId: String(note?.entity_id || ""),
  unread: typeof note?.is_read === "boolean" ? !note.is_read : !!note?.unread,
  time: toTimestamp(note?.created_at || note?.time),
});

const normalizeFriend = (friend) => ({
  id: String(friend?.id || ""),
  name: friend?.full_name || friend?.username || "Unknown",
  username: friend?.username || "",
  avatar: toAvatarPreview(friend?.avatar || friend?.avatar_url || null),
  bio: friend?.bio || "",
  online: Boolean(friend?.is_online),
  status: "friend",
});

const normalizePending = (request) => ({
  id: `pending-${request?.id}`,
  requestId: String(request?.id || ""),
  targetId: String(request?.user_id || ""),
  name: request?.full_name || request?.username || "Unknown",
  username: request?.username || "",
  avatar: toAvatarPreview(request?.avatar || request?.avatar_url || null),
  bio: request?.bio || "",
  online: false,
  status: "pending",
  direction: request?.direction || "sent",
});

const toToastRequest = (request) => ({
  id: String(request?.id || `pending-${request?.requestId || ""}`),
  requestId: String(request?.requestId || ""),
  name: request?.name || request?.username || "A user",
  username: request?.username || request?.name || "A user",
  status: "pending",
  direction: "received",
});

const parseSocketPayload = (payload) => {
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return parsed?.payload || parsed;
    } catch {
      return {};
    }
  }
  if (payload && typeof payload === "object" && payload.payload) {
    return payload.payload;
  }
  return payload || {};
};

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

const getInitials = (label = "") =>
  label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0].toUpperCase())
    .join("");

const getProfileInitial = (user) => {
  const source = user.channelName || user.name || "U";
  return source.trim()[0]?.toUpperCase() || "U";
};

function FriendsModal({
  isOpen,
  onClose,
  friends,
  onRemove,
  onAccept,
  onDecline,
  onInvite,
  onReload,
  inviteUsername,
  setInviteUsername,
  inviteError,
  setInviteError,
  friendsError,
  isLoading,
}) {
  if (!isOpen) return null;

  const collaboratorsCount = friends.filter((f) => f.status === "friend").length;
  const pending = friends.filter((f) => f.status === "pending");
  const accepted = friends.filter((f) => f.status === "friend");

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose}>
      <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dashboard-modal-header">
          <div>
            <h2 className="dashboard-modal-title">Your friends</h2>
            <p className="dashboard-modal-subtitle">Invite your friend</p>
          </div>
          <button className="dashboard-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="dashboard-modal-content">
          <div className="dashboard-invite-row">
            <input
              className={`auth-input ${inviteError ? "error" : ""}`}
              placeholder="Enter your friend’s username"
              value={inviteUsername}
              onChange={(e) => {
                setInviteUsername(e.target.value);
                setInviteError("");
              }}
            />
            <AuthButton onClick={onInvite}>Invite</AuthButton>
          </div>
          {inviteError && <div className="auth-input-help">{inviteError}</div>}

          <h3 className="dashboard-section-title">Pending invites</h3>
          {friendsError && (
            <div className="auth-input-help">
              {friendsError}{" "}
              <button className="dashboard-link" onClick={onReload}>
                Retry
              </button>
            </div>
          )}
          {isLoading && <p className="dashboard-muted">Loading friends...</p>}
          {pending.length === 0 ? (
            <p className="dashboard-muted">No pending invites</p>
          ) : (
            <div className="dashboard-list">
              {pending.map((friend) => (
                <div className="dashboard-list-row" key={friend.id}>
                  <div className="dashboard-avatar-wrap">
                    <div className="dashboard-avatar">
                      {friend.avatar ? (
                        <img src={friend.avatar} alt={friend.name} className="dashboard-avatar-img" />
                      ) : (
                        getInitials(friend.name)
                      )}
                    </div>
                    <span className="dashboard-avatar-status muted" />
                  </div>
                  <div className="dashboard-list-info">
                    <div className="dashboard-list-name-row">
                      <div className="dashboard-list-name">{friend.name}</div>
                      <div className="dashboard-list-status pending">
                        {friend.direction === "received" ? "Incoming" : "Pending"}
                      </div>
                    </div>
                    {friend.bio ? <div className="dashboard-list-bio">{friend.bio}</div> : null}
                  </div>
                  <div className="dashboard-list-actions">
                    {friend.direction === "received" ? (
                      <>
                        <button className="dashboard-link" onClick={() => onAccept(friend)}>
                          Accept
                        </button>
                        <button className="dashboard-link danger" onClick={() => onDecline(friend)}>
                          Decline
                        </button>
                      </>
                    ) : (
                      <button className="invite-remove" onClick={() => onRemove(friend)}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 className="dashboard-section-title">Friends</h3>
          <div className="dashboard-list">
            {accepted.map((friend) => (
              <div className="dashboard-list-row" key={friend.id}>
                <div className="dashboard-avatar-wrap">
                  <div className="dashboard-avatar">
                    {friend.avatar ? (
                      <img src={friend.avatar} alt={friend.name} className="dashboard-avatar-img" />
                    ) : (
                      getInitials(friend.name)
                    )}
                  </div>
                  <span
                    className={`dashboard-avatar-status ${friend.online ? "online" : "muted"}`}
                  />
                </div>
                <div className="dashboard-list-info">
                  <div className="dashboard-list-name-row">
                    <div className="dashboard-list-name">{friend.name}</div>
                    <div className="dashboard-list-status friend">Friend</div>
                  </div>
                  {friend.bio ? <div className="dashboard-list-bio">{friend.bio}</div> : null}
                </div>
                <div className="dashboard-list-actions">
                  <button className="invite-remove" onClick={() => onRemove(friend)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsPopover({
  isOpen,
  notifications,
  isLoading,
  error,
  onRetry,
  onClearAll,
  isClearing,
  onAcceptInvite,
  onDeclineInvite,
  inviteActionBusyById,
  inviteActionResultById,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  friendActionBusyById,
  friendActionResultById,
  menuRef,
}) {
  if (!isOpen) return null;

  return (
    <div className="dashboard-popover" ref={menuRef}>
      <div className="dashboard-popover-header">
        <span>Notifications</span>
        <button
          className="dashboard-link"
          onClick={onClearAll}
          disabled={isClearing || notifications.length === 0}
        >
          {isClearing ? "Clearing..." : "Clear all"}
        </button>
      </div>
      <div className="dashboard-popover-list">
        {isLoading ? (
          <div className="dashboard-muted">Loading notifications...</div>
        ) : error ? (
          <div className="dashboard-muted">
            {error}
            <button className="dashboard-link" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="dashboard-muted">No notifications left</div>
        ) : (
          notifications.map((note) => (
            (() => {
              const noteId = String(note.id);
              const isCollabInvite = note.type === "collaboration_invite";
              const inviteId = getCollaborationInviteId(note);
              const showInviteActions = isCollabInvite && Boolean(inviteId);
              const isFriendRequest = note.type === "friend_request_received";
              const requestId = getFriendRequestId(note);
              const showFriendActions = isFriendRequest && Boolean(requestId);
              const inviteBusy = Boolean(inviteActionBusyById[noteId]);
              const friendBusy = Boolean(friendActionBusyById[noteId]);
              const isBusy = inviteBusy || friendBusy;
              const inviteActionResult = inviteActionResultById[noteId] || "";
              const friendActionResult = friendActionResultById[noteId] || "";
              const actionResult = inviteActionResult || friendActionResult;
              const friendStatusText =
                friendActionResult === "accepted"
                  ? "Friend request accepted"
                  : friendActionResult === "rejected"
                    ? "Friend request rejected"
                    : "";
              const collaborationStatusText =
                inviteActionResult === "accepted"
                  ? "Collaboration invite accepted"
                  : inviteActionResult === "declined"
                    ? "Collaboration invite declined"
                    : "";

              return (
                <div
                  key={note.id}
                  className={`dashboard-popover-item ${note.unread ? "unread" : ""}`}
                >
                  <div className="dashboard-popover-title">
                    {note.title}
                    {note.unread && <span className="dashboard-dot" />}
                  </div>
                  <div className="dashboard-popover-message">{note.message}</div>
                  {showInviteActions && !actionResult && (
                    <div className="dashboard-popover-actions">
                      <button
                        className="dashboard-link"
                        disabled={isBusy}
                        onClick={() => onAcceptInvite(note)}
                      >
                        {isBusy ? "Processing..." : "Accept"}
                      </button>
                      <button
                        className="dashboard-link danger"
                        disabled={isBusy}
                        onClick={() => onDeclineInvite(note)}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {showFriendActions && !actionResult && (
                    <div className="dashboard-popover-actions">
                      <button
                        className="dashboard-link"
                        disabled={isBusy}
                        onClick={() => onAcceptFriendRequest(note)}
                      >
                        {isBusy ? "Processing..." : "Accept"}
                      </button>
                      <button
                        className="dashboard-link danger"
                        disabled={isBusy}
                        onClick={() => onDeclineFriendRequest(note)}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {actionResult && (
                    <div className="dashboard-popover-action-status">
                      {friendStatusText || collaborationStatusText}
                    </div>
                  )}
                  <div className="dashboard-popover-time">
                    {new Date(note.time).toLocaleString()}
                  </div>
                </div>
              );
            })()
          ))
        )}
      </div>
    </div>
  );
}

function ProfileMenu({
  isOpen,
  menuRef,
  currentUser,
  onProfile,
  onToggle2FA,
  onLogout,
  twoFAEnabled,
  onOpenTerms,
  onOpenPrivacy,
}) {
  if (!isOpen) return null;

  return (
    <div className="dashboard-popover profile" ref={menuRef}>
      <div className="profile-menu-header">
        <div className="dashboard-avatar large">
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name || "Profile"}
              className="dashboard-avatar-img"
            />
          ) : (
            getProfileInitial(currentUser)
          )}
        </div>
        <div>
          <div className="profile-name">{currentUser.name}</div>
          <div className="profile-email">{currentUser.email}</div>
        </div>
      </div>
      <button className="profile-item" onClick={onProfile}>
        Customize profile
      </button>
      <div className="profile-divider" />
      <div className="profile-item twofa">
        <span className="profile-item-label">Two-factor authentication</span>
        <button
          className={`profile-switch ${twoFAEnabled ? "on" : ""}`}
          onClick={onToggle2FA}
          aria-label="Toggle two-factor authentication"
        >
          <span className="profile-switch-thumb" />
        </button>
      </div>
      <div className="profile-divider" />
      <button className="profile-item link" onClick={onLogout}>
        Log out
      </button>
      <div className="profile-footer-links">
        <span className="profile-footer-text">
          Our{" "}
          <button className="profile-footer-link" onClick={onOpenTerms}>
            Terms
          </button>{" "}
          and{" "}
          <button className="profile-footer-link" onClick={onOpenPrivacy}>
            Privacy Policy
          </button>
        </span>
      </div>
    </div>
  );
}

function CustomizeProfileModal({
  isOpen,
  onClose,
  onSave,
  username,
  displayName,
  setDisplayName,
  bio,
  setBio,
  avatarPreview,
  onAvatarChange,
  profileError,
  isSaving,
  isAvatarProcessing,
}) {
  if (!isOpen) return null;

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose}>
      <div className="dashboard-modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dashboard-modal-header">
          <div>
            <h2 className="dashboard-modal-title">Customize profile</h2>
            <p className="dashboard-modal-subtitle">Personalize your space</p>
          </div>
          <button className="dashboard-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="dashboard-modal-content">
          <div className="auth-center">
            <div className="profile-avatar">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  style={{ width: "100%", height: "100%", borderRadius: "50%" }}
                />
              ) : (
                "Upload profile"
              )}
            </div>
            <label className="auth-link auth-upload-link">
              Upload
              <input type="file" accept="image/*" onChange={onAvatarChange} hidden />
            </label>
          </div>
          <div className="auth-input-group">
            <label className="auth-input-label">Display name</label>
            <input
              className="auth-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="auth-input-group">
            <label className="auth-input-label">Username</label>
            <input
              className="auth-input readonly-input"
              value={username || ""}
              disabled
              placeholder="Username"
            />
          </div>
          <div className="auth-input-group">
            <label className="auth-input-label">Bio</label>
            <textarea
              className="auth-input auth-textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a short bio (max 50 words)"
              rows={3}
            />
            <span className="auth-input-help">
              {bio.trim() ? bio.trim().split(/\s+/).length : 0}/50 words
            </span>
          </div>
          {profileError && <div className="auth-input-help">{profileError}</div>}
          <AuthButton block onClick={onSave} disabled={isSaving || isAvatarProcessing}>
            {isAvatarProcessing ? "Processing image..." : isSaving ? "Saving..." : "Save"}
          </AuthButton>
        </div>
      </div>
    </div>
  );
}

function DashboardActionModal({
  isOpen,
  title,
  subtitle,
  message,
  confirmLabel,
  cancelLabel,
  requiresPassword,
  password,
  error,
  isBusy,
  onPasswordChange,
  onCancel,
  onConfirm,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="dashboard-modal-backdrop"
      onClick={() => {
        if (!isBusy) onCancel();
      }}
    >
      <div className="dashboard-modal dashboard-action-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dashboard-modal-header">
          <div>
            <h2 className="dashboard-modal-title">{title}</h2>
            {subtitle ? <p className="dashboard-modal-subtitle">{subtitle}</p> : null}
          </div>
          <button className="dashboard-close" onClick={onCancel} disabled={isBusy}>
            ✕
          </button>
        </div>

        <div className="dashboard-modal-content">
          {message ? <p className="dashboard-action-copy">{message}</p> : null}

          {requiresPassword ? (
            <div className="auth-input-group dashboard-action-input-row">
              <label className="auth-input-label">Password</label>
              <input
                className={"auth-input" + (error ? " error" : "")}
                type="password"
                value={password}
                placeholder="Enter your password"
                onChange={(e) => onPasswordChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onConfirm();
                  }
                }}
                autoFocus
                disabled={isBusy}
              />
            </div>
          ) : null}

          {error ? <div className="auth-input-help dashboard-action-error">{error}</div> : null}

          <div className="dashboard-action-footer">
            <AuthButton variant="secondary" onClick={onCancel} disabled={isBusy}>
              {cancelLabel || "Cancel"}
            </AuthButton>
            <AuthButton onClick={onConfirm} disabled={isBusy}>
              {isBusy ? "Processing..." : confirmLabel || "Confirm"}
            </AuthButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function FriendRequestToast({ request, onAccept, onDecline }) {
  if (!request) return null;
  return (
    <div className="dashboard-toast">
      <div className="dashboard-toast-message">
        {request.name} sent you a friend request
      </div>
      <div className="dashboard-toast-actions">
        <button className="dashboard-link" onClick={() => onAccept(request)}>
          Accept
        </button>
        <button className="dashboard-link danger" onClick={() => onDecline(request)}>
          Decline
        </button>
      </div>
    </div>
  );
}

export default function DashboardPlaceholder({ navigate }) {
  const [currentUser, setCurrentUser] = useState(defaultCurrentUser);
  const [friends, setFriends] = useState(initialFriends);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState("");
  const [notifications, setNotifications] = useState(initialNotifications);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsClearing, setNotificationsClearing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [toastRequest, setToastRequest] = useState(null);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileAvatarPreview, setProfileAvatarPreview] = useState(null);
  const [profileBio, setProfileBio] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileAvatarProcessing, setProfileAvatarProcessing] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [inviteActionBusyById, setInviteActionBusyById] = useState({});
  const [inviteActionResultById, setInviteActionResultById] = useState({});
  const [friendActionBusyById, setFriendActionBusyById] = useState({});
  const [friendActionResultById, setFriendActionResultById] = useState({});
  const [actionModal, setActionModal] = useState(defaultActionModalState);
  const profileWrapperRef = useRef(null);
  const profileMenuRef = useRef(null);
  const notificationsWrapperRef = useRef(null);
  const notificationsPopoverRef = useRef(null);
  const socketRef = useRef(null);
  const notificationListRequestSeqRef = useRef(0);
  const latestNotificationListRequestRef = useRef(0);
  const clearAllSyncTimerRef = useRef(null);
  const clearedNotificationIdsRef = useRef(new Set());
  const shownFriendToastIdsRef = useRef(new Set());
  const unreadFromList = useMemo(
    () => notifications.filter((note) => note.unread).length,
    [notifications]
  );
  const safeUnreadCount = Number.isFinite(Number(unreadCount))
    ? Number(unreadCount)
    : unreadFromList;
  const releasePointerLockForUi = useCallback(() => {
    if (typeof document === "undefined") return;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }, []);

  const requestNotificationsList = useCallback((socket, { showLoader = true } = {}) => {
    if (!socket) return 0;
    const requestId = (notificationListRequestSeqRef.current += 1);
    latestNotificationListRequestRef.current = requestId;
    setNotificationsError("");
    if (showLoader) {
      setNotificationsLoading(true);
    }
    socket.emit(NOTIFICATION_EVENTS.LIST_REQUEST, { limit: 50, offset: 0, requestId });
    socket.emit(NOTIFICATION_EVENTS.COUNT_REQUEST);
    return requestId;
  }, []);

  const markNotificationAsRead = useCallback((notificationId) => {
    const socket = socketRef.current;
    if (socket && notificationId) {
      socket.emit(NOTIFICATION_EVENTS.MARK_READ, { notificationIds: [String(notificationId)] });
    }
    setNotifications((prev) =>
      prev.map((note) =>
        String(note.id) === String(notificationId) ? { ...note, unread: false } : note
      )
    );
  }, []);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError("");
    try {
      const response = await diaryRequest("/api/users/me");
      const user = response?.user || response || {};
      const resolvedName = user.full_name || user.username || "User";
      const avatar = user.avatar || user.avatar_url || null;
      const bio = user.bio || "";

      setCurrentUser({
        id: String(user.id || ""),
        name: resolvedName,
        username: user.username || "",
        email: user.email || "",
        channelName: resolvedName,
        avatar: toAvatarPreview(avatar),
      });
      setProfileDisplayName(resolvedName);
      setProfileBio(bio);
      setProfileAvatarPreview(toAvatarPreview(avatar));
    } catch (error) {
      setProfileError(error?.message || "Failed to load profile");
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadTwoFAStatus = useCallback(async () => {
    try {
      const response = await getMe();
      const me = response?.data || {};
      setTwoFAEnabled(Boolean(me.is_2fa_enabled));
    } catch {
      // Keep existing switch state if status endpoint fails.
    }
  }, []);

  const loadFriendsData = useCallback(async () => {
    setFriendsLoading(true);
    setFriendsError("");
    try {
      const [friendsResponse, pendingResponse] = await Promise.all([
        diaryRequest("/api/friends"),
        diaryRequest("/api/friends/requests?scope=all"),
      ]);

      const accepted = Array.isArray(friendsResponse?.friends)
        ? friendsResponse.friends.map(normalizeFriend)
        : [];
      const pending = Array.isArray(pendingResponse?.requests)
        ? pendingResponse.requests.map(normalizePending)
        : [];

      setFriends([...pending, ...accepted]);
      const receivedPending = pending.filter((request) => request.direction === "received");
      setToastRequest((prev) => {
        const previousRequestId = prev?.requestId ? String(prev.requestId) : "";
        const previousStillPending =
          previousRequestId &&
          receivedPending.some((request) => String(request.requestId) === previousRequestId);

        if (previousStillPending) {
          return prev;
        }

        const unseenRequest = receivedPending.find(
          (request) => !shownFriendToastIdsRef.current.has(String(request.requestId))
        );

        if (!unseenRequest) {
          return null;
        }

        const toast = toToastRequest(unseenRequest);
        if (toast.requestId) {
          shownFriendToastIdsRef.current.add(toast.requestId);
        }
        return toast;
      });
    } catch (error) {
      setFriendsError(error?.message || "Failed to load friends");
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    loadTwoFAStatus();
  }, [loadTwoFAStatus]);

  useEffect(() => {
    loadFriendsData();
  }, [loadFriendsData]);

  useEffect(() => {
    if (!friendsOpen) return;
    loadFriendsData();
  }, [friendsOpen, loadFriendsData]);

  useEffect(() => {
    if (!friendsOpen) return;
    const timer = setInterval(() => {
      loadFriendsData();
    }, 10000);
    return () => clearInterval(timer);
  }, [friendsOpen, loadFriendsData]);

  useEffect(() => {
    const requestId = toastRequest?.requestId ? String(toastRequest.requestId) : "";
    if (!requestId) return;

    const timer = window.setTimeout(() => {
      setToastRequest((current) =>
        String(current?.requestId || "") === requestId ? null : current
      );
    }, FRIEND_REQUEST_TOAST_MS);

    return () => window.clearTimeout(timer);
  }, [toastRequest?.requestId]);

  useEffect(() => {
    const socket = makeSocket();
    socketRef.current = socket;

    const loadNotifications = () => {
      requestNotificationsList(socket, { showLoader: true });
    };

    const handleConnect = () => {
      setNotificationsError("");
    };

    const handleSubscribed = (payload = {}) => {
      setUnreadCount(Number(payload.unreadCount || 0));
      loadNotifications();
    };

    const handleListResponse = (payload = {}) => {
      const responseRequestId = Number(payload.requestId || payload.request_id || 0);
      if (
        Number.isFinite(responseRequestId) &&
        responseRequestId > 0 &&
        responseRequestId < latestNotificationListRequestRef.current
      ) {
        return;
      }

      const rows = Array.isArray(payload.notifications) ? payload.notifications : [];
      const nextNotifications = rows
        .map(normalizeNotification)
        .filter((note) => !clearedNotificationIdsRef.current.has(String(note?.id || "")));
      setNotifications(nextNotifications);
      setNotificationsLoading(false);
      setNotificationsError("");
    };

    const handleCountResponse = (payload = {}) => {
      setUnreadCount(Number(payload.count || 0));
    };

    const handleCreated = (payload = {}) => {
      const item = payload.notification ? normalizeNotification(payload.notification) : null;
      if (!item) return;
      setNotifications((prev) => [item, ...prev]);
      setUnreadCount((prev) => Number(prev || 0) + (item.unread ? 1 : 0));

      if (item.type === "friend_request_received") {
        const requestId = String(item?.metadata?.requestId || item.entityId || "");
        if (!requestId) return;
        const senderUsername =
          item?.metadata?.senderUsername ||
          item.message.replace(/\s+sent you a friend request$/i, "") ||
          "A user";
        if (!shownFriendToastIdsRef.current.has(requestId)) {
          shownFriendToastIdsRef.current.add(requestId);
          setToastRequest(
            toToastRequest({
              id: `pending-${requestId}`,
              requestId,
              name: senderUsername,
              username: senderUsername,
            })
          );
        }
        loadFriendsData();
      }
    };

    const handleReadSuccess = (payload = {}) => {
      const ids = Array.isArray(payload.notificationIds)
        ? new Set(payload.notificationIds.map(String))
        : null;
      setNotifications((prev) =>
        prev.map((note) => {
          if (!ids) return { ...note, unread: false };
          return ids.has(String(note.id)) ? { ...note, unread: false } : note;
        })
      );
      if (typeof payload.unreadCount !== "undefined") {
        setUnreadCount(Number(payload.unreadCount || 0));
      }
    };

    const handleFriendsList = (rawPayload) => {
      const payload = parseSocketPayload(rawPayload);
      const online = new Set((payload?.onlineFriends || []).map(String));
      const offline = new Set((payload?.offlineFriends || []).map(String));

      setFriends((prev) =>
        prev.map((friend) => {
          if (friend.status !== "friend") return friend;
          const id = String(friend.id);
          if (online.has(id)) return { ...friend, online: true };
          if (offline.has(id)) return { ...friend, online: false };
          return friend;
        })
      );
    };

    const handleFriendOnline = (rawPayload) => {
      const payload = parseSocketPayload(rawPayload);
      const friendId = String(payload?.userId || "");
      if (!friendId) return;
      setFriends((prev) =>
        prev.map((friend) =>
          friend.status === "friend" && String(friend.id) === friendId
            ? { ...friend, online: true }
            : friend
        )
      );
    };

    const handleFriendOffline = (rawPayload) => {
      const payload = parseSocketPayload(rawPayload);
      const friendId = String(payload?.userId || "");
      if (!friendId) return;
      setFriends((prev) =>
        prev.map((friend) =>
          friend.status === "friend" && String(friend.id) === friendId
            ? { ...friend, online: false }
            : friend
        )
      );
    };

    const handleSocketError = (payload = {}) => {
      if (!payload.code || !String(payload.code).startsWith("NOTIFICATION_")) return;
      setNotificationsLoading(false);
      setNotificationsError(payload.message || "Notification request failed");
    };

    const handleConnectError = () => {
      setNotificationsLoading(false);
      setNotificationsError("Realtime connection failed");
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on(NOTIFICATION_EVENTS.SUBSCRIBED, handleSubscribed);
    socket.on(NOTIFICATION_EVENTS.LIST_RESPONSE, handleListResponse);
    socket.on(NOTIFICATION_EVENTS.COUNT_RESPONSE, handleCountResponse);
    socket.on(NOTIFICATION_EVENTS.CREATED, handleCreated);
    socket.on(NOTIFICATION_EVENTS.READ_SUCCESS, handleReadSuccess);
    socket.on(SOCIAL_EVENTS.FRIENDS_LIST, handleFriendsList);
    socket.on(SOCIAL_EVENTS.FRIEND_ONLINE, handleFriendOnline);
    socket.on(SOCIAL_EVENTS.FRIEND_OFFLINE, handleFriendOffline);
    socket.on("error", handleSocketError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off(NOTIFICATION_EVENTS.SUBSCRIBED, handleSubscribed);
      socket.off(NOTIFICATION_EVENTS.LIST_RESPONSE, handleListResponse);
      socket.off(NOTIFICATION_EVENTS.COUNT_RESPONSE, handleCountResponse);
      socket.off(NOTIFICATION_EVENTS.CREATED, handleCreated);
      socket.off(NOTIFICATION_EVENTS.READ_SUCCESS, handleReadSuccess);
      socket.off(SOCIAL_EVENTS.FRIENDS_LIST, handleFriendsList);
      socket.off(SOCIAL_EVENTS.FRIEND_ONLINE, handleFriendOnline);
      socket.off(SOCIAL_EVENTS.FRIEND_OFFLINE, handleFriendOffline);
      socket.off("error", handleSocketError);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [requestNotificationsList]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const socket = socketRef.current;
    if (!socket) return;

    requestNotificationsList(socket, { showLoader: true });

    if (safeUnreadCount > 0) {
      socket.emit(NOTIFICATION_EVENTS.MARK_ALL_READ);
    }
  }, [notificationsOpen, safeUnreadCount, requestNotificationsList]);

  useEffect(() => {
    if (!profileOpen) return;
    const handleOutside = (event) => {
      if (profileMenuRef.current?.contains(event.target)) return;
      if (profileWrapperRef.current?.contains(event.target)) return;
      setProfileOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [profileOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handleOutside = (event) => {
      if (notificationsPopoverRef.current?.contains(event.target)) return;
      if (notificationsWrapperRef.current?.contains(event.target)) return;
      setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!(friendsOpen || notificationsOpen || profileOpen || profileModalOpen || actionModal.isOpen)) return;
    releasePointerLockForUi();
  }, [
    friendsOpen,
    notificationsOpen,
    profileOpen,
    profileModalOpen,
    actionModal.isOpen,
    releasePointerLockForUi,
  ]);

  useEffect(() => {
    return () => {
      if (clearAllSyncTimerRef.current) {
        clearTimeout(clearAllSyncTimerRef.current);
        clearAllSyncTimerRef.current = null;
      }
    };
  }, []);

  const closeActionModal = useCallback(() => {
    setActionModal(defaultActionModalState);
  }, []);

  const openRemoveFriendModal = useCallback((friend) => {
    if (!friend) return;
    const removeLabel =
      friend.status === "pending"
        ? friend.direction === "received"
          ? "Decline"
          : "Cancel request"
        : "Remove";

    const message =
      friend.status === "pending"
        ? friend.direction === "received"
          ? "Decline friend request from " + friend.name + "?"
          : "Cancel friend request to " + friend.name + "?"
        : "Remove " + friend.name + " from your friend list?";

    setActionModal({
      isOpen: true,
      type: "remove_friend",
      title: "Update friend list",
      subtitle: "Confirm this action",
      message,
      confirmLabel: removeLabel,
      cancelLabel: "Keep",
      requiresPassword: false,
      password: "",
      error: "",
      isBusy: false,
      friend,
    });
  }, []);

  const handleActionModalPasswordChange = useCallback((value) => {
    setActionModal((prev) => ({ ...prev, password: value, error: "" }));
  }, []);

  const handleConfirmActionModal = useCallback(async () => {
    if (!actionModal.isOpen || actionModal.isBusy) return;

    if (actionModal.type === "remove_friend") {
      const friend = actionModal.friend;
      if (!friend) {
        closeActionModal();
        return;
      }

      setActionModal((prev) => ({ ...prev, isBusy: true, error: "" }));
      try {
        if (friend.status === "pending" && friend.requestId) {
          if (friend.direction === "received") {
            await diaryRequest(
              "/api/friends/decline?requestId=" + encodeURIComponent(friend.requestId),
              { method: "POST" }
            );
          } else {
            await diaryRequest("/api/friends/request/" + friend.requestId + "/cancel", {
              method: "POST",
            });
          }
        } else {
          await diaryRequest("/api/friends/remove/" + friend.id, {
            method: "POST",
          });
        }
        await loadFriendsData();
        closeActionModal();
      } catch (error) {
        setActionModal((prev) => ({
          ...prev,
          isBusy: false,
          error: error?.message || "Failed to update friend list",
        }));
      }
      return;
    }

    if (actionModal.type === "disable_2fa") {
      const password = actionModal.password.trim();
      if (!password) {
        setActionModal((prev) => ({
          ...prev,
          error: "Password is required to disable 2FA.",
        }));
        return;
      }

      setActionModal((prev) => ({ ...prev, isBusy: true, error: "" }));
      try {
        await disable2FA({ password });
        setTwoFAEnabled(false);
        closeActionModal();
      } catch (error) {
        setActionModal((prev) => ({
          ...prev,
          isBusy: false,
          error: error?.message || "Failed to disable 2FA",
        }));
      }
      return;
    }

    if (actionModal.type === "enable_2fa") {
      setActionModal((prev) => ({ ...prev, isBusy: true, error: "" }));
      try {
        await enable2FA();
        setTwoFAEnabled(true);
        closeActionModal();
      } catch (error) {
        setActionModal((prev) => ({
          ...prev,
          isBusy: false,
          error: error?.message || "Failed to enable 2FA",
        }));
      }
    }
  }, [actionModal, closeActionModal, loadFriendsData]);

  const handleInvite = async () => {
    const username = inviteUsername.trim();
    if (!username) {
      setInviteError("Friend username is required");
      return;
    }
    setInviteError("");
    try {
      await diaryRequest("/api/friends/request", {
        method: "POST",
        body: { username },
      });
      setInviteUsername("");
      await loadFriendsData();
    } catch (error) {
      setInviteError(error?.message || "Failed to send invite");
    }
  };

  const handleAcceptRequest = async (requestInput) => {
    const request = requestInput || toastRequest;
    if (!request?.requestId) return;
    try {
      await diaryRequest(
        `/api/friends/accept?requestId=${encodeURIComponent(request.requestId)}`,
        {
        method: "POST",
        }
      );
      if (toastRequest?.requestId === request.requestId) {
        setToastRequest(null);
      }
      await loadFriendsData();
    } catch (error) {
      setInviteError(error?.message || "Failed to accept request");
    }
  };

  const handleDeclineRequest = async (requestInput) => {
    const request = requestInput || toastRequest;
    if (!request?.requestId) return;
    try {
      await diaryRequest(
        `/api/friends/decline?requestId=${encodeURIComponent(request.requestId)}`,
        {
        method: "POST",
        }
      );
      if (toastRequest?.requestId === request.requestId) {
        setToastRequest(null);
      }
      await loadFriendsData();
    } catch (error) {
      setInviteError(error?.message || "Failed to decline request");
    }
  };

  const handleProfileClick = () => {
    setProfileError("");
    setProfileOpen(false);
    setProfileModalOpen(true);
    loadProfile();
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

  const compressAvatar = async (file) => {
    const dataUrl = await fileToDataUrl(file);
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = dataUrl;
    });

    const maxSize = 256;
    const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;

    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.75);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5 MB max)
    if (file.size > 5 * 1024 * 1024) {
      setProfileError("Avatar file must be 5 MB or less.");
      return;
    }

    setProfileAvatarProcessing(true);
    try {
      const compressed = await compressAvatar(file);
      setProfileAvatarPreview(compressed);
      setProfileError("");
    } catch (error) {
      setProfileError(error?.message || "Failed to process image");
    } finally {
      setProfileAvatarProcessing(false);
    }
  };

  const handleSaveProfile = async () => {
    if (profileAvatarProcessing) return;
    const fullName = profileDisplayName.trim();
    const bio = profileBio.trim();

    if (!fullName) {
      setProfileError("Display name is required");
      return;
    }

    setProfileSaving(true);
    setProfileError("");
    try {
      const response = await diaryRequest("/api/users/me/update", {
        method: "POST",
        body: {
          fullName,
          bio: bio || null,
          avatar: toAvatarPayload(profileAvatarPreview),
        },
      });
      const user = response?.user || {};
      const resolvedName = user.full_name || user.username || fullName;
      const avatar = user.avatar || user.avatar_url || toAvatarPayload(profileAvatarPreview);
      const resolvedBio = user.bio || bio;

      setCurrentUser((prev) => ({
        id: String(user.id || prev.id || ""),
        name: resolvedName,
        username: user.username || prev.username || "",
        email: user.email || prev.email || "",
        channelName: resolvedName,
        avatar: toAvatarPreview(avatar),
      }));
      setProfileDisplayName(resolvedName);
      setProfileBio(resolvedBio);
      setProfileAvatarPreview(toAvatarPreview(avatar));
      setProfileModalOpen(false);
    } catch (error) {
      setProfileError(error?.message || "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleBioChange = (value) => {
    const words = value.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 50) {
      setProfileBio(value);
      return;
    }
    setProfileBio(words.slice(0, 50).join(" ") + " ");
  };

  const handleToggle2FA = () => {
    if (twoFAEnabled) {
      setActionModal({
        isOpen: true,
        type: "disable_2fa",
        title: "Disable two-factor authentication",
        subtitle: "Confirm your password",
        message: "Enter your password to disable 2FA.",
        confirmLabel: "Disable",
        cancelLabel: "Cancel",
        requiresPassword: true,
        password: "",
        error: "",
        isBusy: false,
        friend: null,
      });
      return;
    }

    setActionModal({
      isOpen: true,
      type: "enable_2fa",
      title: "Enable two-factor authentication",
      subtitle: "Security update",
      message: "Enable 2FA now? You will receive a verification code by email on next login.",
      confirmLabel: "Enable",
      cancelLabel: "Cancel",
      requiresPassword: false,
      password: "",
      error: "",
      isBusy: false,
      friend: null,
    });
  };

  const handleLogout = () => {
    console.log("POST /api/auth/logout");
    clearToken();
    navigate("login");
  };

  const handleClearAllNotifications = useCallback(async () => {
    if (notificationsClearing) return;
    const notificationIds = notifications
      .map((note) => String(note?.id || ""))
      .filter(Boolean);
    if (notificationIds.length === 0) return;

    setNotificationsClearing(true);
    setNotificationsError("");

    try {
      // Optimistic clear for immediate UX: show "No notifications" right away.
      notificationIds.forEach((id) => clearedNotificationIdsRef.current.add(id));
      setNotifications([]);
      setUnreadCount(0);
      setInviteActionBusyById({});
      setInviteActionResultById({});
      setFriendActionBusyById({});
      setFriendActionResultById({});

      const socket = socketRef.current;
      if (socket) {
        socket.emit(NOTIFICATION_EVENTS.ARCHIVE, { notificationIds });
        socket.emit(NOTIFICATION_EVENTS.MARK_ALL_READ);
        socket.emit(NOTIFICATION_EVENTS.COUNT_REQUEST);
        if (clearAllSyncTimerRef.current) {
          clearTimeout(clearAllSyncTimerRef.current);
        }
        clearAllSyncTimerRef.current = window.setTimeout(() => {
          requestNotificationsList(socket, { showLoader: false });
          clearAllSyncTimerRef.current = null;
        }, 220);
      }
    } catch {
      // Keep UI clear state; do not surface retry errors after a user clears all.
    } finally {
      setNotificationsClearing(false);
    }
  }, [notifications, notificationsClearing, requestNotificationsList]);

  const handleCollaborationInviteAction = useCallback(
    async (note, action) => {
      const notificationId = String(note?.id || "");
      const inviteId = getCollaborationInviteId(note);

      if (!inviteId) {
        setNotificationsError("Invite details are missing in this notification.");
        return;
      }

      setNotificationsError("");
      setInviteActionBusyById((prev) => ({ ...prev, [notificationId]: true }));

      try {
        await diaryRequest(`/api/collaborators/invites/${inviteId}/${action}`, {
          method: "POST",
        });
        setInviteActionResultById((prev) => ({
          ...prev,
          [notificationId]: action === "accept" ? "accepted" : "declined",
        }));
        markNotificationAsRead(notificationId);
      } catch (error) {
        setNotificationsError(error?.message || `Failed to ${action} collaboration invite`);
      } finally {
        setInviteActionBusyById((prev) => {
          const next = { ...prev };
          delete next[notificationId];
          return next;
        });
      }
    },
    [markNotificationAsRead]
  );

  const handleAcceptFromNotification = useCallback(
    async (note) => {
      await handleCollaborationInviteAction(note, "accept");
    },
    [handleCollaborationInviteAction]
  );

  const handleDeclineFromNotification = useCallback(
    async (note) => {
      await handleCollaborationInviteAction(note, "decline");
    },
    [handleCollaborationInviteAction]
  );

  const handleFriendRequestAction = useCallback(
    async (note, action) => {
      const noteId = String(note?.id || "");
      const requestId = getFriendRequestId(note);

      if (!requestId) {
        setNotificationsError("Friend request details are missing in this notification.");
        return;
      }

      setNotificationsError("");
      setFriendActionBusyById((prev) => ({ ...prev, [noteId]: true }));
      try {
        await diaryRequest(
          `/api/friends/${action}?requestId=${encodeURIComponent(requestId)}`,
          { method: "POST" }
        );
        setFriendActionResultById((prev) => ({
          ...prev,
          [noteId]: action === "accept" ? "accepted" : "rejected",
        }));
        markNotificationAsRead(noteId);
        await loadFriendsData();
      } catch (error) {
        setNotificationsError(error?.message || `Failed to ${action} friend request`);
      } finally {
        setFriendActionBusyById((prev) => {
          const next = { ...prev };
          delete next[noteId];
          return next;
        });
      }
    },
    [loadFriendsData, markNotificationAsRead]
  );

  const handleAcceptFriendFromNotification = useCallback(
    async (note) => {
      await handleFriendRequestAction(note, "accept");
    },
    [handleFriendRequestAction]
  );

  const handleDeclineFriendFromNotification = useCallback(
    async (note) => {
      await handleFriendRequestAction(note, "decline");
    },
    [handleFriendRequestAction]
  );

  const handleReloadNotifications = () => {
    const socket = socketRef.current;
    if (!socket) return;
    requestNotificationsList(socket, { showLoader: true });
  };

  const handleOpenTerms = () => {
    console.log("OPEN /terms");
    window.location.href = "/terms";
  };

  const handleOpenPrivacy = () => {
    console.log("OPEN /privacy");
    window.location.href = "/privacy";
  };

  return (
    <div
      className="dashboard-ui-root"
      onPointerDownCapture={releasePointerLockForUi}
      onMouseDownCapture={releasePointerLockForUi}
      onTouchStartCapture={releasePointerLockForUi}
    >
      <div className="dashboard-topbar">
        <div className="dashboard-logo-wrap">
          <img src="/assets/mainLogo.png" alt="Logo" className="dashboard-logo" />
        </div>
        <div className="dashboard-actions">
          <button
            className="dashboard-icon-button dashboard-icon-button--friends"
            onClick={() => {
              releasePointerLockForUi();
              setFriendsOpen(true);
              setNotificationsOpen(false);
              setProfileOpen(false);
            }}
          >
            <img
              src="/assets/friends.png"
              alt="Friends"
              className="dashboard-icon-img dashboard-icon-img--friends"
            />
          </button>
          <div className="dashboard-icon-wrapper" ref={notificationsWrapperRef}>
            <button
              className="dashboard-icon-button"
              onClick={() => {
                releasePointerLockForUi();
                setNotificationsOpen((prev) => !prev);
                setFriendsOpen(false);
                setProfileOpen(false);
              }}
            >
              <img
                src={
                  safeUnreadCount > 0
                    ? "/assets/notification2.png"
                    : "/assets/notification.png"
                }
                alt="Notifications"
                className="dashboard-icon-img"
              />
            </button>
            <NotificationsPopover
              isOpen={notificationsOpen}
              notifications={notifications}
              isLoading={notificationsLoading}
              error={notificationsError}
              onRetry={handleReloadNotifications}
              onClearAll={handleClearAllNotifications}
              isClearing={notificationsClearing}
              onAcceptInvite={handleAcceptFromNotification}
              onDeclineInvite={handleDeclineFromNotification}
              inviteActionBusyById={inviteActionBusyById}
              inviteActionResultById={inviteActionResultById}
              onAcceptFriendRequest={handleAcceptFriendFromNotification}
              onDeclineFriendRequest={handleDeclineFriendFromNotification}
              friendActionBusyById={friendActionBusyById}
              friendActionResultById={friendActionResultById}
              menuRef={notificationsPopoverRef}
            />
          </div>
          <div className="dashboard-icon-wrapper" ref={profileWrapperRef}>
            <button
              className="dashboard-icon-button profile"
              onClick={() => {
                releasePointerLockForUi();
                setProfileOpen((prev) => !prev);
                setFriendsOpen(false);
                setNotificationsOpen(false);
              }}
            >
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name || "Profile"}
                  className="dashboard-profile-avatar"
                />
              ) : (
                <>
                  <img src="/assets/profile.png" alt="Profile" className="dashboard-icon-img" />
                  <span className="dashboard-profile-letter">
                    {getProfileInitial(currentUser)}
                  </span>
                </>
              )}
            </button>
            <ProfileMenu
              isOpen={profileOpen}
              menuRef={profileMenuRef}
              currentUser={currentUser}
              onProfile={handleProfileClick}
              onToggle2FA={handleToggle2FA}
              onLogout={handleLogout}
              twoFAEnabled={twoFAEnabled}
              onOpenTerms={handleOpenTerms}
              onOpenPrivacy={handleOpenPrivacy}
            />
          </div>
        </div>
      </div>

      <FriendsModal
        isOpen={friendsOpen}
        onClose={() => setFriendsOpen(false)}
        friends={friends}
        onRemove={openRemoveFriendModal}
        onAccept={handleAcceptRequest}
        onDecline={handleDeclineRequest}
        onInvite={handleInvite}
        onReload={loadFriendsData}
        inviteUsername={inviteUsername}
        setInviteUsername={setInviteUsername}
        inviteError={inviteError}
        setInviteError={setInviteError}
        friendsError={friendsError}
        isLoading={friendsLoading}
      />

      <FriendRequestToast
        request={toastRequest}
        onAccept={handleAcceptRequest}
        onDecline={handleDeclineRequest}
      />

      <DashboardActionModal
        isOpen={actionModal.isOpen}
        title={actionModal.title}
        subtitle={actionModal.subtitle}
        message={actionModal.message}
        confirmLabel={actionModal.confirmLabel}
        cancelLabel={actionModal.cancelLabel}
        requiresPassword={actionModal.requiresPassword}
        password={actionModal.password}
        error={actionModal.error}
        isBusy={actionModal.isBusy}
        onPasswordChange={handleActionModalPasswordChange}
        onCancel={closeActionModal}
        onConfirm={handleConfirmActionModal}
      />

      <CustomizeProfileModal
        isOpen={profileModalOpen}
        onClose={() => {
          setProfileModalOpen(false);
          setProfileError("");
        }}
        onSave={handleSaveProfile}
        username={currentUser.username}
        displayName={profileDisplayName}
        setDisplayName={setProfileDisplayName}
        bio={profileBio}
        setBio={handleBioChange}
        avatarPreview={profileAvatarPreview}
        onAvatarChange={handleAvatarChange}
        profileError={profileError}
        isSaving={profileSaving || profileLoading}
        isAvatarProcessing={profileAvatarProcessing}
      />
    </div>
  );
}
