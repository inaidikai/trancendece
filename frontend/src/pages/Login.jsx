import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="wrap">
      <div className="card">
        <h2 style={{ margin: "0 0 8px" }}>Sign in</h2>
        <p style={{ margin: "0 0 14px", color: "var(--muted)" }}>
          Minimal for now. We’ll wire real auth later.
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          <input className="field" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            className="field"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            className="btn"
            onClick={() => {
              localStorage.setItem("token", "dev-token");
              nav("/world"); // straight to 3D world
            }}
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  );
}
