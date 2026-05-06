import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ScrollReveal from "../components/ScrollReveal";
import { fetchJson } from "../utils/api";
import "./Explainability.css";

const EXPLAIN_BG = "";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const tokenize = (review) => review.match(/[a-zA-Z0-9']+/g) || [];

const getSentenceCount = (review) =>
  review
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;

const buildRiskRadar = (review, resultData) => {
  const signals = resultData?.signals || {};
  const probFake = typeof resultData?.prob_fake === "number" ? resultData.prob_fake : 0.5;
  const tokens = tokenize(review.toLowerCase());
  const sentenceCount = getSentenceCount(review);
  const numericHits = (review.match(/\b\d+(?:\.\d+)?\b/g) || []).length;
  const emphasisHits = (review.match(/[!]/g) || []).length + (signals.capsWords || 0);
  const duplicateState = resultData?.duplicate?.exact
    ? "Exact repeat found"
    : resultData?.duplicate?.near
      ? "Near-duplicate pattern found"
      : "No duplicate evidence";

  return [
    {
      title: "Promotion Pressure",
      tone: probFake >= 0.65 ? "risk" : "safe",
      score: probFake >= 0.75 ? "High" : probFake >= 0.55 ? "Medium" : "Low",
      body:
        probFake >= 0.65
          ? "The writing leans sales-like or overconfident, so the model is pushing the review toward fake."
          : "The tone does not look heavily promotional, which helps the review feel more natural.",
    },
    {
      title: "Concrete Detail",
      tone: numericHits > 0 || sentenceCount >= 3 ? "safe" : "risk",
      score: numericHits > 0 ? "Measured" : sentenceCount >= 3 ? "Contextual" : "Thin",
      body:
        numericHits > 0 || sentenceCount >= 3
          ? "Specific details or fuller context give the model stronger evidence to trust."
          : "The review lacks measurable detail, so the model has less proof to rely on.",
    },
    {
      title: "Writing Variety",
      tone: (signals.uniqueRatio || 0) >= 0.56 ? "safe" : "risk",
      score: `${Math.round((signals.uniqueRatio || 0) * 100)}% unique`,
      body:
        (signals.uniqueRatio || 0) >= 0.56
          ? "Vocabulary variety looks reasonably organic instead of repetitive."
          : "Repeated wording makes the writing look more templated than personal.",
    },
    {
      title: "Duplicate Check",
      tone: resultData?.duplicate?.near ? "risk" : "safe",
      score: duplicateState,
      body:
        resultData?.duplicate?.near
          ? "The detector found another similar review pattern, which is a warning sign for copied content."
          : "No strong duplicate pattern was found in recent stored reviews.",
    },
    {
      title: "Emphasis Level",
      tone: emphasisHits >= 3 ? "risk" : "safe",
      score: emphasisHits >= 3 ? "Heavy" : emphasisHits > 0 ? "Noticeable" : "Calm",
      body:
        emphasisHits >= 3
          ? "Lots of punctuation or emphasis often makes a review feel more persuasive than reflective."
          : "The writing style stays controlled, which usually feels more believable.",
    },
    {
      title: "Narrative Shape",
      tone: sentenceCount <= 1 || tokens.length < 12 ? "risk" : "safe",
      score: sentenceCount <= 1 ? "One-shot" : sentenceCount >= 3 ? "Layered" : "Simple",
      body:
        sentenceCount >= 3
          ? "The review has a fuller start-to-finish story rather than a single slogan."
          : "Short or one-shot structure gives the model less real-world context.",
    },
  ];
};

const buildTrustBuilders = (review, resultData) => {
  const signals = resultData?.signals || {};
  const sentenceCount = getSentenceCount(review);
  const numericHits = (review.match(/\b\d+(?:\.\d+)?\b/g) || []).length;
  const hasContrast = /\bbut\b|\bhowever\b|\balthough\b|\bthough\b/i.test(review);
  const authenticity = Math.round(
    clamp(1 - (resultData?.prob_fake ?? 0.5), 0, 1) * 100
  );

  return [
    {
      label: "Authenticity Score",
      value: `${authenticity}%`,
      note: "A plain-language view of how believable the review currently looks.",
    },
    {
      label: "Context Depth",
      value: sentenceCount >= 3 ? "Strong" : sentenceCount === 2 ? "Fair" : "Weak",
      note: "Longer context helps the model understand experience instead of marketing tone.",
    },
    {
      label: "Specific Detail",
      value: numericHits > 0 ? "Present" : "Missing",
      note: "Numbers, time spans, distances, and prices make reviews feel lived-in.",
    },
    {
      label: "Balanced Tone",
      value: hasContrast ? "Balanced" : "One-sided",
      note: "A believable review often includes at least one tradeoff or limitation.",
    },
    {
      label: "Language Style",
      value: signals.language || "Unknown",
      note: "Language detection is basic, but it helps the pipeline stay consistent.",
    },
    {
      label: "Word Count",
      value: `${signals.wordCount || 0} words`,
      note: "Extremely short reviews are harder to trust or verify confidently.",
    },
  ];
};

const buildCoachAdvice = (review, resultData) => {
  const signals = resultData?.signals || {};
  const sentenceCount = getSentenceCount(review);
  const probFake = typeof resultData?.prob_fake === "number" ? resultData.prob_fake : 0.5;
  const advice = [];

  if ((signals.wordCount || 0) < 18) {
    advice.push("Add one or two more sentences about where, when, or how the experience happened.");
  }
  if ((signals.uniqueRatio || 0) < 0.5) {
    advice.push("Replace repeated praise words with concrete detail so the writing feels less templated.");
  }
  if (!/\bbut\b|\bhowever\b|\balthough\b|\bthough\b/i.test(review)) {
    advice.push("Include one honest tradeoff or limitation. Balanced reviews usually look more genuine.");
  }
  if (!/\b\d+(?:\.\d+)?\b/.test(review)) {
    advice.push("Mention a measurable detail like time, quantity, distance, room number, or price.");
  }
  if (probFake >= 0.65) {
    advice.push("Reduce sales-like wording such as absolute praise or blanket recommendations.");
  }
  if (sentenceCount >= 3 && probFake < 0.55) {
    advice.push("The structure is already solid. Keep the details concrete and avoid over-polishing the language.");
  }

  return advice.slice(0, 5);
};

function Explainability() {
  const navigate = useNavigate();
  const location = useLocation();
  const [review, setReview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultData, setResultData] = useState(null);

  const result = resultData?.status || resultData?.result || null;
  const confidence = resultData?.confidence || 0;
  const riskRadar = useMemo(
    () => buildRiskRadar(review, resultData),
    [review, resultData]
  );
  const trustBuilders = useMemo(
    () => buildTrustBuilders(review, resultData),
    [review, resultData]
  );
  const coachAdvice = useMemo(
    () => buildCoachAdvice(review, resultData),
    [review, resultData]
  );

  const handleAnalyze = async () => {
    setError("");

    if (!review.trim()) {
      setError("Paste a review first so the insight coach has something to inspect.");
      return;
    }

    setLoading(true);
    try {
      const data = await fetchJson("/analyze", {
        method: "POST",
        body: JSON.stringify({
          review,
          username: localStorage.getItem("username") || "guest",
          persist: false,
        }),
      });
      setResultData(data);
    } catch (issue) {
      setError(issue.message || "Insight coach analysis failed. Please try again.");
      setResultData(null);
    } finally {
      setLoading(false);
    }
  };

  const authenticity = Math.round(
    clamp(1 - (resultData?.prob_fake ?? 0.5), 0, 1) * 100
  );
  const backTarget = location.state?.from || "/analyzer";

  return (
    <div className="explain-page">
      {/* Background is now global in App.jsx */}
      <div className="explain-shell">
        <ScrollReveal>
          <header className="explain-hero professional-glass">
            <div>
              <p className="explain-kicker">Core Insight Coach</p>
              <h1>Semantic Integrity Breakdown</h1>
              <p className="explain-subtitle">
                Deconstructing textual review datasets into pressure, detail, tone, and trust signals
                to provide deep-layer explainability for detection outcomes.
              </p>
              <div className="explain-actions">
                <button className="explain-primary" onClick={() => navigate(backTarget)}>
                  Return to Workforce
                </button>
                <button className="explain-secondary" onClick={() => navigate("/batch-analyzer")}>
                  Analyze Data Stream
                </button>
              </div>
            </div>

            <div className="explain-card info-hero professional-glass">
              <h3>Explainability Core</h3>
              <ul>
                <li>Risk Radar: Promotional pressure audit</li>
                <li>Trust Framework: Evidence-based believable signals</li>
                <li>Strategic Coaching: Optimization lifecycle advice</li>
              </ul>
            </div>
          </header>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <section className="explain-grid">
            <div className="explain-card input-card professional-glass">
              <div className="card-head">
                <h2>Raw Review Stream</h2>
                <span className="chip">Active Session</span>
              </div>
              <textarea
                className="explain-textarea"
                placeholder="Ingest review text for high-fidelity auditing..."
                value={review}
                onChange={(event) => setReview(event.target.value)}
              />
              {error && <div className="panel-error">{error}</div>}
              <button className="explain-primary full-btn" onClick={handleAnalyze} disabled={loading}>
                {loading ? "Calculating Heuristics..." : "Run Core Audit"}
              </button>
            </div>

            <div className="explain-card professional-glass">
              <div className="card-head">
                <h2>Diagnostic Snapshot</h2>
                {result && (
                  <span className={`result-pill ${result === "Fake" ? "fake" : "genuine"}`}>
                    {result}
                  </span>
                )}
              </div>

              {!resultData && !loading && (
                <p className="panel-note">
                  Initialize audit to generate decision explainability metrics.
                </p>
              )}

              {resultData && (
                <div className="summary-grid">
                  <div className="summary-item">
                    <p className="summary-label">Confidence</p>
                    <p className="summary-value">{confidence}%</p>
                  </div>
                  <div className="summary-item">
                    <p className="summary-label">Integrity</p>
                    <p className="summary-value">{authenticity}%</p>
                  </div>
                  <div className="summary-item">
                    <p className="summary-label">Vibe</p>
                    <p className="summary-value">{resultData.sentiment || "-"}</p>
                  </div>
                  <div className="summary-item">
                    <p className="summary-label">Heuristic</p>
                    <p className="summary-value small">Logistic Regression</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </ScrollReveal>

        {resultData && (
          <>
            <ScrollReveal delay={200}>
              <section className="signal-section">
                <div className="card-head">
                  <h2>Linguistic Risk Radar</h2>
                  <span className="chip">Heuristic Breakdown</span>
                </div>
                <div className="insight-card-grid">
                  {riskRadar.map((signal, idx) => (
                    <div key={idx} className={`explain-card signal-card professional-glass signal-${signal.tone}`}>
                      <div className="signal-head">
                        <h3>{signal.title}</h3>
                        <span className="signal-score">{signal.score}</span>
                      </div>
                      <p>{signal.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <section className="explain-grid">
                <div className="explain-card professional-glass">
                  <div className="card-head">
                    <h2>Evidence Framework</h2>
                    <span className="chip">Signals</span>
                  </div>
                  <div className="summary-grid">
                    {trustBuilders.map((builder, idx) => (
                      <div key={idx} className="summary-item">
                        <p className="summary-label">{builder.label}</p>
                        <p className="summary-value">{builder.value}</p>
                        <p className="panel-note" style={{ fontSize: "11px", marginTop: "6px" }}>
                          {builder.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="explain-card professional-glass">
                  <div className="card-head">
                    <h2>Expert Improvement Hub</h2>
                    <span className="chip">Coach Advice</span>
                  </div>
                  <div className="reason-list">
                    {coachAdvice.map((advice, idx) => (
                      <div key={idx} className="reason-item">
                        {advice}
                      </div>
                    ))}
                    {coachAdvice.length === 0 && (
                      <div className="reason-item reason-safe">
                        The review structure is already highly organic and fits within standard genuine behavior patterns.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </ScrollReveal>
          </>
        )}
      </div>
    </div>
  );
}

export default Explainability;
