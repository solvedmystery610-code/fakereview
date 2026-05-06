import React, { useEffect, useState } from "react";
import { Pie, Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
} from "chart.js";
import {
  Activity,
  CircleAlert,
  MessageSquareText,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { fetchJson, postJson } from "../utils/api";
import ScrollReveal from "../components/ScrollReveal";

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

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentReviews, setRecentReviews] = useState([]);
  const [hover, setHover] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackState, setFeedbackState] = useState("");

  const username = localStorage.getItem("username");

  useEffect(() => {
    if (!username) {
      setError("Login required to view dashboard");
      setLoading(false);
      return;
    }

    const loadDashboard = async () => {
      try {
        const data = await fetchJson(`/dashboard/${encodeURIComponent(username)}`);
        setStats(data);
        setRecentReviews(data.recent_reviews || []);
      } catch (err) {
        setError(err.message || "Dashboard data load failed");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [username]);

  const submitFeedback = async () => {
    if (!feedbackMessage.trim() || !username) return;

    try {
      await postJson("/feedback", {
        username,
        message: feedbackMessage,
        rating: 5,
      });
      setFeedbackMessage("");
      setFeedbackState("Feedback submitted.");
    } catch (err) {
      setFeedbackState(err.message || "Feedback failed.");
    }
  };

  if (loading) {
    return (
      <div style={loadingStyle}>
        <h2>Loading Dashboard...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={loadingStyle}>
        <h2>{error}</h2>
      </div>
    );
  }

  const pieData = {
    labels: ["Fake", "Genuine"],
    datasets: [
      {
        data: [stats.fake_reviews || 0, stats.genuine_reviews || 0],
        backgroundColor: ["#f87171", "#4ade80"],
        borderWidth: 0,
      },
    ],
  };

  const sentimentData = {
    labels: ["Positive", "Neutral", "Negative"],
    datasets: [
      {
        label: "Sentiment",
        data: [
          stats.sentiment?.positive || 0,
          stats.sentiment?.neutral || 0,
          stats.sentiment?.negative || 0,
        ],
        backgroundColor: ["#4ade80", "#facc15", "#f87171"],
      },
    ],
  };

  const trendData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        label: "Reviews",
        data: [
          stats.weekly?.Mon || 0,
          stats.weekly?.Tue || 0,
          stats.weekly?.Wed || 0,
          stats.weekly?.Thu || 0,
          stats.weekly?.Fri || 0,
          stats.weekly?.Sat || 0,
          stats.weekly?.Sun || 0,
        ],
        borderColor: "#60a5fa",
        backgroundColor: "rgba(96,165,250,0.2)",
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const statCards = [
    {
      key: 1,
      title: "Total Reviews",
      value: stats.total_reviews,
      note: "All scans completed in your workspace",
      icon: Activity,
      accent: "#0f766e",
    },
    {
      key: 2,
      title: "Fake Reviews",
      value: stats.fake_reviews,
      note: "Flagged as suspicious by the detector",
      icon: CircleAlert,
      accent: "#dc2626",
    },
    {
      key: 3,
      title: "Genuine Reviews",
      value: stats.genuine_reviews,
      note: "Validated as authentic customer feedback",
      icon: ShieldCheck,
      accent: "#2563eb",
    },
    {
      key: 4,
      title: "Genuine Ratio",
      value: `${stats.genuine_ratio ?? stats.accuracy}%`,
      note: "Current trust performance snapshot",
      icon: TrendingUp,
      accent: "#7c3aed",
    },
  ];

  return (
    <div style={container}>
      <ScrollReveal>
        <section style={heroCard}>
          <div>
            <div style={eyebrow}>Performance Overview</div>
            <h1 style={title}>Review Analytics Dashboard</h1>
            <p style={heroText}>
              Track suspicious patterns, real feedback quality, and recent review
              activity from one professional reporting view.
            </p>
          </div>

          <div style={heroBadge}>
            <span style={heroBadgeLabel}>Workspace user</span>
            <strong>{username}</strong>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal delay={120}>
        <div style={cardGrid}>
          {statCards.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                style={{
                  ...card,
                  transform:
                    hover === item.key ? "translateY(-10px) scale(1.03)" : "none",
                  boxShadow:
                    hover === item.key
                      ? "0 28px 48px rgba(15,23,42,0.16)"
                      : card.boxShadow,
                }}
                onMouseEnter={() => setHover(item.key)}
                onMouseLeave={() => setHover(null)}
              >
                <div style={{ ...cardIcon, color: item.accent }}>
                  <Icon size={20} />
                </div>
                <h3 style={cardTitle}>{item.title}</h3>
                <p style={{ ...cardNumber, color: item.accent }}>{item.value}</p>
                <p style={cardNote}>{item.note}</p>
              </div>
            );
          })}
        </div>
      </ScrollReveal>

      <ScrollReveal delay={180}>
        <div style={chartGrid}>
          <div
            style={{
              ...chartBox,
              transform:
                hover === "chart1" ? "translateY(-10px) scale(1.03)" : "none",
            }}
            onMouseEnter={() => setHover("chart1")}
            onMouseLeave={() => setHover(null)}
          >
            <h3 style={chartTitle}>Fake vs Genuine</h3>
            <p style={chartNote}>
              Clear split between suspicious and authentic reviews.
            </p>
            <Pie data={pieData} />
          </div>

          <div
            style={{
              ...chartBox,
              transform:
                hover === "chart2" ? "translateY(-10px) scale(1.03)" : "none",
            }}
            onMouseEnter={() => setHover("chart2")}
            onMouseLeave={() => setHover(null)}
          >
            <h3 style={chartTitle}>Sentiment Distribution</h3>
            <p style={chartNote}>
              Emotional tone picked from the latest processed reviews.
            </p>
            <Bar data={sentimentData} />
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={220}>
        <div style={{ marginTop: "40px" }}>
          <div
            style={{
              ...chartBoxLarge,
              transform:
                hover === "chart3" ? "translateY(-10px) scale(1.02)" : "none",
            }}
            onMouseEnter={() => setHover("chart3")}
            onMouseLeave={() => setHover(null)}
          >
            <h3 style={chartTitle}>Weekly Review Trend</h3>
            <p style={chartNote}>
              How review traffic moved during the last seven-day cycle.
            </p>
            <Line data={trendData} />
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={260}>
        <div style={bottomGrid}>
          <div style={reviewSection}>
            <h2 style={reviewTitle}>Recent Reviews</h2>

            {recentReviews.length === 0 && (
              <p style={emptyText}>No reviews analyzed yet</p>
            )}

            {recentReviews.map((r, index) => (
              <div key={index} style={reviewItem}>
                <span style={reviewText}>{r.review || r.text}</span>
                <span
                  style={{
                    ...reviewBadge,
                    background:
                      r.result === "Fake"
                        ? "rgba(220,38,38,0.1)"
                        : "rgba(37,99,235,0.1)",
                    color: r.result === "Fake" ? "#b91c1c" : "#1d4ed8",
                  }}
                >
                  {r.result}
                </span>
              </div>
            ))}
          </div>

          <div style={feedbackCard}>
            <div style={feedbackHeader}>
              <div style={feedbackIcon}>
                <MessageSquareText size={18} />
              </div>
              <div>
                <h2 style={reviewTitle}>Share Feedback</h2>
                <p style={feedbackSubtext}>
                  Suggest improvements for the detector, reports, or experience.
                </p>
              </div>
            </div>
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder="Tell us what should improve in the detector or dashboard..."
              style={feedbackInput}
            />
            <button onClick={submitFeedback} style={feedbackButton}>
              Submit Feedback
            </button>
            {feedbackState && <p style={feedbackStatus}>{feedbackState}</p>}
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}

