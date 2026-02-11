import React, { useState } from "react";
import AuthCard from "../components/AuthCard";
import AuthInput from "../components/AuthInput";
import AuthButton from "../components/AuthButton";
import { forgotPassword } from "../authApi";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword({ navigate }) {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  const validate = () => {
    const next = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) next.email = "Email is required";
    else if (!emailRegex.test(trimmedEmail)) next.email = "Invalid email";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setBanner(null);
    try {
      await forgotPassword({ email: email.trim().toLowerCase() });
      setBanner({
        type: "success",
        text: "Check your email for reset instructions",
      });
    } catch (err) {
      if (err.status === 404) {
        setBanner({
          type: "success",
          text: "Check your email for reset instructions",
        });
        return;
      }
      if (err.status === 429) {
        setBanner({ type: "error", text: "Too many attempts. Please try again later" });
        return;
      }
      if (err.status === 500) {
        setBanner({ type: "error", text: "Failed to send email" });
        return;
      }
      setBanner({
        type: "error",
        text: err?.message || "Failed to send email",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Forgot password" subtitle="We will send you a reset link">
      {banner && (
        <div className={`auth-banner ${banner.type === "error" ? "error" : ""}`}>
          {banner.text}
        </div>
      )}
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
        <AuthButton type="submit" disabled={loading} block>
          {loading ? "Sending..." : "Send reset link"}
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
