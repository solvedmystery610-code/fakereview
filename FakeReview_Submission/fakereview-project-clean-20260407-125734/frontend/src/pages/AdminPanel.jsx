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
import { Bar, Line, Pie } from "react-chartjs-2";
import ScrollReveal from "../components/ScrollReveal";
import { fetchJson, fireAndForgetJson, postJson } from "../utils/api";
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

  const deleteReview = async (id) => {
    try {
      setMessage("");
      await postJson("/admin/delete-review", { username, id });
      setMessage("Review deleted.");
      await loadOverview(false);
    } catch (err) {
      setError(err.message || "Review delete failed.");
    }
  };

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
    fireAndForgetJson("/track/download", {
      username,
      file_name: fileName,
      file_type: "CSV",
      source: "admin_panel"
    });
  };

  const exportPdf = () => {
    if (!overview) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const fileName = `admin-overview-${Date.now()}.pdf`;
    const lines = [
      "FakeReviewAI Admin Snapshot",
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
    doc.text("FakeReviewAI Admin Snapshot", 40, y);
    y += 24;
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    lines.slice(1).forEach((line) => {
      doc.text(line, 40, y);
      y += 18;
    });
    doc.save(fileName);
    fireAndForgetJson("/track/download", {
      username,
      file_name: fileName,
      file_type: "PDF",
      source: "admin_panel"
    });
  };

  const charts = useMemo(() => {
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
          backgroundColor: ["#ef4444", "#22c55e"]
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

  if (loading) {
    return <div className="admin-loading">Loading admin panel...</div>;
  }

  if (!username || !isAdmin) {
    return (
      <div className="admin-loading">
        <p>Admin access required.</p>
        <button onClick={() => navigate("/login")}>Go to Login</button>
      </div>
    );
  }

  const modelMetrics = overview?.model?.metrics || {};
  const testMetrics = modelMetrics.test || {};
  const confusion = testMetrics.confusion_matrix || {};

  return (
    <div className={`admin-page ${darkMode ? "admin-page-dark" : ""}`}>
      <div className="admin-shell">
        <ScrollReveal>
          <section className="admin-hero">
            <div>
              <p className="admin-kicker">Command Center</p>
              <h1>Admin Intelligence Panel</h1>
              <p>
                User activity, downloads, suspicious behavior, model health,
                audit logs, and admin controls are all live from the backend now.
              </p>
            </div>
            <div className="admin-actions">
              <button onClick={() => setDarkMode((value) => !value)}>
                {darkMode ? "Light mode" : "Dark mode"}
              </button>
              <button className="secondary" onClick={() => loadOverview(false)}>Refresh</button>
              <button className="secondary" onClick={exportCsv}>Export CSV</button>
              <button className="secondary" onClick={exportPdf}>Export PDF</button>
            </div>
          </section>
        </ScrollReveal>

        {error && <div className="admin-alert admin-alert-error">{error}</div>}
        {message && <div className="admin-alert admin-alert-success">{message}</div>}

        <section className="admin-summary-grid">
          {[
            ["Total Users", overview?.summary?.total_users],
            ["Active Users", overview?.summary?.active_users],
            ["Total Reviews", overview?.summary?.total_reviews],
            ["Downloads", overview?.summary?.downloads],
            ["Uploads", overview?.summary?.uploads],
            ["Model Accuracy", `${overview?.platform?.fake_detection_accuracy ?? "N/A"}%`]
          ].map(([label, value]) => (
            <div className="admin-card" key={label}>
              <p className="admin-label">{label}</p>
              <p className="admin-value">{value ?? 0}</p>
            </div>
          ))}
        </section>

        <section className="admin-grid two-up">
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>Platform Review Stats</h2>
              <span className="pill">{overview?.platform?.fake_detection_accuracy ?? "N/A"}% accuracy</span>
            </div>
            {charts && <Line data={charts.usageLine} options={{ responsive: true, maintainAspectRatio: false }} />}
          </div>
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>Fake vs Genuine</h2>
              <span className="pill">{overview?.platform?.peak_usage_time?.hour || "00:00"} peak</span>
            </div>
            {charts && <Pie data={charts.fakePie} options={{ responsive: true, maintainAspectRatio: false }} />}
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-head">
            <h2>User Activity Tracking & Controls</h2>
            <span className="pill">{overview?.users?.length || 0} accounts</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Sessions</th>
                  <th>Reviews</th>
                  <th>Fake/Genuine</th>
                  <th>Last Login</th>
                  <th>Created</th>
                  <th>Limit</th>
                  <th>Plan</th>
                  <th>Actions</th>
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
                        <div className="subtle">{user.activity_status}</div>
                      </td>
                      <td>
                        <select value={form.role} onChange={(e) => updateUserForm(user.username, "role", e.target.value)}>
                          <option>Normal user</option>
                          <option>Admin</option>
                        </select>
                        <button onClick={() => runUserAction(user.username, "set_role", { role: form.role })}>Save</button>
                      </td>
                      <td>{user.status}</td>
                      <td>{user.login_count ?? 0}</td>
                      <td>{user.total_reviews ?? 0}</td>
                      <td>{user.fake_reviews ?? 0} / {user.genuine_reviews ?? 0}</td>
                      <td>{user.last_login_at || "-"}</td>
                      <td>{user.created_at || "-"}</td>
                      <td>
                        <input
                          type="number"
                          value={form.usage_limit_per_day}
                          onChange={(e) => updateUserForm(user.username, "usage_limit_per_day", e.target.value)}
                        />
                        <button onClick={() => runUserAction(user.username, "set_limit", { usage_limit_per_day: Number(form.usage_limit_per_day) })}>Save</button>
                      </td>
                      <td>
                        <select value={form.plan} onChange={(e) => updateUserForm(user.username, "plan", e.target.value)}>
                          <option>Free</option>
                          <option>Pro</option>
                          <option>Enterprise</option>
                        </select>
                        <button onClick={() => runUserAction(user.username, "set_plan", { plan: form.plan })}>Save</button>
                      </td>
                      <td>
                        <div className="action-stack">
                          <button onClick={() => runUserAction(user.username, user.status === "blocked" ? "unblock" : "ban")}>
                            {user.status === "blocked" ? "Unblock" : "Ban"}
                          </button>
                          <button onClick={() => runUserAction(user.username, "reset_password")}>Reset Password</button>
                          <button className="danger" onClick={() => runUserAction(user.username, "delete")}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-grid two-up">
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>Downloads & Export History</h2>
              <span className="pill">{overview?.downloads?.total_downloads || 0} total</span>
            </div>
            <div className="stack-list">
              {(overview?.downloads?.recent || []).slice(0, 10).map((item) => (
                <div key={item.id} className="list-item">
                  <strong>{item.file_type}</strong>
                  <span>{item.file_name}</span>
                  <span>{item.username}</span>
                  <span>{item.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>Upload Monitoring</h2>
              <span className="pill">{overview?.uploads?.total_uploads || 0} files</span>
            </div>
            <div className="stack-list">
              {(overview?.uploads?.recent || []).slice(0, 10).map((item) => (
                <div key={item.id} className="list-item">
                  <strong>{item.status}</strong>
                  <span>{item.file_name}</span>
                  <span>{item.file_size} bytes</span>
                  <span>{item.error || item.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-grid two-up">
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>API Usage & Roles</h2>
              <span className="pill">{overview?.api_usage?.total_requests || 0} requests</span>
            </div>
            {charts && <Bar data={charts.roleBar} options={{ responsive: true, maintainAspectRatio: false }} />}
            <div className="mini-grid">
              {(overview?.api_usage?.top_api_users || []).map((item) => (
                <div className="mini-card" key={item.username}>
                  <strong>{item.username}</strong>
                  <span>{item.count} requests</span>
                </div>
              ))}
            </div>
          </div>
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>Recent Audit Activity</h2>
              <span className="pill">{(overview?.audit_logs || []).length} events</span>
            </div>
            <div className="stack-list">
              {(overview?.audit_logs || []).slice(0, 10).map((item) => (
                <div key={item.id} className="list-item">
                  <strong>{item.action}</strong>
                  <span>{item.actor}</span>
                  <span>{item.target}</span>
                  <span>{item.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-grid two-up">
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>Model Performance Monitoring</h2>
              <span className="pill">{overview?.model?.version || "N/A"}</span>
            </div>
            <div className="mini-grid">
              <div className="mini-card"><strong>Accuracy</strong><span>{testMetrics.accuracy ?? "N/A"}</span></div>
              <div className="mini-card"><strong>Precision</strong><span>{testMetrics.precision ?? "N/A"}</span></div>
              <div className="mini-card"><strong>Recall</strong><span>{testMetrics.recall ?? "N/A"}</span></div>
              <div className="mini-card"><strong>Threshold</strong><span>{overview?.model?.metrics?.threshold ?? "N/A"}</span></div>
            </div>
            <div className="confusion-grid">
              <div className="mini-card"><strong>TP</strong><span>{confusion.tp ?? 0}</span></div>
              <div className="mini-card"><strong>TN</strong><span>{confusion.tn ?? 0}</span></div>
              <div className="mini-card"><strong>FP</strong><span>{confusion.fp ?? 0}</span></div>
              <div className="mini-card"><strong>FN</strong><span>{confusion.fn ?? 0}</span></div>
            </div>
            <div className="stack-list">
              {(overview?.model?.training_history || []).slice(0, 6).map((item, index) => (
                <div key={`${item.started_at}-${index}`} className="list-item">
                  <strong>{item.status}</strong>
                  <span>{item.version || "model run"}</span>
                  <span>{item.duration_seconds}s</span>
                  <span>{item.error || item.finished_at}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>Audit Logs & Feedback</h2>
              <span className="pill">{(overview?.audit_logs || []).length} events</span>
            </div>
            <div className="stack-list">
              {(overview?.audit_logs || []).slice(0, 8).map((item) => (
                <div key={item.id} className="list-item">
                  <strong>{item.action}</strong>
                  <span>{item.actor}</span>
                  <span>{item.target}</span>
                  <span>{item.timestamp}</span>
                </div>
              ))}
            </div>
            <h3 className="subheading">Feedback Inbox</h3>
            <div className="stack-list">
              {(overview?.feedback || []).length ? (overview.feedback || []).slice(0, 6).map((item) => (
                <div key={item.id} className="list-item">
                  <strong>{item.username}</strong>
                  <span>{item.message}</span>
                  <span>{item.rating || "-"}</span>
                </div>
              )) : <div className="empty">No feedback submitted yet.</div>}
            </div>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Recent Reviews</h2>
            <span className="pill">{(overview?.reviews || []).length} loaded</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Review</th>
                  <th>Result</th>
                  <th>Platform</th>
                  <th>Confidence</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.reviews || []).slice(0, 20).map((item) => (
                  <tr key={item.id}>
                    <td>{item.username}</td>
                    <td className="review-cell">{item.review}</td>
                    <td>{item.result}</td>
                    <td>{item.platform || "-"}</td>
                    <td>{item.confidence}%</td>
                    <td>{item.timestamp}</td>
                    <td><button className="danger" onClick={() => deleteReview(item.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminPanel;
