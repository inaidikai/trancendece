import React from "react";
import AuthRoutes from "./AuthRoutes";

export default function AuthSandbox({ initial = "login" }) {
  return <AuthRoutes initial={initial} />;
}

export { AuthRoutes };
