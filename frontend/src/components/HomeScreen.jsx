import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./HomeScreen.css";
import ConfirmationModal from "../app/components/ConfirmationModal";
import { getMe } from "../auth/authApi";

// Public folder images (do NOT write "public" here)
const plusImg = "/assets/plus.png";
const trashImg = "/assets/trash.png";
const EMPTY_USER = { id: "", username: "", name: "", role: "owner" };

function IconButton({ onClick, label, src, disabled }) {
  return (
    <button
      className={`button-icon${disabled ? " disabled" : ""}`}
      onClick={onClick}
      aria-label={label}
      type="button"
      disabled={disabled}
    >
      <img src={src} alt={label} className="icon-img" />
    </button>
  );
}

export default function HomeScreen({ title = "Your Space to Create", children }) {
  const [pageInfo, setPageInfo] = useState({ currentPage: 1, totalPages: 1 });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const actionsRef = useRef({ addPage: null, removePage: null });
  const [currentUser, setCurrentUser] = useState(EMPTY_USER);
  const isOwner = currentUser?.role !== "collaborator";

  useEffect(() => {
    let cancelled = false;

    const loadCurrentUser = async () => {
      try {
        const response = await getMe();
        if (cancelled) return;
        const user = response?.data?.user || response?.data || {};
        setCurrentUser({
          id: user.id || "",
          username: user.username || "",
          name: user.full_name || user.fullName || user.username || "",
          role: "owner",
        });
      } catch {
        if (!cancelled) {
          setCurrentUser(EMPTY_USER);
        }
      }
    };

    loadCurrentUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const registerActions = useCallback((actions) => {
    actionsRef.current = actions || {};
  }, []);

  const handleAddPage = useCallback(() => {
    actionsRef.current?.addPage?.();
  }, []);

  const handleRemoveClick = useCallback(() => {
    setShowConfirmation(true);
    actionsRef.current?.requestRemovePage?.();
  }, []);

  const handleConfirmRemove = useCallback(() => {
    setShowConfirmation(false);
    actionsRef.current?.removePage?.();
  }, []);

  const handleCancelRemove = useCallback(() => {
    setShowConfirmation(false);
    actionsRef.current?.cancelRemovePage?.();
  }, []);

  const injectedChildren = useMemo(
    () =>
      React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, {
          registerActions,
          onPageInfoChange: setPageInfo,
          currentUser,
        });
      }),
    [children, registerActions, currentUser]
  );

  return (
    <div className="home-screen">
      <Link to="/world" className="home-logo-link" aria-label="World">
        <img src="/assets/mainLogo.png" alt="Logo" className="home-logo" />
      </Link>
      <div className="home-content">
        <div className="title-section">
          <h1 className="main-title">{title}</h1>
          <p className="page-count">
            Page {pageInfo.currentPage} of {pageInfo.totalPages}
          </p>
        </div>

        <div className="book-frame">
          <div className="book-slot">{injectedChildren}</div>
        </div>

        <div className="action-buttons">
          <div className="confirm-anchor">
            <IconButton
              onClick={handleRemoveClick}
              label="Remove Page"
              src={trashImg}
              disabled={!isOwner}
            />
            {isOwner && (
              <ConfirmationModal
                isOpen={showConfirmation}
                onConfirm={handleConfirmRemove}
                onCancel={handleCancelRemove}
              />
            )}
          </div>
          <IconButton
            onClick={handleAddPage}
            label="Add Page"
            src={plusImg}
            disabled={!isOwner}
          />
        </div>
      </div>
    </div>
  );
}
