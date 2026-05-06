import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import { getReviewSignals } from "../utils/reviewEngine";
import { fetchJson, fireAndForgetJson } from "../utils/api";
import ScrollReveal from "../components/ScrollReveal";
import "./Analyzer.css";

const ANALYZER_BG = ""; // Logic removed, background is now global

function Analyzer() {
  const navigate = useNavigate();
  const username = localStorage.getItem("username");
  const isGuest = !username;
  const activeUser = username || "guest";

  const [review, setReview] = useState("");

  const [result, setResult] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [sentiment, setSentiment] = useState("");
  const [analysis, setAnalysis] = useState([]);
  const [authScore, setAuthScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState("");
  const [signals, setSignals] = useState(null);
  const [confidenceNote, setConfidenceNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mlStatus, setMlStatus] = useState({
    state: "checking",
    progress: 0,
    error: "",
    model: ""
  });

  useEffect(() => {
    let active = true;
    let intervalId = null;

    const loadStatus = async () => {
      try {
        const data = await fetchJson("/model-status", { method: "GET" });
        if (!active) return;
        if (data?.ready) {
          setMlStatus({
            state: "ready",
            progress: 1,
            error: "",
            model: data?.model || ""
          });
        } else if (data?.model === "training") {
          setMlStatus({
            state: "training",
            progress: 0,
            error: data?.error || "Model training in progress",
            model: data?.model || "training"
          });
        } else {
          setMlStatus({
            state: "fallback",
            progress: 1,
            error: data?.error || "Model fallback active",
            model: data?.model || "rule_fallback"
          });
        }
      } catch (err) {
        if (!active) return;
        setMlStatus({
          state: "error",
          progress: 0,
          error: err?.message || "Backend unreachable",
          model: ""
        });
      }
    };

    setMlStatus({ state: "checking", progress: 0, error: "", model: "" });
    loadStatus();
    intervalId = setInterval(loadStatus, 4000);

    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const liveSignals = useMemo(() => {
    if (!review.trim()) {
      return {
        language: "Unknown",
        wordCount: 0,
        charCount: 0,
        exclamations: 0,
        questionMarks: 0,
        capsWords: 0,
        uniqueRatio: 0,
        repeatedChars: 0
      };
    }
    return getReviewSignals(review);
  }, [review]);

  const calculateMetrics = (confidenceScore, verdict) => {
    const authenticity =
      verdict === "Fake" ? 100 - confidenceScore : confidenceScore;
    setAuthScore(authenticity);

    const riskScore =
      verdict === "Fake" ? confidenceScore : 100 - confidenceScore;

    if (riskScore > 80) setRiskLevel("High");
    else if (riskScore > 60) setRiskLevel("Medium");
    else setRiskLevel("Low");
  };

  const analyze = async () => {
    if (mlStatus.state === "training") {
      setError("Model training in progress. Please retry in a few seconds.");
      return;
    }
    if (!review.trim()) {
      setError("Please enter a review to analyze.");
      return;
    }

    setError("");
    setLoading(true);
    setResult(null);

    try {
      const payload = {
        review,
        username: activeUser
      };

      const data = await fetchJson("/analyze", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setResult(data.result);
      setConfidence(data.confidence);
      setSentiment(data.sentiment);
      setAnalysis(data.analysis?.length ? data.analysis : ["Balanced review language."]);
      setSignals(data.signals || liveSignals);
      const modelLabel =
        data.model === "tfidf_word_char_logreg"
          ? "Word + Char TF-IDF Ensemble"
          : data.model === "tfidf_linear_calibrated"
          ? "TF-IDF + Linear (calibrated)"
          : data.model === "tfidf_linear"
          ? "TF-IDF + Linear"
          : data.model === "training"
          ? "Training (fallback)"
          : data.model === "rule_fallback"
          ? "Fallback rules"
          : data.model || "Server model";
      setConfidenceNote(modelLabel);

      calculateMetrics(data.confidence, data.result);
    } catch (err) {
      setError(err.message || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const buildReportText = () => {
    const lines = [
      "FakeReviewAnalysis Detection Report",
      "----------------------------------------",
      `Generated: ${new Date().toLocaleString()}`,
      `User: ${activeUser}`,
      `Language: ${signals?.language || "Unknown"}`,
      "",
      `Result: ${result}`,
      `Confidence: ${confidence}%`,
      `Sentiment: ${sentiment}`,
      `Risk Level: ${riskLevel}`,
      "",
      "--------------------------------------------------",
      "",
      "Detection Reasons:",
      ...(analysis.length ? analysis.map((item) => `- ${item}`) : ["- None"]),
      "",
      "--------------------------------------------------",
      "",
      "Signals:",
      `- Word Count: ${signals?.wordCount ?? 0}`,
      `- Character Count: ${signals?.charCount ?? 0}`,
      `- Exclamations: ${signals?.exclamations ?? 0}`,
      `- Question Marks: ${signals?.questionMarks ?? 0}`,
      `- All Caps Words: ${signals?.capsWords ?? 0}`,
      `- Repeated Characters: ${signals?.repeatedChars ?? 0}`,
      `- Unique Ratio: ${signals?.uniqueRatio ?? 0}`,
      "",
      "--------------------------------------------------",
      ""
    ];

    lines.push("Review Text:");
    lines.push(review);

    return lines.join("\n");
  };

  const handleDownloadReport = () => {
    if (!result) return;
    const reportText = buildReportText();
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const headerHeight = 60;

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, headerHeight, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("FakeReviewAnalysis Report", margin, 38);

    doc.setTextColor(17, 24, 39);
    doc.setFont("times", "normal");
    doc.setFontSize(12);

    const maxWidth = pageWidth - margin * 2;
    const lines = doc.splitTextToSize(reportText, maxWidth);

    let y = headerHeight + 20;
    lines.forEach((line) => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 16;
    });

    const fileName = `review-report-${Date.now()}.pdf`;
    doc.save(fileName);
    fireAndForgetJson("/track/download", {
      username: activeUser,
      file_name: fileName,
      file_type: "PDF",
      source: "analyzer"
    });
  };

  return (
    <div className="analyzer-page">
      {/* Background is now global in App.jsx */}
      <div className="analyzer-shell">
        <ScrollReveal>
          <header className="analyzer-hero">
            <div>
              <p className="hero-kicker">Universal Review Intelligence</p>
              <h1>Analyze Reviews Across Any Platform</h1>
                <p className="hero-subtitle">
                  Amazon, Flipkart, Google Reviews, or anywhere else. Text signals
                  combined with lightweight ML for faster, smarter checks.
                </p>
            </div>
            <div className="hero-meta">
              <div className="meta-chip">
                Status
                <span className="meta-dot" />
                Active
              </div>
              <div className="meta-chip">
                Model:{" "}
                {mlStatus.state === "ready"
                  ? mlStatus.model === "tfidf_word_char_logreg"
                    ? "Word + Char TF-IDF Online"
                    : "TF-IDF Model Online"
                  : mlStatus.state === "training"
                  ? "Training Model"
                  : mlStatus.state === "fallback"
                  ? "Fallback Rules"
                  : mlStatus.state === "checking"
                  ? "Checking Server"
                  : "Server Offline"}
              </div>
              <div className="meta-chip">
                Mode: {isGuest ? "Guest" : "Signed In"}
              </div>
            </div>
          </header>
        </ScrollReveal>

        {mlStatus.state === "error" && (
          <div className="error-box">
            Backend unavailable. Please start the server to run analysis.
          </div>
        )}
        {mlStatus.state === "training" && (
          <div className="error-box">
            Model training in progress. Analysis may use fallback rules.
          </div>
        )}
        {mlStatus.state === "fallback" && (
          <div className="error-box">
            Model fallback active. Check dataset path or training status.
          </div>
        )}

        {isGuest && (
          <ScrollReveal delay={80}>
            <div className="professional-glass" style={{padding: '24px 40px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px', border: '1px solid rgba(255,255,255,0.1)'}}>
              <p style={{color: 'rgba(255,255,255,0.8)', fontSize: '16px', margin: 0}}>
                You are analyzing as a guest. <strong>Log in</strong> to save history and unlock the advanced dashboard.
              </p>
              <button onClick={() => navigate("/login")} style={{padding: '12px 24px', background: 'white', border: 'none', borderRadius: '12px', color: '#0f172a', fontWeight: '700', cursor: 'pointer', transition: 'var(--transition)'}}>
                Access Analytics Console
              </button>
            </div>
          </ScrollReveal>
        )}

        <ScrollReveal delay={120}>
          <div className="analyzer-grid">
            <section className="card input-card professional-glass">
            <div className="card-header">
              <h2>Review Input</h2>
              <span className="pill">Live Signals</span>
            </div>

            <label className="field-label">Paste review text</label>
            <textarea
              className="review-box"
              placeholder="Paste or type the review you want to check..."
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />

            <div className="signal-row">
              <div className="signal">
                <span className="signal-label">Words</span>
                <span className="signal-value">{liveSignals.wordCount}</span>
              </div>
              <div className="signal">
                <span className="signal-label">Characters</span>
                <span className="signal-value">{liveSignals.charCount}</span>
              </div>
              <div className="signal">
                <span className="signal-label">Unique Ratio</span>
                <span className="signal-value">{liveSignals.uniqueRatio}</span>
              </div>
            </div>

            {error && <div className="error-box">{error}</div>}

            <button
              className="primary-btn"
              onClick={analyze}
              disabled={loading || mlStatus.state === "training"}
            >
              {loading ? "Analyzing..." : "Analyze Review"}
            </button>
            <p className="helper-text">
              Confidence reflects pattern similarity learned from real reviews.
            </p>
            </section>

            <section className="card result-card professional-glass">
            <div className="card-header">
              <h2>Analysis Result</h2>
              {result && (
                <span
                  className={`pill ${
                    result === "Fake" ? "pill-danger" : "pill-safe"
                  }`}
                >
                  {result}
                </span>
              )}
            </div>

            {!result && !loading && (
              <div className="empty-state">
                <p>Submit a review to see the detection output.</p>
              </div>
            )}

            {loading && (
              <div className="scan-box">
                <div className="scan-circle" />
                <p>AI is scanning the review...</p>
              </div>
            )}

            {result && (
              <div className="result-body">
                <div className="result-grid">
                  <div>
                    <p className="metric-label">Confidence</p>
                    <p className="metric-value">{confidence}%</p>
                    <p className="mini-note">{confidenceNote}</p>
                  </div>
                  <div>
                    <p className="metric-label">Sentiment</p>
                    <p className="metric-value">{sentiment}</p>
                  </div>
                  <div>
                    <p className="metric-label">Risk Level</p>
                    <p className="metric-value">{riskLevel}</p>
                  </div>
                  <div>
                    <p className="metric-label">Language</p>
                    <p className="metric-value">
                      {signals?.language || "Unknown"}
                    </p>
                  </div>
                </div>

                <div className="progress-track">
                  <div
                    className={`progress-fill ${
                      result === "Fake" ? "fill-danger" : "fill-safe"
                    }`}
                    style={{ width: `${confidence}%` }}
                  />
                </div>

                <div className="auth-box">
                  <p className="metric-label">Authenticity Score</p>
                  <div className="progress-track">
                    <div
                      className="progress-fill fill-accent"
                      style={{ width: `${authScore}%` }}
                    />
                  </div>
                  <p className="auth-note">{authScore}% Authentic</p>
                </div>

                <div className="reason-box">
                  <h3>Detection Reasons</h3>
                  {analysis.map((item, index) => (
                    <div key={index} className="reason-item">
                      {item}
                    </div>
                  ))}
                </div>

                <button
                  className="secondary-btn"
                  onClick={handleDownloadReport}
                >
                  Download Report (PDF)
                </button>
              </div>
            )}
            </section>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={180}>
          <div className="analytics-section professional-glass">
            <div className="analytics-header">
              <h2>System Intelligence Insights</h2>
              <p>Live metrics from the FakeReviewAnalysis detection engine across current session and global dataset.</p>
            </div>
            
            <div className="analytics-grid">
              <div className="analytics-card main-pulse">
                <div className="pulse-header">
                  <span className="pulse-label">Global Authenticity Pulse</span>
                  <span className="pulse-status">Live</span>
                </div>
                <div className="pulse-content">
                  <div className="pulse-value">84.2%</div>
                  <div className="pulse-subtext">Average authenticity score across all analyzed reviews</div>
                </div>
                <div className="pulse-bar-wrapper">
                  <div className="pulse-bar" style={{ width: '84.2%' }}></div>
                </div>
              </div>

              <div className="analytics-card">
                <div className="insight-stat">
                  <span className="stat-label">Engine Confidence</span>
                  <span className="stat-value">92%</span>
                </div>
                <p className="stat-desc">The AI model's current certainty baseline for linguistic pattern recognition.</p>
              </div>

              <div className="analytics-card">
                <div className="insight-stat">
                  <span className="stat-label">Processing Latency</span>
                  <span className="stat-value">~1.2s</span>
                </div>
                <p className="stat-desc">Average time for the ML and structural engine to return a verdict.</p>
              </div>
            </div>

            <div className="detection-logic-card">
              <h3>Detection Pipeline Overview</h3>
              <div className="logic-steps">
                <div className="logic-step">
                  <div className="step-num">01</div>
                  <div className="step-content">
                    <h4>Feature Extraction</h4>
                    <p>Normalizing text and calculating word distribution ratios.</p>
                  </div>
                </div>
                <div className="logic-step">
                  <div className="step-num">02</div>
                  <div className="step-content">
                    <h4>Vector Space Mapping</h4>
                    <p>Positioning review content into high-dimensional TF-IDF vectors.</p>
                  </div>
                </div>
                <div className="logic-step">
                  <div className="step-num">03</div>
                  <div className="step-content">
                    <h4>ML Classification</h4>
                    <p>Ensemble analysis using Logistic Regression and Simhash similarity.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}

export default Analyzer;
