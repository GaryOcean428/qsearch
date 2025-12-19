import React from "react";
import ReactDOM from "react-dom/client";

import "./globals.css";

import { ThemeProvider } from "./contexts/ThemeProvider";
import { App } from "./ui/App";

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
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
