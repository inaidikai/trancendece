import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken, getMe, logout } from "../auth/authApi";

export default function Dashboard() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getMe();
        if (!active) return;
        const user = response.data?.user || response.data;
        setProfile(user || null);
      } catch (err) {
        if (!active) return;
        if (err.status === 401) {
          clearToken();
          nav("/login");
          return;
        }
        setError(err?.message || "Unable to load profile");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [nav]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore logout errors
    } finally {
      clearToken();
      nav("/login");
    }
  };

  const displayName =
    profile?.full_name || profile?.fullName || profile?.username || profile?.email;

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard</h1>
      {loading ? (
        <p>Loading your profile...</p>
      ) : error ? (
        <p>{error}</p>
      ) : (
        <p>Welcome{displayName ? `, ${displayName}` : ""}.</p>
      )}
      <button onClick={() => nav("/world")}>Enter 3D World</button>
      <button
        style={{ marginLeft: 10 }}
        onClick={handleLogout}
      >
        Logout
      </button>
    </div>
  );
}
