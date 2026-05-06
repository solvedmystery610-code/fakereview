import React from "react";
import { useNavigate } from "react-router-dom";
import ScrollReveal from "../components/ScrollReveal";
import "./Home.css";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <div className="home-shell">
        <ScrollReveal>
          <header className="home-hero">
            <div>
              <p className="home-kicker">Trusted Review Intelligence</p>
              <h1>Detect Fake Reviews Across Any Platform</h1>
              <p className="home-subtitle">
                From Amazon to Flipkart to Google Reviews, our system combines
                NLP, ML, and behavioral signals to flag suspicious reviews and
                boost trust instantly.
              </p>
              <div className="home-actions">
                <button
                  className="home-primary-btn"
                  onClick={() => navigate("/analyzer")}
                >
                  Analyze Review
                </button>
                <button
                  className="home-ghost-btn"
                  onClick={() => navigate("/demo")}
                >
                  View Demo
                </button>
              </div>
            </div>

            <div className="hero-metrics">
              <div className="metric-card">
                <h3>90%+ Confidence</h3>
                <p>Calibrated detection for fast decision making.</p>
              </div>
              <div className="metric-card">
                <h3>Batch Ready</h3>
                <p>Analyze many reviews together for faster moderation.</p>
              </div>
              <div className="metric-card">
                <h3>Explainable Decisions</h3>
                <p>Show exactly why the model called a review fake or genuine.</p>
              </div>
            </div>
          </header>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <section className="home-section">
            <h2>Core Capabilities</h2>
            <div className="feature-grid">
              <div className="feature-card">
                <div className="card-visual visual-signal">
                  <img
                    className="visual-img img-nlp"
                    src="/images/nlp.jpg"
                    alt="NLP analysis"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                <h3>NLP Signals</h3>
                <p>
                  Detects repetition, over-enthusiasm, sentiment mismatch, and
                  suspicious language patterns.
                </p>
                <button className="inline-btn" onClick={() => navigate("/analyzer")}>
                  Open Analyzer
                </button>
              </div>

              <div className="feature-card">
                <div className="card-visual visual-ml">
                  <img
                    className="visual-img img-ml"
                    src="/images/ml.jpg"
                    alt="Machine learning"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                <h3>Machine Learning</h3>
                <p>
                  TF-IDF + linear model trained on labeled reviews with
                  calibration for more reliable confidence scoring.
                </p>
                <button className="inline-btn" onClick={() => navigate("/batch-analyzer")}>
                  Open Batch Analyzer
                </button>
              </div>

              <div className="feature-card">
                <div className="card-visual visual-spam">
                  <img
                    className="visual-img img-spam"
                    src="/images/spam.jpg"
                    alt="Spam detection"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                <h3>Spam Detection</h3>
                <p>
                  Flags burst activity, extreme ratings, and incentivized review
                  cues to reduce manipulation.
                </p>
                <button className="inline-btn" onClick={() => navigate("/history")}>
                  Open History
                </button>
              </div>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <section className="home-section">
            <h2>Featured Workbench</h2>
            <div className="feature-grid">
              <div className="feature-card feature-focus">
                <h3>Batch Review Analyzer</h3>
                <p>
                  Upload CSV or paste multiple reviews line by line to detect
                  fake vs genuine patterns in one professional workflow.
                </p>
                <button
                  className="inline-btn"
                  onClick={() => navigate("/batch-analyzer")}
                >
                  Open Batch Analyzer
                </button>
              </div>

              <div className="feature-card feature-focus">
                <h3>Explainability Panel</h3>
                <p>
                  Break every decision into suspicious signals, trust signals,
                  tone, and structure so your demo feels transparent and smart.
                </p>
                <button
                  className="inline-btn"
                  onClick={() => navigate("/explainability")}
                >
                  Open Explainability
                </button>
              </div>

              <div className="feature-card feature-focus">
                <h3>Single Review Analyzer</h3>
                <p>
                  Use the main analyzer for one-off deep checks, then move into
                  explainability or batch review workflows.
                </p>
                <button className="inline-btn" onClick={() => navigate("/analyzer")}>
                  Open Analyzer
                </button>
              </div>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delay={140}>
          <section className="home-section how-section">
            <h2>How It Works</h2>
            <div className="how-grid">
              <div className="how-card">
                <span className="step">Step 1</span>
                <h3>Submit Review</h3>
                <p>Paste text or upload a review photo to start analysis.</p>
                <button
                  className="inline-btn"
                  onClick={() => navigate("/analyzer")}
                >
                  Open Analyzer
                </button>
              </div>

              <div className="how-card">
                <span className="step">Step 2</span>
                <h3>Signal Scan</h3>
                <p>ML, NLP, and image checks blend into one trust score.</p>
                <button
                  className="inline-btn"
                  onClick={() => navigate("/explainability", { state: { from: "/" } })}
                >
                  See Signals
                </button>
              </div>

              <div className="how-card">
                <span className="step">Step 3</span>
                <h3>Generate Report</h3>
                <p>Download a PDF report with reasons and key metrics.</p>
                <button className="inline-btn" onClick={() => navigate("/demo")}>
                  Download Sample
                </button>
              </div>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delay={160}>
          <section className="home-section split">
            <div>
              <h2>Platform Coverage</h2>
              <p className="home-subtitle">
                Supports reviews from major ecommerce and service platforms with
                a unified detection flow.
              </p>
              <div className="platform-list">
                <span>Amazon</span>
                <span>Flipkart</span>
                <span>Google Reviews</span>
                <span>Yelp</span>
                <span>TripAdvisor</span>
                <span>Custom Platforms</span>
              </div>
            </div>
            <div className="trust-panel">
              <h3>Why It Matters</h3>
              <p>
                Fake reviews reduce trust and hurt real sellers. Our system helps
                teams verify authenticity quickly and keep customer trust high.
              </p>
              <ul>
                <li>Live review analytics and history dashboards</li>
                <li>Explainable reasons for every detection</li>
                <li>Batch analysis for product-level or seller-level review audits</li>
              </ul>
              <button className="inline-btn" onClick={() => navigate("/explainability")}>
                See Explainability
              </button>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <section className="home-section why-section">
            <h2>Why It Matters</h2>
            <div className="why-grid">
              <div className="why-card">
                <h3>Customer Trust</h3>
                <p>
                  Stop misleading feedback and keep genuine buyers confident.
                </p>
                <button className="inline-btn" onClick={() => navigate("/about")}>
                  Protect Trust
                </button>
              </div>

              <div className="why-card">
                <h3>Seller Protection</h3>
                <p>
                  Reduce fake rating attacks and protect authentic sellers.
                </p>
                <button className="inline-btn" onClick={() => navigate("/about")}>
                  Shield Sellers
                </button>
              </div>

              <div className="why-card">
                <h3>Compliance Ready</h3>
                <p>
                  Maintain platform policies with explainable detection reports.
                </p>
                <button className="inline-btn" onClick={() => navigate("/demo")}>
                  View Reports
                </button>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </div>
    </div>
  );
}

export default Home;
