import React from "react";
import "./auth.css";
import "./components/authComponents.css";

export default function AuthLayout({ children, footer }) {
  return (
    <div className="auth-root">
      <div className="auth-layout">
        <div className="auth-card-shell">{children}</div>
        {footer && <div className="auth-footer-note">{footer}</div>}
      </div>
    </div>
  );
}
