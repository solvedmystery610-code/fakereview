import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./InsightLauncher.css";

const HIDDEN_ROUTES = new Set(["/login", "/verify", "/explainability"]);

function InsightLauncher() {
  const navigate = useNavigate();
  const location = useLocation();

  if (HIDDEN_ROUTES.has(location.pathname)) {
    return null;
  }

  return (
    <button
      type="button"
      className="insight-launcher"
      onClick={() => navigate("/explainability", { state: { from: location.pathname } })}
      aria-label="Open review insight coach"
    >
      <span className="insight-launcher-icon">AI</span>
      <span className="insight-launcher-copy">
        <strong>Insight Coach</strong>
        <small>Explain this review</small>
      </span>
    </button>
  );
}

export default InsightLauncher;
