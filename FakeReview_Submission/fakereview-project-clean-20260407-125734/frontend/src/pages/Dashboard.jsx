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
  LineElement
} from "chart.js";
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
        setLoading(false);
      } catch (err) {
        setError(err.message || "Dashboard data load failed");
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const submitFeedback = async () => {
    if (!feedbackMessage.trim() || !username) return;
    try {
      await postJson("/feedback", {
        username,
        message: feedbackMessage,
        rating: 5
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
        borderWidth: 0
      }
    ]
  };

  const sentimentData = {
    labels: ["Positive", "Neutral", "Negative"],
    datasets: [
      {
        label: "Sentiment",
        data: [
          stats.sentiment?.positive || 0,
          stats.sentiment?.neutral || 0,
          stats.sentiment?.negative || 0
        ],
        backgroundColor: ["#4ade80", "#facc15", "#f87171"]
      }
    ]
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
          stats.weekly?.Sun || 0
        ],
        borderColor: "#60a5fa",
        backgroundColor: "rgba(96,165,250,0.2)",
        fill: true,
        tension: 0.4
      }
    ]
  };

  return (
    <div style={container}>
      <ScrollReveal>
        <h1 style={title}>Review Analytics Dashboard</h1>
      </ScrollReveal>

      <ScrollReveal delay={120}>
        <div style={cardGrid}>
          <div
            style={{
              ...card,
              transform: hover === 1 ? "translateY(-10px) scale(1.05)" : "none",
              boxShadow:
                hover === 1
                  ? "0 20px 40px rgba(0,0,0,0.8),0 0 15px rgba(59,130,246,0.4)"
                  : card.boxShadow
            }}
            onMouseEnter={() => setHover(1)}
            onMouseLeave={() => setHover(null)}
          >
            <h3>Total Reviews</h3>
            <p style={cardNumber}>{stats.total_reviews}</p>
          </div>

          <div
            style={{
              ...card,
              transform: hover === 2 ? "translateY(-10px) scale(1.05)" : "none",
              boxShadow:
                hover === 2
                  ? "0 20px 40px rgba(0,0,0,0.8),0 0 15px rgba(59,130,246,0.4)"
                  : card.boxShadow
            }}
            onMouseEnter={() => setHover(2)}
            onMouseLeave={() => setHover(null)}
          >
            <h3>Fake Reviews</h3>
            <p style={{ ...cardNumber, color: "#f87171" }}>
              {stats.fake_reviews}
            </p>
          </div>

          <div
            style={{
              ...card,
              transform: hover === 3 ? "translateY(-10px) scale(1.05)" : "none",
              boxShadow:
                hover === 3
                  ? "0 20px 40px rgba(0,0,0,0.8),0 0 15px rgba(59,130,246,0.4)"
                  : card.boxShadow
            }}
            onMouseEnter={() => setHover(3)}
            onMouseLeave={() => setHover(null)}
          >
            <h3>Genuine Reviews</h3>
            <p style={{ ...cardNumber, color: "#4ade80" }}>
              {stats.genuine_reviews}
            </p>
          </div>

          <div
            style={{
              ...card,
              transform: hover === 4 ? "translateY(-10px) scale(1.05)" : "none",
              boxShadow:
                hover === 4
                  ? "0 20px 40px rgba(0,0,0,0.8),0 0 15px rgba(59,130,246,0.4)"
                  : card.boxShadow
            }}
            onMouseEnter={() => setHover(4)}
            onMouseLeave={() => setHover(null)}
          >
            <h3>Genuine Ratio</h3>
            <p style={cardNumber}>{stats.genuine_ratio ?? stats.accuracy}%</p>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={180}>
        <div style={chartGrid}>
          <div
            style={{
              ...chartBox,
              transform:
                hover === "chart1" ? "translateY(-10px) scale(1.03)" : "none"
            }}
            onMouseEnter={() => setHover("chart1")}
            onMouseLeave={() => setHover(null)}
          >
            <h3 style={chartTitle}>Fake vs Genuine</h3>
            <Pie data={pieData} />
          </div>

          <div
            style={{
              ...chartBox,
              transform:
                hover === "chart2" ? "translateY(-10px) scale(1.03)" : "none"
            }}
            onMouseEnter={() => setHover("chart2")}
            onMouseLeave={() => setHover(null)}
          >
            <h3 style={chartTitle}>Sentiment Distribution</h3>
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
                hover === "chart3" ? "translateY(-10px) scale(1.03)" : "none"
            }}
            onMouseEnter={() => setHover("chart3")}
            onMouseLeave={() => setHover(null)}
          >
            <h3 style={chartTitle}>Weekly Review Trend</h3>
            <Line data={trendData} />
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={260}>
        <div style={reviewSection}>
          <h2 style={reviewTitle}>Recent Reviews</h2>

          {recentReviews.length === 0 && <p>No reviews analyzed yet</p>}

          {recentReviews.map((r, index) => (
            <div key={index} style={reviewItem}>
              <span>{r.review || r.text}</span>
              <span
                style={{
                  color: r.result === "Fake" ? "#f87171" : "#4ade80"
                }}
              >
                {r.result}
              </span>
            </div>
          ))}
        </div>
      </ScrollReveal>

      <ScrollReveal delay={300}>
        <div style={reviewSection}>
          <h2 style={reviewTitle}>Share Feedback</h2>
          <textarea
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            placeholder="Tell us what should improve in the detector or dashboard..."
            style={{
              width: "100%",
              minHeight: "110px",
              borderRadius: "12px",
              border: "1px solid rgba(15,23,42,0.12)",
              padding: "14px",
              marginBottom: "12px"
            }}
          />
          <button
            onClick={submitFeedback}
            style={{
              padding: "10px 16px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            Submit Feedback
          </button>
          {feedbackState && <p style={{ marginTop: "10px" }}>{feedbackState}</p>}
        </div>
      </ScrollReveal>
    </div>
  );
}

