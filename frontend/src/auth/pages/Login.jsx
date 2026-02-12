import React, { useState } from "react";
import AuthCard from "../components/AuthCard";
import AuthInput from "../components/AuthInput";
import AuthButton from "../components/AuthButton";
import { login, setToken } from "../authApi";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export default function Login({ navigate, setSession }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  const validate = () => {
    const next = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) next.email = "Email is required";
    else if (!emailRegex.test(trimmedEmail)) next.email = "Invalid email";
    if (!password) next.password = "Password required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: "" }));
    }
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setBanner(null);
    try {
      const sanitizedEmail = email.trim().toLowerCase();
      const response = await login({ email: sanitizedEmail, password });
      const requires2FA = Boolean(
        response.data?.requires2FA ??
          response.data?.requires_2fa ??
          response.data?.twoFactorRequired
      );
      if (response.status === 200 && requires2FA) {
        const tempToken = response.data.temp_token || response.data.tempToken;
        const userId = response.data.user_id || response.data.userId;
        if (!tempToken || !userId) {
          setBanner({ type: "error", text: "Two-factor session is invalid. Try again." });
          return;
        }
        setSession({ tempToken, userId, remember: rememberMe });
        navigate("verify-2fa");
      } else {
        const token =
          response.data?.token ||
          response.data?.access_token ||
          response.data?.accessToken ||
          null;
        if (token) {
          setToken(token, { remember: rememberMe });
        }
        setPassword("");
        setBanner({ type: "success", text: "Logged in successfully." });
        setTimeout(() => navigate("dashboard"), 700);
      }
    } catch (err) {
      if (err.status === 401) {
        setBanner({ type: "error", text: "Invalid email or password" });
      } else if (err.status === 429) {
        setBanner({ type: "error", text: "Too many attempts. Please try again later" });
      } else {
        setBanner({
          type: "error",
          text: err?.message || "Database error",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Welcome back" subtitle="Log in to your book">
      {banner && (
        <div className={`auth-banner ${banner.type === "error" ? "error" : ""}`}>
          {banner.text}
        </div>
      )}
      <GoogleSignInButton 
        onSignInStart={() => setLoading(true)}
        onSignInError={(error) => {
          setBanner({ type: "error", text: error.message || "Google sign-in failed" });
          setLoading(false);
        }}
      />
      <div className="auth-or">or</div>
      <form onSubmit={handleSubmit}>
        <AuthInput
          label="Email"
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="you@example.com"
          error={errors.email}
          disabled={loading}
        />
        <AuthInput
          label="Password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={handlePasswordChange}
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
        <label className="auth-checkbox-row">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={loading}
          />
          <span>Remember me</span>
        </label>
        <AuthButton type="submit" disabled={loading} block>
          {loading ? "Signing in..." : "Login"}
        </AuthButton>
      </form>
      <div className="auth-links">
        <span className="auth-link" onClick={() => navigate("forgot-password")}
          >Forgot password?</span
        >
        <span className="auth-link" onClick={() => navigate("signup")}
          >Create account</span
        >
      </div>
    </AuthCard>
  );
}
