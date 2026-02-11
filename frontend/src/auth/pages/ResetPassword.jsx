import React, { useEffect, useState } from "react";
import AuthCard from "../components/AuthCard";
import AuthInput from "../components/AuthInput";
import AuthButton from "../components/AuthButton";
import { resetPassword } from "../authApi";

export default function ResetPassword({ navigate, token }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate("forgot-password");
    }
  }, [token, navigate]);

  const validate = () => {
    const next = {};
    if (!password) next.password = "Password is required";
    else if (password.length < 6) next.password = "Password must be at least 6 characters";
    if (!confirm) next.confirm = "Please confirm your password";
    else if (confirm !== password) next.confirm = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: "" }));
    }
  };

  const handleConfirmChange = (value) => {
    setConfirm(value);
    if (errors.confirm) {
      setErrors((prev) => ({ ...prev, confirm: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setBanner({ type: "error", text: "Reset link is missing or expired." });
      return;
    }
    if (!validate()) return;
    setLoading(true);
    setBanner(null);
    try {
      await resetPassword({ token, password });
      setBanner({ type: "success", text: "Password reset successful" });
      setTimeout(() => navigate("login"), 2000);
    } catch (err) {
      if (err.status === 400 || err.status === 401 || err.status === 404) {
        setBanner({ type: "error", text: "Invalid or expired token" });
        return;
      }
      if (err.status === 429) {
        setBanner({ type: "error", text: "Too many attempts. Please try again later" });
        return;
      }
      setBanner({
        type: "error",
        text: err?.message || "Something went wrong. Please try again",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Reset password" subtitle="Choose a new password">
      {banner && (
        <div className={`auth-banner ${banner.type === "error" ? "error" : ""}`}>
          {banner.text}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <AuthInput
          label="New password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="••••••"
          error={errors.password}
          disabled={loading}
        />
        <AuthInput
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={handleConfirmChange}
          placeholder="••••••"
          error={errors.confirm}
          disabled={loading}
        />
        <AuthButton type="submit" disabled={loading || !token} block>
          {loading ? "Resetting..." : "Reset password"}
        </AuthButton>
      </form>
      <div className="auth-links">
        <span className="auth-link" onClick={() => navigate("login")}
          >Back to login</span
        >
      </div>
    </AuthCard>
  );
}
