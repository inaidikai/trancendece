import React from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";

import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import World from "./pages/World.jsx";
import DiaryEditor from "./pages/DiaryEditor.jsx";

function RequireAuth({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div style={{ height: "100vh" }}>
      <Routes>
        <Route path="/login" element={<Login />} />

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
          path="/diary/:id"
          element={
            <RequireAuth>
              <DiaryEditor />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* tiny nav for testing */}
      <div style={{ position: "fixed", bottom: 10, right: 10, opacity: 0.7 }}>
        <Link to="/dashboard">Dashboard</Link> | <Link to="/world">World</Link>
      </div>
    </div>
  );
}
