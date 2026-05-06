import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson, fireAndForgetJson } from "../utils/api";
import ScrollReveal from "../components/ScrollReveal";
import { jsPDF } from "jspdf";
import "./History.css";

const HISTORY_BG = "";

function History() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }
    const loadHistory = async () => {
      try {
        const data = await fetchJson(`/history/${encodeURIComponent(username)}`);
        setReviews(data);
      } catch (err) {
        setError(err.message || "Failed to load review history");
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [username]);

  const downloadReport = (item) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 60, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("times", "bold"); doc.setFontSize(16);
    doc.text("FakeReviewAnalysis Report", margin, 38);
    
    doc.setTextColor(17, 24, 39);
    doc.setFont("times", "normal"); doc.setFontSize(12);
    
    const lines = [
      `Date: ${new Date().toLocaleString()}`,
      `Identity: ${username}`,
      `Platform: ${item.platform || "Direct Ingest"}`,
      `Result: ${item.result}`,
      `Confidence: ${item.confidence}%`,
      "",
      "Review Content:",
      item.review,
      "",
      "Detection Highlights:",
      ...(item.reasons || ["No specific highlights returned."])
    ];

    let y = 100;
    lines.forEach(line => {
      const split = doc.splitTextToSize(line, pageWidth - margin * 2);
      split.forEach(s => {
        if (y > pageHeight - margin) { doc.addPage(); y = margin; }
        doc.text(s, margin, y);
        y += 18;
      });
    });

    const fileName = `report-${Date.now()}.pdf`;
    doc.save(fileName);
    fireAndForgetJson("/track/download", { username, file_name: fileName, file_type: "PDF", source: "history" });
  };

  if (!username) {
    return (
      <div className="history-page">
        {/* Background is now global in App.jsx */}
        <div className="history-shell">
          <div className="professional-glass" style={{padding: '80px 40px', textAlign: 'center', marginTop: '140px', maxWidth: '600px', margin: '140px auto 0'}}>
            <h2 style={{color: 'white', fontSize: '32px', marginBottom: '16px'}}>Enterprise Audit Access</h2>
            <p style={{color: 'rgba(255,255,255,0.7)', fontSize: '18px', marginBottom: '32px'}}>Please authenticate to unlock your encrypted review history and historical sentiment logs.</p>
            <button className="btn-primary" onClick={() => navigate("/login")} style={{padding: '16px 32px', borderRadius: '12px', background: 'var(--primary)', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer', boxShadow: '0 20px 40px rgba(37, 99, 235, 0.3)'}}>Initialize Authentication</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="history-page">
      {/* Background is now global in App.jsx */}
      <div className="history-shell">
        <ScrollReveal>
          <header className="history-hero">
            <h1>Audit Logs</h1>
            <p>A complete chronological record of your analyzed review datasets.</p>
          </header>
        </ScrollReveal>

        {loading ? (
          <div className="loading-state"><h2>Accessing logs...</h2></div>
        ) : error ? (
          <div className="error-state"><h2>{error}</h2></div>
        ) : reviews.length === 0 ? (
          <div className="professional-glass info-card" style={{padding: '40px', textAlign: 'center'}}>
            <h3>Empty Repository</h3>
            <p>You haven't analyzed any reviews yet. Your history will appear here once you process data.</p>
            <button className="btn-primary" onClick={() => navigate("/analyzer")} style={{marginTop: '20px'}}>Open Workspace</button>
          </div>
        ) : (
          <div className="history-list">
            {reviews.map((item, index) => (
              <ScrollReveal key={index} delay={index * 50}>
                <div className={`history-card professional-glass ${item.result === "Fake" ? "fake" : "genuine"}`}>
                  <p className="review-text">"{item.review}"</p>
                  
                  <div className="history-meta">
                    <span className={`result-badge ${item.result === "Fake" ? "fake" : "genuine"}`}>{item.result}</span>
                    <span>Confidence: <strong>{item.confidence}%</strong></span>
                    <span>Platform: <strong>{item.platform || "Generic"}</strong></span>
                    <span>Sentiment: <strong>{item.sentiment}</strong></span>
                  </div>

                  <div className="confidence-bar-wrap">
                    <div 
                      className={`confidence-bar ${item.result === "Fake" ? "fake" : "genuine"}`} 
                      style={{ width: `${item.confidence}%` }} 
                    />
                  </div>

                  {item.reasons && item.reasons.length > 0 && (
                    <ul className="reason-list">
                      {item.reasons.map((r, i) => (
                        <li key={i} className="reason-item">• {r}</li>
                      ))}
                    </ul>
                  )}

                  <footer className="history-footer">
                    <span className="timestamp">Processed on {item.timestamp}</span>
                    <button className="btn-primary" onClick={() => downloadReport(item)}>Export PDF</button>
                  </footer>
                </div>
              </ScrollReveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default History;
