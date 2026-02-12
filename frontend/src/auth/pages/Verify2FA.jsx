import React, { useEffect, useState } from "react";
import AuthCard from "../components/AuthCard";
import AuthButton from "../components/AuthButton";
import OtpInput from "../components/OtpInput";
import { verify2FA, resend2FALogin, setToken } from "../authApi";

export default function Verify2FA({ navigate, session, setSession }) {
  const [code, setCode] = useState("");
  const [banner, setBanner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setBanner(null);
    if (!session?.userId || !session?.tempToken) {
      setBanner({ type: "error", text: "Session expired. Please log in again" });
      setTimeout(() => navigate("login"), 500);
      return;
    }
    if (!code) {
      setBanner({ type: "error", text: "Code is required" });
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setBanner({ type: "error", text: "Code must be 6 digits" });
      return;
    }
    setLoading(true);
    try {
      const response = await verify2FA({
        user_id: session.userId,
        temp_token: session.tempToken,
        code,
      });
      const token =
        response.data?.token ||
        response.data?.access_token ||
        response.data?.accessToken ||
        null;
      if (token) {
        setToken(token, { remember: session?.remember ?? true });
      }
      setSession({ tempToken: null, userId: null, remember: session?.remember ?? true });
      setBanner({ type: "success", text: "Verified. Logging in..." });
      setTimeout(() => navigate("dashboard"), 700);
    } catch (err) {
      if (err.status === 404) {
        navigate("login");
        return;
      }
      if (err.status === 401) {
        setBanner({ type: "error", text: "Invalid or expired 2FA code" });
      } else {
        setBanner({
          type: "error",
          text: err?.message || "Invalid or expired 2FA code",
        });
      }
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (code.length < 6 && autoSubmitted) {
      setAutoSubmitted(false);
    }
    if (code.length === 6 && !loading && !autoSubmitted) {
      setAutoSubmitted(true);
      handleSubmit();
    }
  }, [code, loading, autoSubmitted]);

  const handleResend = async () => {
    if (!session?.userId || !session?.tempToken) {
      setBanner({ type: "error", text: "Session expired. Please log in again" });
      setTimeout(() => navigate("login"), 500);
      return;
    }
    setResendLoading(true);
    setBanner(null);
    try {
      await resend2FALogin({
        user_id: session.userId,
        temp_token: session.tempToken,
      });
      setCode("");
      setBanner({ type: "success", text: "Verification code sent" });
    } catch (err) {
      if (err?.status === 401) {
        setBanner({ type: "error", text: "Session expired. Please log in again" });
        setTimeout(() => navigate("login"), 600);
      } else {
        setBanner({ type: "error", text: err?.message || "Failed to resend verification code" });
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthCard title="Verify code" subtitle="Enter the 6-digit code">
      {banner && (
        <div className={`auth-banner ${banner.type === "error" ? "error" : ""}`}>
          {banner.text}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <OtpInput value={code} onChange={setCode} disabled={loading} />
        <AuthButton type="submit" disabled={loading} block>
          {loading ? "Verifying..." : "Verify"}
        </AuthButton>
      </form>
      <div className="auth-links">
        <span className="auth-link" onClick={() => navigate("login")}>
          Back to login
        </span>
        <button
          type="button"
          className="auth-link"
          onClick={handleResend}
          disabled={resendLoading}
        >
          {resendLoading ? "Sending..." : "Resend code"}
        </button>
      </div>
    </AuthCard>
  );
}
