import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "framer-motion";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";
import { applyLook, readSettings } from "./settings.js";

applyLook(readSettings());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* "user" means people who ask their device for less motion get calmer animations */}
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </MotionConfig>
  </React.StrictMode>
);

// Lets Chikki be installed as an app. The worker caches nothing, so deploys are never stale.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
