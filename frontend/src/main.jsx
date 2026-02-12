import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

const RAPIER_INIT_WARNING =
  "using deprecated parameters for the initialization function; pass a single object instead";

const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
  const firstArg = args[0];
  if (typeof firstArg === "string" && firstArg.includes(RAPIER_INIT_WARNING)) {
    return;
  }
  originalConsoleWarn(...args);
};

const StrictModeWrapper = import.meta.env.VITE_STRICT_MODE === "true"
  ? React.StrictMode
  : React.Fragment;

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictModeWrapper>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictModeWrapper>
);
