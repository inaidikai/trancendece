import React from "react";

export default function AuthCard({ title, subtitle, children }) {
  return (
    <div>
      {title && <h1 className="auth-card-title">{title}</h1>}
      {subtitle && <p className="auth-card-subtitle">{subtitle}</p>}
      {children}
    </div>
  );
}
