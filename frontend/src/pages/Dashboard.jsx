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
  Star,
  Zap,
  Clock,
  LayoutGrid,
  Globe,
} from "lucide-react";
import { fetchJson, postJson } from "../utils/api";
import ScrollReveal from "../components/ScrollReveal";
import "./Dashboard.css";

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

const DASHBOARD_BG = "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1920&q=80";
const BG_NATURE = "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=400&q=60";
const BG_SENTIMENT = "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=60";
const BG_TRENDS = "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=400&q=60";
const BG_PULSE = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=60";
const BG_FEED = "https://images.unsplash.com/photo-1444464666168-49d633b867ad?auto=format&fit=crop&w=400&q=60";
const BG_FEEDBACK = "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=400&q=60";
const CARD_BG = "https://images.unsplash.com/photo-1550147760-44c9966d6bc7?auto=format&fit=crop&w=400&q=60";

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentReviews, setRecentReviews] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackCategory, setFeedbackCategory] = useState("Accuracy");
  const [feedbackState, setFeedbackState] = useState("");
  const [pulseData] = useState({ efficiency: 94, latency: 1.2 });

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
        rating: feedbackRating,
        category: feedbackCategory,
      });
      setFeedbackMessage("");
      setFeedbackRating(5);
      setFeedbackState("Feedback submitted successfully. Our engineers have been notified.");
    } catch (err) {
      setFeedbackState(err.message || "Feedback failed.");
    }
  };

  if (loading) return <div className="loading-state"><h2>Initializing Analytics...</h2></div>;
  if (error) return <div className="loading-state"><h2>{error}</h2></div>;

  const pieData = {
    labels: ["Fake", "Genuine"],
    datasets: [{
      data: [stats.fake_reviews || 0, stats.genuine_reviews || 0],
      backgroundColor: ["#f87171", "#4ade80"],
      borderWidth: 0,
    }],
  };

  const sentimentData = {
    labels: ["Positive", "Neutral", "Negative"],
    datasets: [{
      label: "Sentiment",
      data: [stats.sentiment?.positive || 0, stats.sentiment?.neutral || 0, stats.sentiment?.negative || 0],
      backgroundColor: ["#4ade80", "#facc15", "#f87171"],
    }],
  };

  const trendData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{
      label: "Review Traffic",
      data: [
        stats.weekly?.Mon || 0, stats.weekly?.Tue || 0, stats.weekly?.Wed || 0,
        stats.weekly?.Thu || 0, stats.weekly?.Fri || 0, stats.weekly?.Sat || 0, stats.weekly?.Sun || 0
      ],
      borderColor: "#60a5fa",
      backgroundColor: "rgba(96,165,250,0.2)",
      fill: true,
      tension: 0.4,
    }],
  };

  const statCards = [
    { title: "Analysis Volume", value: stats.total_reviews, icon: Activity, accent: "#38bdf8" },
    { title: "Risk Detected", value: stats.fake_reviews, icon: CircleAlert, accent: "#f87171" },
    { title: "Trust Verified", value: stats.genuine_reviews, icon: ShieldCheck, accent: "#4ade80" },
    { title: "Integrity Score", value: `${stats.genuine_ratio ?? stats.accuracy}%`, icon: TrendingUp, accent: "#a78bfa" },
  ];

  return (
    <div className="dashboard-page">
      {/* Background is now global in App.jsx */}
      <div className="dashboard-shell">
        <ScrollReveal>
          <header className="dashboard-hero professional-glass">
            <div className="hero-left">
              <span className="hero-kicker">Workspace Analytics</span>
              <h1>Platform Statistics</h1>
            </div>
            <div className="hero-right">
              <div className="user-badge">
                <span className="badge-value">{username}</span>
              </div>
            </div>
          </header>
        </ScrollReveal>

        <div className="dashboard-top-section">
          <ScrollReveal delay={100}>
            <div className="chart-grid-main">
              <div className="chart-container-compact professional-glass">
                <div className="card-image-bg" style={{backgroundImage: `url(${BG_NATURE})`}}></div>
                <h3>Authenticity Distribution</h3>
                <div className="chart-wrapper">
                  <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
              </div>
              <div className="chart-container-compact professional-glass">
                <div className="card-image-bg" style={{backgroundImage: `url(${BG_SENTIMENT})`}}></div>
                <h3>Sentiment Polarity</h3>
                <div className="chart-wrapper">
                  <Bar data={sentimentData} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            <div className="stats-strip">
              {statCards.map((item, idx) => (
                <div key={idx} className="stat-pill professional-glass" style={{'--accent': item.accent}}>
                  <item.icon size={18} />
                  <span className="pill-label">{item.title}</span>
                  <span className="pill-value">{item.value}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={200}>
          <div className="dashboard-middle-row">
            <div className="chart-grid-secondary">
              <div className="chart-container professional-glass wide-chart">
                <div className="card-image-bg" style={{backgroundImage: `url(${BG_TRENDS})`}}></div>
                <h3>Activity Trends (7 Days)</h3>
                <div className="chart-wrapper-large">
                  <Line data={trendData} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
              </div>
            </div>

            <div className="system-pulse-panel professional-glass">
              <div className="card-image-bg" style={{backgroundImage: `url(${BG_PULSE})`}}></div>
              <h3>System Ingress Pulse</h3>
              <div className="pulse-metric">
                <div className="pulse-icon"><Zap size={20} /></div>
                <div className="pulse-info">
                  <span className="p-label">Engine Efficiency</span>
                  <div className="p-bar-wrap"><div className="p-bar" style={{width: `${pulseData.efficiency}%`}}></div></div>
                </div>
                <span className="p-value">{pulseData.efficiency}%</span>
              </div>
              <div className="pulse-metric">
                <div className="pulse-icon"><Clock size={20} /></div>
                <div className="pulse-info">
                  <span className="p-label">API Latency</span>
                  <div className="p-bar-wrap"><div className="p-bar" style={{width: `${(pulseData.latency / 2) * 100}%`}}></div></div>
                </div>
                <span className="p-value">{pulseData.latency}s</span>
              </div>
              <div className="pulse-meta">
                <div className="m-item"><Globe size={14}/> <span>Nodes Active: 4</span></div>
                <div className="m-item"><LayoutGrid size={14}/> <span>Model: v2.4a</span></div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={300}>
          <div className="activity-grid">
            <div className="recent-reviews-list professional-glass">
              <div className="card-image-bg" style={{backgroundImage: `url(${BG_FEED})`}}></div>
              <div className="list-header">
                <h3>Global Review Feed</h3>
                <span className="live-tag">Live Feed</span>
              </div>
              <div className="reviews-scroll">
                {recentReviews.length === 0 ? <p className="empty">No recent activity.</p> : 
                  recentReviews.map((r, i) => (
                    <div key={i} className="review-card">
                      <div className="review-meta">
                        <div className="avatar">{r.username?.[0] || "?"}</div>
                        <div className="meta-text">
                          <span className="r-user">{r.username || "Anonymous"}</span>
                          <span className="r-date">Just now</span>
                        </div>
                        <span className={`pill ${r.result === "Fake" ? "pill-danger" : "pill-safe"}`}>{r.result}</span>
                      </div>
                      <p className="r-text">{r.review || r.text}</p>
                    </div>
                  ))
                }
              </div>
            </div>

            <div className="feedback-section professional-glass">
              <div className="card-image-bg" style={{backgroundImage: `url(${BG_FEEDBACK})`}}></div>
              <h3>Calibration Feedback</h3>
              <p className="subtext">Help us refine the detection heuristic engine.</p>
              
              <div className="feedback-form">
                <div className="category-select">
                  {["Accuracy", "UI/UX", "Speed", "Other"].map(cat => (
                    <button 
                      key={cat} 
                      className={`cat-btn ${feedbackCategory === cat ? "active" : ""}`}
                      onClick={() => setFeedbackCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="star-rating">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star 
                      key={s} 
                      size={24} 
                      fill={s <= feedbackRating ? "#facc15" : "none"} 
                      color={s <= feedbackRating ? "#facc15" : "#64748b"}
                      onClick={() => setFeedbackRating(s)}
                      className="star-icon"
                    />
                  ))}
                </div>

                <textarea 
                  className="feedback-input" 
                  placeholder="Tell us what we can improve..."
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  maxLength={500}
                />
                
                <div className="form-footer">
                  <span className="char-count">{feedbackMessage.length}/500</span>
                  <button className="btn-primary" onClick={submitFeedback}>Submit Insight</button>
                </div>
                {feedbackState && <p className="status-note">{feedbackState}</p>}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}

export default Dashboard;
