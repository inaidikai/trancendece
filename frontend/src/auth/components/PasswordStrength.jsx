import React from "react";

const getStrength = (password) => {
  if (!password) return { label: "", level: 0 };
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (password.length >= 8 && hasNumber && hasSymbol) {
    return { label: "Strong", level: 3 };
  }
  if (password.length >= 6 && hasUpper && hasLower) {
    return { label: "Medium", level: 2 };
  }
  if (password.length >= 6) {
    return { label: "Weak", level: 1 };
  }
  return { label: "Weak", level: 1 };
};

export default function PasswordStrength({ password }) {
  const { label, level } = getStrength(password);
  return (
    <div className="password-strength">
      <div className="password-bars">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className={`password-bar ${
              level >= index ? `active ${label.toLowerCase()}` : ""
            }`}
          />
        ))}
      </div>
      <span className="password-label">{label}</span>
    </div>
  );
}
