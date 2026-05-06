import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ScrollReveal from "../components/ScrollReveal";
import { jsPDF } from "jspdf";
import "./Demo.css";

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
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;
    const content = [
      "FakeReviewAI Sample Report",
      "----------------------------------------",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "Sample Review Text:",
      sampleText ||
        "This is a demo sample review used to showcase report formatting and spacing.",
      "",
      "Result: Genuine",
      "Confidence: 92%",
      "",
      "Detection Reasons:",
      "- Balanced tone with specific details.",
      "- Rating aligned with sentiment.",
      ""
    ];
    const lines = doc.splitTextToSize(content.join("\n"), maxWidth);
    let y = margin;
    lines.forEach((line) => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 16;
    });
    doc.save("demo-sample-report.pdf");
  };

  return (
    <div className="demo-page">
      <div className="demo-shell">
        <ScrollReveal>
          <header className="demo-hero">
            <div>
              <p className="demo-kicker">Live Demo Walkthrough</p>
              <h1>See FakeReviewAI In Action</h1>
              <p className="demo-subtitle">
                A quick, guided demo flow that shows how text, ratings, and
                photo checks combine into a single authenticity report.
              </p>
              <div className="demo-actions">
                <button onClick={() => navigate("/analyzer")}>
                  Start Demo
                </button>
                <button
                  className="ghost"
                  onClick={() => navigate("/photo-review")}
                >
                  Photo Demo
                </button>
              </div>
            </div>
            <div className="demo-card">
              <h3>Demo Highlights</h3>
              <ul>
                <li>Input review text + rating</li>
                <li>Visual signals from photos</li>
                <li>Downloadable PDF report</li>
              </ul>
            </div>
          </header>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <section>
            <div className="demo-grid">
              <div className="demo-step">
                <span>1</span>
                <h3>Paste A Review</h3>
                <p>Try a long promotional review to see the signals fire.</p>
                <button className="blue-btn" onClick={handleTrySample}>
                  Try Sample
                </button>
              </div>
              <div className="demo-step">
                <span>2</span>
                <h3>Analyze Signals</h3>
                <p>View NLP cues, ML confidence, and authenticity score.</p>
                <button className="blue-btn" onClick={handleViewSignals}>
                  View Signals
                </button>
              </div>
              <div className="demo-step">
                <span>3</span>
                <h3>Generate Report</h3>
                <p>Download a shareable PDF with reasons and metrics.</p>
                <button className="blue-btn" onClick={handleDownloadSample}>
                  Download Sample
                </button>
              </div>
            </div>

            {sampleVisible && (
              <div className="sample-box">
                <h3>Sample Review Text</h3>
                <p>{sampleText}</p>
                <button
                  className="blue-btn"
                  onClick={() => navigate("/analyzer")}
                >
                  Open Analyzer
                </button>
              </div>
            )}
          </section>
        </ScrollReveal>

        <ScrollReveal delay={180}>
          <section className="demo-showcase">
            <div className="demo-visual">
              <svg viewBox="0 0 540 280" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="demoGrad" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="#1d4ed8" />
                    <stop offset="1" stopColor="#60a5fa" />
                  </linearGradient>
                  <linearGradient id="demoGlow" x1="1" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
                    <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                <rect width="540" height="280" rx="24" fill="url(#demoGrad)" />
                <rect x="30" y="26" width="250" height="120" rx="18" fill="url(#demoGlow)" />
                <rect x="56" y="50" width="170" height="14" rx="7" fill="#ffffff" />
                <rect x="56" y="76" width="210" height="12" rx="6" fill="#ffffffd9" />
                <rect x="56" y="102" width="160" height="12" rx="6" fill="#ffffffad" />
                <rect x="305" y="26" width="200" height="120" rx="18" fill="#ffffff2a" />
                <rect x="330" y="52" width="130" height="12" rx="6" fill="#ffffffd9" />
                <rect x="330" y="76" width="170" height="12" rx="6" fill="#ffffffad" />
                <rect x="330" y="102" width="90" height="12" rx="6" fill="#ffffff88" />
                <rect x="30" y="168" width="180" height="90" rx="16" fill="#ffffff3a" />
                <rect x="56" y="192" width="90" height="46" rx="10" fill="#ffffff77" />
                <rect x="230" y="168" width="160" height="90" rx="16" fill="#ffffff55" />
                <rect x="410" y="168" width="100" height="90" rx="16" fill="#ffffff44" />
              </svg>
            </div>
            <div className="demo-text">
              <h2>Demo Output Preview</h2>
              <p>
                A clean executive summary with authenticity score, top reasons,
                and a confidence badge. Perfect for quick moderation.
              </p>
              <button className="blue-btn" onClick={() => navigate("/analyzer")}>
                Open Analyzer
              </button>
            </div>
          </section>
        </ScrollReveal>
      </div>
    </div>
  );
}

export default Demo;