const container = {
  padding: "32px 20px 56px",
  width: "100%",
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top right, rgba(250,204,21,0.22), transparent 24%), radial-gradient(circle at left center, rgba(59,130,246,0.12), transparent 28%), linear-gradient(180deg,#fff7ed 0%,#fffaf4 32%,#f8fbff 100%)",
  color: "#1f2937",
};

const heroCard = {
  maxWidth: "1240px",
  margin: "0 auto 28px",
  padding: "28px",
  borderRadius: "28px",
  background: "linear-gradient(135deg,#111827 0%,#1e293b 52%,#0f766e 100%)",
  color: "#f8fafc",
  display: "flex",
  justifyContent: "space-between",
  gap: "24px",
  alignItems: "center",
  flexWrap: "wrap",
  boxShadow: "0 28px 60px rgba(15,23,42,0.18)",
};

const eyebrow = {
  display: "inline-flex",
  padding: "8px 12px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.1)",
  color: "#bfdbfe",
  fontSize: "12px",
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  marginBottom: "14px",
};

const title = {
  marginBottom: "12px",
  fontSize: "34px",
  fontWeight: "bold",
  color: "#ffffff",
};

const heroText = {
  maxWidth: "620px",
  color: "rgba(226,232,240,0.9)",
  lineHeight: "1.7",
  margin: 0,
};

const heroBadge = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "22px",
  padding: "18px 20px",
  minWidth: "240px",
  textAlign: "left",
};

