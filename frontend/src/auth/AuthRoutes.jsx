import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Verify2FA from "./pages/Verify2FA";
import CreateProfile from "./pages/CreateProfile";
import DashboardPlaceholder from "./pages/DashboardPlaceholder";
import { getToken } from "./authApi";

const ROUTES = {
  login: Login,
  signup: Signup,
  "forgot-password": ForgotPassword,
  "reset-password": ResetPassword,
  "verify-2fa": Verify2FA,
  "create-profile": CreateProfile,
  dashboard: DashboardPlaceholder,
};

export default function AuthRoutes({ initial = "login" }) {
  const [session, setSession] = useState({ tempToken: null, userId: null, remember: true });
  const location = useLocation();
  const routerNavigate = useNavigate();

  const basePath = location.pathname.startsWith("/auth") ? "/auth" : "";
  const routeFromPath = useMemo(() => {
    const normalized = location.pathname.replace(/^\/auth\/?/, "/");
    const segment = normalized.split("/").filter(Boolean)[0] || initial;
    return ROUTES[segment] ? segment : initial;
  }, [location.pathname, initial]);

  const navigate = (next) => {
    if (next === "dashboard") {
      routerNavigate("/world");
      return;
    }
    if (!ROUTES[next]) return;
    const target = `${basePath}/${next}`.replace(/\/+/g, "/");
    routerNavigate(target);
  };

  const Component = ROUTES[routeFromPath] || Login;
  const footer =
    routeFromPath === "login" || routeFromPath === "signup" ? (
      <span>
        {routeFromPath === "login"
          ? "By logging in you agree to our "
          : "By signing up you agree to our "}
        <a href="/terms" className="auth-link">
          Terms
        </a>{" "}
        and have read our{" "}
        <a href="/privacy" className="auth-link">
          Privacy Policy
        </a>
        .
      </span>
    ) : null;
  const queryToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("token") || "";
  }, [location.search]);

  useEffect(() => {
    if (routeFromPath === "verify-2fa" && (!session.tempToken || !session.userId)) {
      const target = `${basePath}/login`.replace(/\/+/g, "/");
      routerNavigate(target);
    }
    if (routeFromPath === "create-profile" && !getToken()) {
      const target = `${basePath}/login`.replace(/\/+/g, "/");
      routerNavigate(target);
    }
  }, [routeFromPath, session.tempToken, session.userId, basePath, routerNavigate]);

  return (
    <AuthLayout footer={footer}>
      <Component
        navigate={navigate}
        session={session}
        setSession={setSession}
        token={queryToken}
      />
    </AuthLayout>
  );
}
