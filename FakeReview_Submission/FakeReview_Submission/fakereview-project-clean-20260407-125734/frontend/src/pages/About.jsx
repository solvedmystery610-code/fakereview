import {
  ShieldCheck,
  Brain,
  Database,
  Camera,
  Users,
  Zap
} from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";
import "./About.css";

function About() {
  const features = [
    {
      icon: <ShieldCheck size={26} />,
      title: "Fake Review Detection",
      desc: "Combines ML and NLP signals to flag suspicious reviews."
    },
    {
      icon: <Brain size={26} />,
      title: "NLP Analysis",
      desc: "Detects repetition, sentiment mismatch, and risky phrasing."
    },
    {
      icon: <Camera size={26} />,
      title: "Photo Review Checks",
      desc: "Basic image quality and exposure checks add extra signals."
    },
    {
      icon: <Database size={26} />,
      title: "Review Storage",
      desc: "Stores analysis history so past checks stay easy to review."
    },
    {
      icon: <Users size={26} />,
      title: "User Accounts",
      desc: "Keeps access simple with one secure login flow."
    },
    {
      icon: <Zap size={26} />,
      title: "Fast Output",
      desc: "Combines backend scoring with a responsive frontend workflow."
    }
  ];

  return (
    <div className="about-page">
      <div className="about-shell">
        <ScrollReveal>
          <header className="about-hero">
            <div>
              <p className="about-kicker">About The Platform</p>
              <h1>FakeReviewAI</h1>
              <p className="about-subtitle">
                A review analysis platform that detects deceptive reviews across
                ecommerce and service platforms using NLP, ML, and visual signals.
              </p>
            </div>
            <div className="about-card">
              <h3>What We Analyze</h3>
              <p>
                Text patterns, sentiment drift, rating extremes, review images,
                and platform metadata all contribute to a single authenticity
                score.
              </p>
            </div>
          </header>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <section className="about-section">
            <h2>Core Capabilities</h2>
            <div className="about-grid">
              {features.map((feature, index) => (
                <div key={index} className="about-feature">
                  <div className="feature-icon">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delay={180}>
          <section className="about-section split">
            <div>
              <h2>How It Works</h2>
              <ol>
                <li>Upload review text and optional photo.</li>
                <li>ML model scores authenticity from labeled data.</li>
                <li>NLP and image signals adjust the final result.</li>
                <li>Reports and history keep outcomes easy to review.</li>
              </ol>
            </div>
            <div className="about-card">
              <h3>Platforms Supported</h3>
              <p>
                Amazon, Flipkart, Google Reviews, Yelp, TripAdvisor, and custom
                platforms are supported through a unified detection flow.
              </p>
              <div className="tag-row">
                <span>Amazon</span>
                <span>Flipkart</span>
                <span>Google Reviews</span>
                <span>Yelp</span>
                <span>TripAdvisor</span>
                <span>Other</span>
              </div>
            </div>
          </section>
        </ScrollReveal>

        <footer className="about-footer">
          (c) {new Date().getFullYear()} FakeReviewAI
        </footer>
      </div>
    </div>
  );
}

export default About;
