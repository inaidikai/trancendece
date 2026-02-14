import React, { useState } from "react";
import AuthCard from "../components/AuthCard";
import AuthInput from "../components/AuthInput";
import AuthButton from "../components/AuthButton";
import { login, setToken } from "../authApi";

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
        setSession({ tempToken, userId, remember: true });
        navigate("verify-2fa");
      } else {
        const token =
          response.data?.token ||
          response.data?.access_token ||
          response.data?.accessToken ||
          null;
        if (token) {
          setToken(token, { remember: true });
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
      <AuthButton variant="secondary" block>
        <span className="auth-google-content">
          <svg className="auth-google-icon" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M24 9.5c3.2 0 5.8 1.3 7.6 3l5.2-5.2C33.6 3.6 29.1 2 24 2 14.9 2 7.1 7.2 3.6 14.7l6.6 5.1C12 13.6 17.5 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46 24c0-1.6-.1-2.8-.4-4H24v8.1h12.4c-.5 2.7-2 5-4.3 6.5l6.6 5.1C42.8 36 46 30.6 46 24z"
            />
            <path
              fill="#FBBC05"
              d="M10.2 28.5c-.5-1.4-.8-2.8-.8-4.5s.3-3.1.8-4.5l-6.6-5.1C2.2 17 1.5 20.4 1.5 24s.7 7 2.1 9.6l6.6-5.1z"
            />
            <path
              fill="#34A853"
              d="M24 46c5.1 0 9.4-1.7 12.6-4.6l-6.6-5.1c-1.8 1.2-4.1 2-6 2-6.5 0-12-4.1-13.8-9.8l-6.6 5.1C7.1 40.8 14.9 46 24 46z"
            />
          </svg>
          Continue with Google
        </span>
      </AuthButton>
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
        <div className="auth-submit-spacing">
          <AuthButton type="submit" disabled={loading} block>
            {loading ? "Signing in..." : "Login"}
          </AuthButton>
        </div>
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
