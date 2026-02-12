import React from "react";
import { getPasswordRuleStates } from "../passwordPolicy";

const getStrength = (password) => {
  if (!password) return { label: "", level: 0 };
  const metCount = getPasswordRuleStates(password).filter((rule) => rule.met).length;

  if (metCount === 5) {
    return { label: "Strong", level: 3 };
  }
  if (metCount >= 3) {
    return { label: "Medium", level: 2 };
  }
  if (metCount >= 1) {
    return { label: "Weak", level: 1 };
  }
  return { label: "", level: 0 };
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
