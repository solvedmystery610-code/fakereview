import {
  ShieldCheck,
  Brain,
  Database,
  Users,
  Zap
} from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";
import "./About.css";

const ABOUT_BG = "";

function About() {
  const features = [
    {
      icon: <ShieldCheck size={26} />,
      title: "Integrity Detection",
      desc: "Combines advanced ML heuristics and NLP signals to flag suspicious high-risk reviews."
    },
    {
      icon: <Brain size={26} />,
      title: "Syntactic Heuristics",
      desc: "Detects repetitive syntax, sentiment drift, and unnatural phrasing patterns."
    },
    {
      icon: <Database size={26} />,
      title: "Secure Audit Logs",
      desc: "Persistent analysis history allows for long-term monitoring and reporting."
    },
    {
      icon: <Users size={26} />,
      title: "Identity Governance",
      desc: "Role-based access controls ensure secure dataset management for enterprise teams."
    },
    {
      icon: <Zap size={26} />,
      title: "Reactive Logic",
      desc: "High-performance backend scoring with instantaneous frontend reporting."
    }
  ];

  return (
    <div className="about-page">
      {/* Background is now global in App.jsx */}
      <div className="about-shell">
        <ScrollReveal>
          <header className="about-hero professional-glass">
            <div>
              <p className="about-kicker">Core System Architecture</p>
              <h1>The Intelligence Layer</h1>
              <p className="about-subtitle">
                A sophisticated review analysis infrastructure that leverages neural NLP models
                to identify deceptive signals across global e-commerce ecosystems.
              </p>
            </div>
            <div className="about-card info-box">
              <h3>Proprietary Synthesis</h3>
              <p>
                Textual semantics, sentiment variance, and rating distribution
                are synthesized into a singular 100-point integrity score.
              </p>
            </div>
          </header>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <section className="about-section">
            <h2>System Capabilities</h2>
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
            <div className="professional-glass" style={{padding: '40px', borderRadius: '32px'}}>
              <h2 style={{textAlign: 'left'}}>Heuristic Lifecycle</h2>
              <ol>
                <li>Ingest textual review datasets.</li>
                <li>Compute feature vectors via ML classification.</li>
                <li>Apply sentiment and syntactic drift adjustments.</li>
                <li>Generate comprehensive audit logs and PDF reports.</li>
              </ol>
            </div>
            <div className="about-card professional-glass" style={{padding: '40px', borderRadius: '32px'}}>
              <h3>Platform Ecosystem</h3>
              <p>
                Seamlessly monitors Amazon, Flipkart, Google Reviews, and proprietary
                internal databases through a unified API gateway.
              </p>
              <div className="tag-row">
                <span>E-Shop Connect</span>
                <span>Global Nodes</span>
                <span>Audit Ready</span>
                <span>ML Pipeline</span>
              </div>
            </div>
          </section>
        </ScrollReveal>

        <footer className="about-footer">
          © {new Date().getFullYear()} Fake Review Analysis System Operations
        </footer>
      </div>
    </div>
  );
}

export default About;