const heroBadgeLabel = {
  display: "block",
  color: "#99f6e4",
  fontSize: "12px",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const cardGrid = {
  maxWidth: "1240px",
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: "20px",
};

const card = {
  background: "rgba(255,255,255,0.88)",
  padding: "24px",
  borderRadius: "22px",
  backdropFilter: "blur(12px)",
  boxShadow: "0 18px 34px rgba(15,23,42,0.08)",
  textAlign: "left",
  fontSize: "18px",
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.6)",
  transition: "all 0.3s ease",
};

const cardIcon = {
  width: "46px",
  height: "46px",
  borderRadius: "14px",
  display: "grid",
  placeItems: "center",
  background: "rgba(248,250,252,0.92)",
  boxShadow: "0 12px 24px rgba(15,23,42,0.08)",
  marginBottom: "18px",
};

const cardTitle = {
  color: "#0f172a",
  marginBottom: "10px",
};

const cardNumber = {
  fontSize: "34px",
  fontWeight: "bold",
  marginTop: "10px",
};

const cardNote = {
  marginTop: "12px",
  color: "#64748b",
  fontSize: "13px",
  lineHeight: "1.6",
};

const chartGrid = {
  maxWidth: "1240px",
  margin: "40px auto 0",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: "30px",
};

const chartBox = {
  background: "rgba(255,255,255,0.9)",
  padding: "22px",
  borderRadius: "22px",
  backdropFilter: "blur(10px)",
  boxShadow: "0 18px 34px rgba(15,23,42,0.08)",
  height: "300px",
  border: "1px solid rgba(255,255,255,0.4)",
  transition: "all 0.3s ease",
};

const chartBoxLarge = {
  maxWidth: "1240px",
  margin: "0 auto",
  background: "rgba(255,255,255,0.9)",
  padding: "22px",
  borderRadius: "22px",
  backdropFilter: "blur(10px)",
  boxShadow: "0 18px 34px rgba(15,23,42,0.08)",
  height: "350px",
  border: "1px solid rgba(255,255,255,0.4)",
  transition: "all 0.3s ease",
};

const chartTitle = {
  marginBottom: "8px",
  color: "#0f172a",
};

const chartNote = {
  marginTop: 0,
  marginBottom: "16px",
  color: "#64748b",
  fontSize: "13px",
  lineHeight: "1.5",
};

const bottomGrid = {
  maxWidth: "1240px",
  margin: "50px auto 0",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
  gap: "24px",
};

const reviewSection = {
  background: "rgba(255,255,255,0.9)",
  padding: "25px",
  borderRadius: "22px",
  backdropFilter: "blur(10px)",
  boxShadow: "0 18px 34px rgba(15,23,42,0.08)",
};

const reviewTitle = {
  marginBottom: "16px",
  color: "#0f172a",
};

const reviewItem = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  padding: "14px 0",
  borderBottom: "1px solid rgba(15,23,42,0.08)",
};

const reviewText = {
  color: "#334155",
  lineHeight: "1.6",
};

const reviewBadge = {
  padding: "8px 12px",
  borderRadius: "999px",
  fontWeight: "700",
  fontSize: "12px",
  whiteSpace: "nowrap",
};

const emptyText = {
  color: "#64748b",
};

const feedbackCard = {
  background: "linear-gradient(180deg,#eff6ff 0%,#ffffff 100%)",
  padding: "25px",
  borderRadius: "22px",
  boxShadow: "0 18px 34px rgba(15,23,42,0.08)",
  border: "1px solid rgba(191,219,254,0.8)",
};

const feedbackHeader = {
  display: "flex",
  alignItems: "flex-start",
  gap: "14px",
  marginBottom: "16px",
};

const feedbackIcon = {
  width: "44px",
  height: "44px",
  borderRadius: "14px",
  display: "grid",
  placeItems: "center",
  background: "#dbeafe",
  color: "#1d4ed8",
};

const feedbackSubtext = {
  margin: 0,
  color: "#64748b",
  fontSize: "13px",
  lineHeight: "1.6",
};

const feedbackInput = {
  width: "100%",
  minHeight: "140px",
  borderRadius: "16px",
  border: "1px solid rgba(15,23,42,0.12)",
  padding: "14px",
  marginBottom: "14px",
  background: "#ffffff",
  resize: "vertical",
  color: "#0f172a",
  outline: "none",
};

const feedbackButton = {
  padding: "12px 18px",
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "white",
  border: "none",
  borderRadius: "12px",
  cursor: "pointer",
  fontWeight: "700",
};

const feedbackStatus = {
  marginTop: "12px",
  color: "#334155",
};

const loadingStyle = {
  padding: "40px",
  color: "#111827",
};

export default Dashboard;
