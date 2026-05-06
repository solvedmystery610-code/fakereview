import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement
} from "chart.js";
import {
  ShieldAlert,
  BellRing,
  MessageSquareQuote,
  History,
  Activity,
  UserCheck,
  Zap
} from "lucide-react";
import { Bar, Line, Pie } from "react-chartjs-2";
import ScrollReveal from "../components/ScrollReveal";
import { fetchJson, postJson } from "../utils/api";
import "./AdminPanel.css";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement
);

const ADMIN_BG = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80";
const ADMIN_PATTERN = "https://www.transparenttextures.com/patterns/carbon-fibre.png";

const defaultUserForm = {
  role: "Normal user",
  usage_limit_per_day: 1000,
  plan: "Free"
};

function AdminPanel() {
  const navigate = useNavigate();
  const username = localStorage.getItem("username");
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [darkMode, setDarkMode] = useState(localStorage.getItem("adminDarkMode") === "true");
  const [userForms, setUserForms] = useState({});

  const loadOverview = async (showLoader = true) => {
    if (!username || !isAdmin) {
      setLoading(false);
      setError("Admin login required.");
      return;
    }
    if (showLoader) setLoading(true);
    try {
      const data = await fetchJson(`/admin/overview?username=${encodeURIComponent(username)}`);
      setOverview(data);
      setError("");
      const nextForms = {};
      (data.users || []).forEach((user) => {
        nextForms[user.username] = {
          role: user.role || "Normal user",
          usage_limit_per_day: user.usage_limit_per_day ?? 1000,
          plan: user.plan || "Free"
        };
      });
      setUserForms(nextForms);
    } catch (err) {
      setError(err.message || "Failed to load admin overview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!username || !isAdmin) {
      setError("Admin login required.");
      setLoading(false);
      return;
    }
    loadOverview();
    const intervalId = setInterval(() => loadOverview(false), 10000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, isAdmin]);

  useEffect(() => {
    localStorage.setItem("adminDarkMode", darkMode ? "true" : "false");
  }, [darkMode]);

  const updateUserForm = (target, key, value) => {
    setUserForms((current) => ({
      ...current,
      [target]: {
        ...(current[target] || defaultUserForm),
        [key]: value
      }
    }));
  };

  const runUserAction = async (targetUsername, action, extra = {}) => {
    try {
      setMessage("");
      const result = await postJson("/admin/user-action", {
        username,
        target_username: targetUsername,
        action,
        ...extra
      });
      if (result?.temporary_password) {
        setMessage(`Password reset for ${targetUsername}: ${result.temporary_password}`);
      } else {
        setMessage(result?.message || "User updated.");
      }
      await loadOverview(false);
    } catch (err) {
      setError(err.message || "User action failed.");
    }
  };

  // deleteReview is available for future use
  const _deleteReview = async (id) => {
    try {
      setMessage("");
      await postJson("/admin/delete-review", { username, id });
      setMessage("Review deleted.");
      await loadOverview(false);
    } catch (err) {
      setError(err.message || "Review delete failed.");
    }
  };
  void _deleteReview;

  const exportCsv = () => {
    if (!overview) return;
    const rows = [
      ["username", "role", "status", "sessions", "total_reviews", "fake_reviews", "genuine_reviews", "last_login_at"],
      ...(overview.users || []).map((user) => [
        user.username,
        user.role,
        user.status,
        user.login_count ?? 0,
        user.total_reviews ?? 0,
        user.fake_reviews ?? 0,
        user.genuine_reviews ?? 0,
        user.last_login_at || ""
      ])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileName = `admin-overview-${Date.now()}.csv`;
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    if (!overview) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const fileName = `admin-overview-${Date.now()}.pdf`;
    const lines = [
      "FakeReviewAnalysis Admin Snapshot",
      `Generated: ${new Date().toLocaleString()}`,
      `Total users: ${overview.summary?.total_users ?? 0}`,
      `Active users: ${overview.summary?.active_users ?? 0}`,
      `Total reviews: ${overview.summary?.total_reviews ?? 0}`,
      `Downloads: ${overview.summary?.downloads ?? 0}`,
      `Uploads: ${overview.summary?.uploads ?? 0}`,
      `Alerts: ${overview.summary?.alerts ?? 0}`,
      "",
      "Top active users:",
      ...((overview.platform?.most_active_users || []).slice(0, 5).map(
        (user) => `- ${user.username}: ${user.total_reviews} reviews`
      ))
    ];
    let y = 48;
    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.text("FakeReviewAnalysis Admin Snapshot", 40, y);
    y += 24;
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    lines.slice(1).forEach((line) => {
      doc.text(line, 40, y);
      y += 18;
    });
    doc.save(fileName);
  };

  // charts computed for potential future chart panels
  const _charts = useMemo(() => {
    if (!overview) return null;
    return {
      usageLine: {
        labels: (overview.platform?.daily_usage || []).map((item) => item.date),
        datasets: [{
          label: "Daily Reviews",
          data: (overview.platform?.daily_usage || []).map((item) => item.count),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.18)",
          fill: true,
          tension: 0.35
        }]
      },
      fakePie: {
        labels: ["Fake", "Genuine"],
        datasets: [{
          data: [
            overview.platform?.fake_reviews || 0,
            overview.platform?.genuine_reviews || 0
          ],
          backgroundColor: ["#f87171", "#4ade80"]
        }]
      },
      roleBar: {
        labels: Object.keys(overview.user_roles || {}),
        datasets: [{
          label: "Users",
          data: Object.values(overview.user_roles || {}),
          backgroundColor: ["#0f766e", "#2563eb", "#f97316"]
        }]
      }
    };
  }, [overview]);

  if (loading) return <div className="loading-state"><h2>Loading intelligence grid...</h2></div>;

  if (!username || !isAdmin) {
    return (
      <div className="loading-state">
        <p>Admin access required.</p>
        <button className="btn-primary" onClick={() => navigate("/login")}>Re-authenticate</button>
      </div>
    );
  }

  const modelMetrics = overview?.model?.metrics || {};
  const testMetrics = modelMetrics.test || {};
  void testMetrics; // reserved for future confusion matrix display
  void _charts;

  return (
    <div className={`admin-page ${darkMode ? "admin-page-dark" : ""}`}>
      {/* Background is now global in App.jsx */}
      <div className="admin-shell">
        <ScrollReveal>
          <section className="admin-hero professional-glass">
            <div>
              <p className="admin-kicker">Core Governance Panel</p>
              <h1>Platform Orchestration</h1>
              <p>Direct infrastructure oversight: users, audit cycles, and real-time behavioral intelligence.</p>
            </div>
            <div className="admin-actions">
              <button className="btn-secondary" onClick={() => setDarkMode((value) => !value)}>
                {darkMode ? "Light mode" : "Dark mode"}
              </button>
              <button className="btn-secondary" onClick={() => loadOverview(false)}>Refresh</button>
              <button className="btn-primary" onClick={exportCsv}>Export CSV</button>
              <button className="btn-primary" onClick={exportPdf}>Export PDF</button>
            </div>
          </section>
        </ScrollReveal>

        {error && <div className="alert-box error">{error}</div>}
        {message && <div className="alert-box success">{message}</div>}

        <section className="admin-summary-grid">
          {
            [
              ["System Users", overview?.summary?.total_users],
              ["Live Sessions", overview?.summary?.active_users],
              ["Total Scans", overview?.summary?.total_reviews],
              ["Data Exports", overview?.summary?.downloads],
              ["File Ingests", overview?.summary?.uploads],
              ["Model Core", `${overview?.platform?.fake_detection_accuracy ?? "N/A"}%`],
              ["Security Flags", overview?.suspicious_activity?.length || 0]
            ].map(([label, value]) => (
              <div className="admin-pill professional-glass" key={label}>
                <span className="admin-pill-label">{label}</span>
                <span className="admin-pill-value">{value ?? 0}</span>
              </div>
            ))
          }
        </section>

            <div className="admin-card professional-glass main-governance">
              <div className="card-image-bg" style={{backgroundImage: "url('https://images.unsplash.com/photo-1516616370751-86d6bd8b055a?auto=format&fit=crop&w=800&q=80')"}}></div>
              <div className="card-texture" style={{backgroundImage: `url(${ADMIN_PATTERN})`}}></div>
          <div className="admin-card-head">
            <h2>Governance & Identity Layer</h2>
            <span className="badge">{(overview?.users || []).length} Identities Managed</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Identity</th>
                  <th>Privileges</th>
                  <th>State</th>
                  <th>Activity</th>
                  <th>Lifecycle</th>
                  <th>Parameters</th>
                  <th>Control</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.users || []).map((user) => {
                  const form = userForms[user.username] || defaultUserForm;
                  return (
                    <tr key={user.username}>
                      <td>
                        <strong>{user.display_name || user.username}</strong>
                        <div className="subtle">{user.username}</div>
                      </td>
                      <td>
                        <select value={form.role} onChange={(e) => updateUserForm(user.username, "role", e.target.value)}>
                          <option>Normal user</option>
                          <option>Admin</option>
                        </select>
                        <button className="mini-save" onClick={() => runUserAction(user.username, "set_role", { role: form.role })}>Apply</button>
                      </td>
                      <td>{user.status}</td>
                      <td>{user.total_reviews ?? 0} scans</td>
                      <td>Created: {user.created_at || "-"}</td>
                      <td>
                        <div className="param-label">API Limit</div>
                        <input
                          type="number"
                          className="mini-input"
                          value={form.usage_limit_per_day}
                          onChange={(e) => updateUserForm(user.username, "usage_limit_per_day", e.target.value)}
                        />
                        <button className="mini-save" onClick={() => runUserAction(user.username, "set_limit", { usage_limit_per_day: Number(form.usage_limit_per_day) })}>Set</button>
                      </td>
                      <td>
                        <div className="action-stack">
                          <button className="btn-action" onClick={() => runUserAction(user.username, user.status === "blocked" ? "unblock" : "ban")}>
                            {user.status === "blocked" ? "Enable" : "Disable"}
                          </button>
                          <button className="btn-action danger" onClick={() => runUserAction(user.username, "delete")}>Purge</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AdminPanel;
