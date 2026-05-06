import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ScrollReveal from "../components/ScrollReveal";
import { jsPDF } from "jspdf";
import "./Demo.css";

const DEMO_BG = "";

function Demo() {
  const navigate = useNavigate();
  const [sampleText, setSampleText] = useState("");
  const [sampleVisible, setSampleVisible] = useState(false);

  const handleTrySample = () => {
    setSampleVisible(true);
    setSampleText(
      "I recently purchased this product and it exceeded my expectations. The quality feels premium, delivery was fast, and it works exactly as described. Highly recommend for anyone looking for reliable performance."
    );
  };

  const handleViewSignals = () => {
    navigate("/explainability", { state: { from: "/demo" } });
  };

  const handleDownloadSample = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(31, 41, 55);
    doc.rect(0, 0, pageWidth, 60, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("FakeReviewAnalysis Tech Demo", margin, 38);
    
    doc.setTextColor(17, 24, 39);
    const content = [
      "Report Identity: Demo Instance",
      "Timestamp: " + new Date().toLocaleString(),
      "",
      "Payload:",
      sampleText || "This is a demo sample review used to showcase report formatting.",
      "",
      "Result: Authenticity Verified",
      "Confidence Level: 92%"
    ];
    let y = 100;
    content.forEach(line => {
      doc.text(line, margin, y);
      y += 20;
    });
    doc.save("tech-demo-report.pdf");
  };

  return (
    <div className="demo-page">
      {/* Background is now global in App.jsx */}
      <div className="demo-shell">
        <ScrollReveal>
          <header className="demo-hero professional-glass">
            <div>
              <p className="demo-kicker">Core System Demonstration</p>
              <h1>Live Technology Workflow</h1>
              <p className="demo-subtitle">
                Experience the computational pipeline that maps raw text datasets
                to high-fidelity integrity reports in real-time.
              </p>
              <div className="demo-actions">
                <button className="btn-primary" onClick={() => navigate("/analyzer")}>
                  Start Live Run
                </button>
              </div>
            </div>
            <div className="demo-card info-box">
              <h3>Demo Pipeline</h3>
              <ul>
                <li>TF-IDF Feature extraction</li>
                <li>Live classification latency: ~140ms</li>
                <li>Automated PDF report assembly</li>
              </ul>
            </div>
          </header>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <section className="demo-grid">
            <div className="demo-step professional-glass">
              <span>01</span>
              <h3>Payload Ingest</h3>
              <p>Initialize the workspace with a high-stakes review example.</p>
              <button className="btn-secondary" onClick={handleTrySample}>Ingest Sample</button>
            </div>
            <div className="demo-step professional-glass">
              <span>02</span>
              <h3>Signal Logic</h3>
              <p>Evaluate the hidden cues that drive our ML prediction engine.</p>
              <button className="btn-secondary" onClick={handleViewSignals}>View Logic</button>
            </div>
            <div className="demo-step professional-glass">
              <span>03</span>
              <h3>Audit Export</h3>
              <p>Package the findings into a cryptographically signed report.</p>
              <button className="btn-secondary" onClick={handleDownloadSample}>Export PDF</button>
            </div>
          </section>

          {sampleVisible && (
            <ScrollReveal>
              <div className="sample-box professional-glass">
                <h3>Ingested Workspace Content</h3>
                <p>"{sampleText}"</p>
                <button className="btn-primary" onClick={() => navigate("/analyzer")}>Open Workspace</button>
              </div>
            </ScrollReveal>
          )}
        </ScrollReveal>

        <ScrollReveal delay={180}>
          <section className="demo-showcase professional-glass">
            <div className="demo-visual">
              <svg viewBox="0 0 540 280" xmlns="http://www.w3.org/2000/svg">
                <rect width="540" height="280" rx="24" fill="#0f172a" />
                <rect x="30" y="26" width="250" height="120" rx="18" fill="#1e293b" />
                <rect x="56" y="50" width="170" height="14" rx="7" fill="#38bdf8" />
                <rect x="305" y="26" width="200" height="120" rx="18" fill="#1e293b" />
                <rect x="30" y="168" width="180" height="90" rx="16" fill="#1e293b" />
              </svg>
            </div>
            <div className="demo-text">
              <h2>Executive Output Interface</h2>
              <p>
                The resulting dashboard provides a clean, 100-point integrity score
                with prioritized highlights for moderation experts.
              </p>
              <button className="btn-primary" onClick={() => navigate("/analyzer")}>Start Exploration</button>
            </div>
          </section>
        </ScrollReveal>
      </div>
    </div>
  );
}

export default Demo;
