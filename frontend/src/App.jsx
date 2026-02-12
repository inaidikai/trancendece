import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { AuthRoutes } from "./auth";
import Dashboard from "./pages/Dashboard.jsx";
import World from "./pages/World.jsx";
import FlipbookHome from "./pages/FlipbookHome.jsx";
import DiaryEditor from "./pages/DiaryEditor.jsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";
import Terms from "./pages/Terms.jsx";
import GoogleCallback from "./pages/GoogleCallback.jsx";
import { getToken } from "./auth/authApi";

function RequireAuth({ children }) {
  const token = getToken();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div style={{ height: "100vh" }}>
      <Routes>
        <Route path="/login" element={<AuthRoutes initial="login" />} />
        <Route path="/signup" element={<AuthRoutes initial="signup" />} />
        <Route path="/forgot-password" element={<AuthRoutes initial="forgot-password" />} />
        <Route path="/reset-password" element={<AuthRoutes initial="reset-password" />} />
        <Route path="/verify-2fa" element={<AuthRoutes initial="verify-2fa" />} />
        <Route path="/create-profile" element={<AuthRoutes initial="create-profile" />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route path="/auth/*" element={<AuthRoutes initial="login" />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />

        <Route
          path="/world"
          element={
            <RequireAuth>
              <World />
            </RequireAuth>
          }
        />

        <Route
          path="/home"
          element={
            <RequireAuth>
              <FlipbookHome />
            </RequireAuth>
          }
        />

        <Route
          path="/edit/:id"
          element={
            <RequireAuth>
              <FlipbookHome />
            </RequireAuth>
          }
        />

        <Route
          path="/diary/:id"
          element={
            <RequireAuth>
              <DiaryEditor />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/world" replace />} />
      </Routes>
    </div>
  );
}
