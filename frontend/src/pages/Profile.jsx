import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  ChartNoAxesCombined,
  History,
  LogOut,
  Mail,
  Shield,
  Sparkles,
  UserRound,
} from "lucide-react";
import { fetchJson } from "../utils/api";
import ScrollReveal from "../components/ScrollReveal";
import LogoutModal from "../components/LogoutModal";
import "./Profile.css";

const PROFILE_BG = "";

function Profile() {
  const navigate = useNavigate();
  const username = localStorage.getItem("username");
  const displayName = localStorage.getItem("displayName") || username || "Guest";
  const isAdmin = localStorage.getItem("isAdmin") === "true";

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(Boolean(username)); // eslint-disable-line no-unused-vars
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    if (!username) {
      navigate("/login");
      return;
    }

    const loadProfileStats = async () => {
      try {
        const data = await fetchJson(`/dashboard/${encodeURIComponent(username)}`);
        setStats(data);
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    loadProfileStats();
  }, [navigate, username]);

  const initials = useMemo(() => {
    return (
      displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "U"
    );
  }, [displayName]);

  const accountTiles = [
    { label: "Profile status", value: "Verified Active", icon: BadgeCheck },
    {
      label: "Security Role",
      value: isAdmin ? "System Administrator" : "Risk Analyst",
      icon: Shield,
    },
    { label: "Identity Node", value: username, icon: Mail },
  ];

  const summaryTiles = [
    { label: "Volume", value: stats?.total_reviews ?? 0, accent: "#38bdf8" },
    { label: "Risk Flag", value: stats?.fake_reviews ?? 0, accent: "#f87171" },
    { label: "Clean", value: stats?.genuine_reviews ?? 0, accent: "#4ade80" },
    { label: "Trust Score", value: `${stats?.genuine_ratio ?? stats?.accuracy ?? 0}%`, accent: "#a78bfa" },
  ];

  const quickLinks = [
    { label: "Singular Lab", note: "Direct analysis interface", icon: Sparkles, action: () => navigate("/analyzer") },
    { label: "Visual Grid", note: "Review chart engine", icon: ChartNoAxesCombined, action: () => navigate("/dashboard") },
    { label: "Audit Log", note: "Complete history stream", icon: History, action: () => navigate("/history") },
  ];

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="profile-page">
      {/* Background is now global in App.jsx */}
      <div className="profile-shell">
        <ScrollReveal>
          <header className="profile-hero professional-glass">
            <div className="hero-profile-info">
              <div className="profile-avatar-large">{initials}</div>
              <div>
                <div className="kicker">Analyst Identity Center</div>
                <h1>{displayName}</h1>
                <p>Global oversight of your processed datasets and platform access parameters.</p>
              </div>
            </div>
            <div className="hero-meta-actions">
              <button className="logout-btn-large" onClick={() => setShowLogoutModal(true)}>
                <LogOut size={18} />
                <span>Terminate Session</span>
              </button>
            </div>
          </header>
        </ScrollReveal>

        <div className="profile-grid">
          <ScrollReveal delay={100}>
            <section className="account-details-panel professional-glass">
              <h3>Identity Parameters</h3>
              {accountTiles.map((item, idx) => (
                <div key={idx} className="info-item">
                  <div className="info-item-icon"><item.icon size={20} /></div>
                  <div className="info-content">
                    <label>{item.label}</label>
                    <span>{item.value}</span>
                  </div>
                </div>
              ))}
            </section>
          </ScrollReveal>

          <section className="main-profile-content">
            <ScrollReveal delay={200}>
              <div className="stats-header">
                <h3>Workspace Activity Snapshot</h3>
                <span className="live-tag">Live Feed</span>
              </div>
              <div className="stats-summary-grid">
                {summaryTiles.map((tile, idx) => (
                  <div key={idx} className="profile-stat-box professional-glass">
                    <div className="stat-info">
                      <div className="stat-box-label">{tile.label}</div>
                      <div className="stat-box-value" style={{ color: tile.accent }}>{tile.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <div className="quick-shortcuts">
                {quickLinks.map((link, idx) => (
                  <div key={idx} className="shortcut-btn professional-glass" onClick={link.action}>
                    <div className="shortcut-icon"><link.icon size={24} /></div>
                    <h4>{link.label}</h4>
                    <p>{link.note}</p>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </section>
        </div>
      </div>
      <LogoutModal 
        isOpen={showLogoutModal} 
        onClose={() => setShowLogoutModal(false)} 
        onConfirm={handleLogout} 
      />
    </div>
  );
}

export default Profile;
