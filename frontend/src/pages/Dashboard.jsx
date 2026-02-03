import React from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const nav = useNavigate();

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard</h1>
      <button onClick={() => nav("/world")}>Enter 3D World</button>
      <button
        style={{ marginLeft: 10 }}
        onClick={() => {
          localStorage.removeItem("token");
          nav("/login");
        }}
      >
        Logout
      </button>
    </div>
  );
}
