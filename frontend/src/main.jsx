import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

const RAPIER_INIT_WARNING =
  "using deprecated parameters for the initialization function; pass a single object instead";
const WEBGL_CONTEXT_LOST_WARNING = "THREE.WebGLRenderer: Context Lost.";

const shouldSilenceConsoleMessage = (args) => {
  const firstArg = args[0];
  if (typeof firstArg !== "string") return false;
  return (
    firstArg.includes(RAPIER_INIT_WARNING) ||
    firstArg.includes(WEBGL_CONTEXT_LOST_WARNING)
  );
};

const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
  if (shouldSilenceConsoleMessage(args)) {
    return;
  }
  originalConsoleWarn(...args);
};

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  if (shouldSilenceConsoleMessage(args)) {
    return;
  }
  originalConsoleError(...args);
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
