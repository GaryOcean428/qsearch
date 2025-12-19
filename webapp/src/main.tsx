import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";

import "./globals.css";
import "./theme.css";

import { ThemeProvider } from "./contexts/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { App } from "./ui/App";
import { Federation } from "./ui/Federation";

function Router() {
  const [route, setRoute] = useState(window.location.hash || "#/");

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (route === "#/federation") {
    return <Federation />;
  }
  return <App />;
}

// Apply theme before React renders (FOUC prevention)
(() => {
  try {
    const saved = localStorage.getItem("theme") || "system";
    const resolved =
      saved === "dark" || saved === "light"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.classList.toggle("dark", resolved === "dark");
  } catch {
    // ignore
  }
})();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
