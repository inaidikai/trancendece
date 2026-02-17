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
          onClick={async () => {
            try {
            const res = await fetch("/api/auth/login", {
            method: "POST",
             headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
             });
              if (!res.ok) throw new Error("Login failed");
              const data = await res.json();
              localStorage.setItem("token", data.token);
              nav("/world");
            } catch (e) {
              console.error(e);
              alert("Login failed");
            }
          }}

          >
            Enter
          </button>
        </div>
      </div>
    </div>
  );
}
