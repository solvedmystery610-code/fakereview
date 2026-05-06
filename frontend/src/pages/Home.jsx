import { useNavigate } from "react-router-dom";
import { 
  ShieldCheck, 
  Zap, 
  Brain, 
  Layers, 
  BarChart3, 
  Globe 
} from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";
import "./Home.css";

function Home() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Brain size={28} />,
      title: "Neural Analysis",
      desc: "Deep semantic inspection using customized TF-IDF and Logistic Regression engines."
    },
    {
      icon: <ShieldCheck size={28} />,
      title: "Authenticity Guard",
      desc: "Instant verification of hotel and product reviews with real-world context checks."
    },
    {
      icon: <Zap size={28} />,
      title: "High Velocity",
      desc: "Process thousands of reviews in seconds with our optimized enterprise batch pipeline."
    },
    {
      icon: <Layers size={28} />,
      title: "Smart Deduplication",
      desc: "Detect exact and near-duplicate review patterns to uncover bot-driven campaigns."
    },
    {
      icon: <BarChart3 size={28} />,
      title: "Deep Insights",
      desc: "Interactive dashboards that visualize sentiment trends and risk distributions."
    },
    {
      icon: <Globe size={28} />,
      title: "Universal Support",
      desc: "Agnostic architecture that works across Amazon, Flipkart, Google, and Yelp."
    }
  ];

  const steps = [
    { num: "01", title: "Ingest Data", desc: "Paste text or upload CSV files." },
    { num: "02", title: "Extract Features", desc: "AI identifies linguistic patterns." },
    { num: "03", title: "Classify", desc: "ML models assign risk scores." },
    { num: "04", title: "Deliver Report", desc: "Get professional audit summaries." }
  ];

  return (
    <div className="home-page">
      {/* Background is now global in App.jsx */}
      
      <div className="home-shell">
        <ScrollReveal>
          <header className="home-hero">
            <div className="hero-content">
              <span className="hero-badge">AI-Powered Review Intelligence</span>
              <h1>Fake Review Analysis: <br /> Advanced ML-NLP Deception detection</h1>
              <p className="hero-description">
                Our ML engine detects fake reviews with surgical precision, 
                helping brands and customers maintain digital trust across any global platform.
              </p>
              <div className="home-actions">
                <button
                  className="home-primary-btn"
                  onClick={() => navigate("/analyzer")}
                >
                  Launch Analyzer
                </button>
                <button
                  className="home-secondary-btn"
                  onClick={() => navigate("/batch-analyzer")}
                >
                  Enterprise Stream
                </button>
              </div>
            </div>

            <div className="hero-visual">
              <div className="glass-stat-card">
                <div className="stat-value">98.4%</div>
                <div className="stat-label">Model Accuracy</div>
              </div>
              <div className="glass-stat-card">
                <div className="stat-value">84.2%</div>
                <div className="stat-label">Authenticity Pulse</div>
              </div>
              <div className="glass-stat-card">
                <div className="stat-value">92%</div>
                <div className="stat-label">Engine Confidence</div>
              </div>
              <div className="glass-stat-card">
                <div className="stat-value">~1.2s</div>
                <div className="stat-label">Processing Latency</div>
              </div>
            </div>
          </header>
        </ScrollReveal>

        <section className="home-section-title">
          <ScrollReveal delay={100}>
            <h2>Powerful Core Capabilities</h2>
            <p>Advanced heuristics and neural networks working in harmony.</p>
          </ScrollReveal>
        </section>

        <div className="features-grid">
          {features.map((f, i) => (
            <ScrollReveal key={i} delay={100 + i * 50}>
              <div className="feature-rich-card">
                <div className="feature-icon-box">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <section className="home-process-section">
          <div className="home-section-title">
            <ScrollReveal>
              <h2>The Analysis Pipeline</h2>
              <p>How we transform raw text into actionable intelligence.</p>
            </ScrollReveal>
          </div>
          <div className="process-grid">
            {steps.map((s, i) => (
              <ScrollReveal key={i} delay={200 + i * 50}>
                <div className="process-step">
                  <div className="step-number">{s.num}</div>
                  <h4>{s.title}</h4>
                  <p>{s.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <footer className="home-footer-minimal">
          <p className="copyright-text">© 2026 Fake Review Analysis System. Professional Governance Operations.</p>
          <div className="footer-links-highlight">
            <button className="footer-nav-btn" onClick={() => navigate("/about")}>Ethics & Audit</button>
            <button className="footer-nav-btn" onClick={() => navigate("/demo")}>Technology Stack</button>
            <button className="footer-nav-btn" onClick={() => navigate("/history")}>System Logs</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Home;