const container = {
  padding: "40px",
  width: "100%",
  minHeight: "100vh",
  background: "linear-gradient(180deg,#f4c8a0 0%,#f9e4d1 35%,#fff7ef 100%)",
  color: "#3f2a1f"
};

const title = {
  marginBottom: "30px",
  fontSize: "34px",
  fontWeight: "bold"
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: "20px"
};

const card = {
  background: "rgba(255,255,255,0.9)",
  padding: "25px",
  borderRadius: "14px",
  backdropFilter: "blur(12px)",
  boxShadow: "0 10px 30px rgba(15,23,42,0.15)",
  textAlign: "center",
  fontSize: "18px",
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.4)",
  transition: "all 0.3s ease"
};

const cardNumber = {
  fontSize: "34px",
  fontWeight: "bold",
  marginTop: "10px"
};

const chartGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "30px",
  marginTop: "40px"
};

const chartBox = {
  background: "rgba(255,255,255,0.9)",
  padding: "20px",
  borderRadius: "14px",
  backdropFilter: "blur(10px)",
  boxShadow: "0 10px 30px rgba(15,23,42,0.15)",
  height: "300px",
  border: "1px solid rgba(255,255,255,0.4)",
  transition: "all 0.3s ease"
};

const chartBoxLarge = {
  background: "rgba(255,255,255,0.9)",
  padding: "20px",
  borderRadius: "14px",
  backdropFilter: "blur(10px)",
  boxShadow: "0 10px 30px rgba(15,23,42,0.15)",
  height: "350px",
  border: "1px solid rgba(255,255,255,0.4)",
  transition: "all 0.3s ease"
};

const chartTitle = {
  marginBottom: "15px"
};

const reviewSection = {
  marginTop: "50px",
  background: "rgba(255,255,255,0.9)",
  padding: "25px",
  borderRadius: "14px",
  backdropFilter: "blur(10px)",
  boxShadow: "0 10px 30px rgba(15,23,42,0.15)"
};

const reviewTitle = {
  marginBottom: "20px"
};

const reviewItem = {
  display: "flex",
  justifyContent: "space-between",
  padding: "10px 0",
  borderBottom: "1px solid rgba(15,23,42,0.08)"
};

const loadingStyle = {
  padding: "40px",
  color: "#111827"
};

export default Dashboard;
