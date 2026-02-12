import React, { useState } from "react";
import AuthCard from "../components/AuthCard";
import AuthInput from "../components/AuthInput";
import AuthButton from "../components/AuthButton";
import PasswordStrength from "../components/PasswordStrength";
import { register, setToken } from "../authApi";
import {
  PASSWORD_POLICY_ERROR_MESSAGE,
  isPasswordPolicySatisfied,
} from "../passwordPolicy";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

export default function Signup({ navigate }) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  const validate = () => {
    const next = {};
    if (!username) {
      next.username = "Username is required";
    } else if (username.length < 3 || username.length > 30) {
      next.username = "Username must be 3-30 characters";
    } else if (!usernameRegex.test(username)) {
      next.username = "Username can only contain letters, numbers, and underscores";
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      next.email = "Email is required";
    } else if (!emailRegex.test(trimmedEmail)) {
      next.email = "Invalid email address";
    }
    if (!password) {
      next.password = "Password is required";
    } else if (!isPasswordPolicySatisfied(password)) {
      next.password = PASSWORD_POLICY_ERROR_MESSAGE;
    }
    if (!confirmPassword) {
      next.confirmPassword = "Please confirm your password";
    } else if (confirmPassword !== password) {
      next.confirmPassword = "Passwords do not match";
    }
    if (!terms) next.terms = "You must agree to Privacy Policy and Terms";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleFieldChange = (field, value) => {
    const setters = {
      fullName: setFullName,
      username: setUsername,
      email: setEmail,
      password: setPassword,
      confirmPassword: setConfirmPassword,
    };
    setters[field]?.(value);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setBanner(null);
    try {
      const response = await register({
        fullName,
        username,
        email: email.trim().toLowerCase(),
        password,
      });
      if (response.status === 201 || response.status === 200) {
        const token =
          response.data?.token ||
          response.data?.access_token ||
          response.data?.accessToken ||
          null;
        if (token) {
          setToken(token, { remember: true });
        }
        setPassword("");
        setConfirmPassword("");
        setBanner({ type: "success", text: "Account created successfully." });
        setTimeout(() => navigate("create-profile"), 700);
      }
    } catch (err) {
      if (err.status === 409) {
        setBanner({ type: "error", text: "Email or username already exists" });
      } else if (err.status === 400) {
        setBanner({ type: "error", text: err?.message || "Invalid signup details" });
      } else if (err.status === 429) {
        setBanner({ type: "error", text: "Too many attempts. Please try again later" });
      } else {
        setBanner({
          type: "error",
          text: err?.message || "Something went wrong. Please try again",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Create account" subtitle="Start your new diary">
      {banner && (
        <div className={`auth-banner ${banner.type === "error" ? "error" : ""}`}>
          {banner.text}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <AuthInput
          label="Full name"
          value={fullName}
          onChange={(value) => handleFieldChange("fullName", value)}
          placeholder="Your name"
          disabled={loading}
        />
        <AuthInput
          label="Username"
          value={username}
          onChange={(value) => handleFieldChange("username", value)}
          placeholder="username"
          error={errors.username}
          disabled={loading}
        />
        <AuthInput
          label="Email"
          type="email"
          value={email}
          onChange={(value) => handleFieldChange("email", value)}
          placeholder="you@example.com"
          error={errors.email}
          disabled={loading}
        />
        <AuthInput
          label="Password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(value) => handleFieldChange("password", value)}
          placeholder="••••••"
          error={errors.password}
          disabled={loading}
          action={{
            label: (
              <span className="auth-input-action-label">
                <EyeIcon />
                {showPassword ? "Hide" : "Show"}
              </span>
            ),
            ariaLabel: showPassword ? "Hide password" : "Show password",
            onClick: () => setShowPassword((prev) => !prev),
            disabled: loading,
          }}
        />
        <AuthInput
          label="Confirm password"
          type={showConfirm ? "text" : "password"}
          value={confirmPassword}
          onChange={(value) => handleFieldChange("confirmPassword", value)}
          placeholder="••••••"
          error={errors.confirmPassword}
          disabled={loading}
          action={{
            label: (
              <span className="auth-input-action-label">
                <EyeIcon />
                {showConfirm ? "Hide" : "Show"}
              </span>
            ),
            ariaLabel: showConfirm ? "Hide password confirmation" : "Show password confirmation",
            onClick: () => setShowConfirm((prev) => !prev),
            disabled: loading,
          }}
        />
        <PasswordStrength password={password} />
        <label className="auth-checkbox-row">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => {
              setTerms(e.target.checked);
              if (errors.terms) {
                setErrors((prev) => ({ ...prev, terms: "" }));
              }
            }}
            disabled={loading}
          />
          <span>I agree to the Privacy Policy and Terms</span>
        </label>
        {errors.terms && <span className="auth-input-help">{errors.terms}</span>}
        <AuthButton type="submit" disabled={loading} block>
          {loading ? "Creating..." : "Create account"}
        </AuthButton>
      </form>
      <div className="auth-links">
        <span className="auth-link" onClick={() => navigate("login")}
          >Already have an account?</span
        >
      </div>
    </AuthCard>
  );
}
