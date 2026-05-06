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

function Profile() {
  const navigate = useNavigate();
  const username = localStorage.getItem("username");
  const displayName = localStorage.getItem("displayName") || username || "Guest";
  const isAdmin = localStorage.getItem("isAdmin") === "true";

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(Boolean(username));

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
    { label: "Profile status", value: "Active", icon: BadgeCheck },
    {
      label: "Access level",
      value: isAdmin ? "Administrator" : "Standard user",
      icon: Shield,
    },
    { label: "Primary email", value: username, icon: Mail },
  ];

  const summaryTiles = [
    { label: "Total reviews", value: stats?.total_reviews ?? 0, accent: "#0f766e" },
    { label: "Fake detected", value: stats?.fake_reviews ?? 0, accent: "#dc2626" },
    { label: "Genuine found", value: stats?.genuine_reviews ?? 0, accent: "#2563eb" },
    {
      label: "Trust score",
      value: `${stats?.genuine_ratio ?? stats?.accuracy ?? 0}%`,
      accent: "#7c3aed",
    },
  ];

  const quickLinks = [
    {
      label: "Open Analyzer",
      note: "Start a new review check",
      icon: Sparkles,
      action: () => navigate("/analyzer"),
    },
    {
      label: "View Dashboard",
      note: "See charts and detection trends",
      icon: ChartNoAxesCombined,
      action: () => navigate("/dashboard"),
    },
    {
      label: "Review History",
      note: "Inspect your recent activity",
      icon: History,
      action: () => navigate("/history"),
    },
  ];

  const logout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("displayName");
    localStorage.removeItem("isAdmin");
    navigate("/login");
  };

  return (
    <div style={styles.page}>
      <div style={styles.heroGlow} />

      <div style={styles.wrapper}>
        <section style={styles.heroCard}>
          <div style={styles.heroLeft}>
            <div style={styles.avatar}>{initials}</div>
            <div>
              <div style={styles.kicker}>Profile Center</div>
              <h1 style={styles.title}>{displayName}</h1>
              <p style={styles.subtitle}>
                Manage your account access, review activity, and workspace shortcuts
                from one professional control panel.
              </p>
            </div>
          </div>

          <div style={styles.heroMeta}>
            <div style={styles.metaBadge}>
              <UserRound size={16} />
              <span>{isAdmin ? "Admin account" : "Verified member"}</span>
            </div>
            <button style={styles.logoutButton} onClick={logout}>
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </section>

        <div style={styles.mainGrid}>
          <section style={styles.sidePanel}>
            <div style={styles.panelTitle}>Account Information</div>
            {accountTiles.map(({ label, value, icon: Icon }) => (
              <div key={label} style={styles.infoRow}>
                <div style={styles.infoIcon}>
                  <Icon size={18} />
                </div>
                <div>
                  <div style={styles.infoLabel}>{label}</div>
                  <div style={styles.infoValue}>{value}</div>
                </div>
              </div>
            ))}
          </section>

          <section style={styles.contentPanel}>
            <div style={styles.panelHeader}>
              <div>
                <div style={styles.panelTitle}>Activity Snapshot</div>
                <p style={styles.panelText}>
                  Live overview of your review-detection workspace.
                </p>
              </div>
              <div style={styles.statusPill}>
                {loading ? "Syncing..." : "Live profile"}
              </div>
            </div>

            <div style={styles.summaryGrid}>
              {summaryTiles.map((tile) => (
                <div key={tile.label} style={styles.summaryCard}>
                  <div style={{ ...styles.summaryBar, background: tile.accent }} />
                  <div style={styles.summaryLabel}>{tile.label}</div>
                  <div style={{ ...styles.summaryValue, color: tile.accent }}>
                    {tile.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.quickSection}>
              <div style={styles.panelTitle}>Quick Access</div>
              <div style={styles.quickGrid}>
                {quickLinks.map(({ label, note, icon: Icon, action }) => (
                  <button key={label} style={styles.quickCard} onClick={action}>
                    <div style={styles.quickIcon}>
                      <Icon size={18} />
                    </div>
                    <div style={styles.quickLabel}>{label}</div>
                    <div style={styles.quickNote}>{note}</div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "36px 20px 60px",
    background:
      "radial-gradient(circle at top left, rgba(45,212,191,0.18), transparent 28%), linear-gradient(180deg, #eefbf9 0%, #f5f7fb 48%, #fcfcfd 100%)",
    position: "relative",
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    width: "420px",
    height: "420px",
    borderRadius: "999px",
    background: "rgba(45,212,191,0.16)",
    filter: "blur(60px)",
    top: "-120px",
    right: "-80px",
    pointerEvents: "none",
  },
  wrapper: {
    maxWidth: "1180px",
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },
  heroCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "24px",
    flexWrap: "wrap",
    background: "rgba(9, 30, 66, 0.94)",
    color: "#f8fafc",
    padding: "28px",
    borderRadius: "28px",
    boxShadow: "0 32px 70px rgba(15, 23, 42, 0.18)",
  },
  heroLeft: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
  },
  avatar: {
    width: "86px",
    height: "86px",
    borderRadius: "26px",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg,#2dd4bf,#0f766e)",
    fontSize: "30px",
    fontWeight: "800",
    letterSpacing: "0.06em",
    boxShadow: "0 18px 35px rgba(45,212,191,0.24)",
  },
  kicker: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: "#99f6e4",
    marginBottom: "8px",
  },
  title: {
    margin: 0,
    fontSize: "36px",
    lineHeight: 1,
  },
  subtitle: {
    marginTop: "12px",
    maxWidth: "620px",
    color: "rgba(226,232,240,0.88)",
    fontSize: "15px",
    lineHeight: 1.7,
  },
  heroMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    alignItems: "flex-end",
    flex: "1 1 220px",
  },
  metaBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#d1fae5",
    fontWeight: "600",
  },
  logoutButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 18px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(135deg,#ef4444,#b91c1c)",
    color: "#ffffff",
    fontWeight: "700",
    boxShadow: "0 18px 30px rgba(185,28,28,0.28)",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "24px",
    marginTop: "26px",
  },
  sidePanel: {
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 22px 45px rgba(15,23,42,0.08)",
    backdropFilter: "blur(10px)",
  },
  contentPanel: {
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 22px 45px rgba(15,23,42,0.08)",
    backdropFilter: "blur(10px)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    flexWrap: "wrap",
  },
  panelTitle: {
    fontSize: "18px",
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: "18px",
  },
  panelText: {
    margin: 0,
    color: "#475569",
    fontSize: "14px",
  },
  statusPill: {
    padding: "10px 14px",
    borderRadius: "999px",
    background: "#ecfeff",
    color: "#155e75",
    fontWeight: "700",
    fontSize: "13px",
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "16px 0",
    borderBottom: "1px solid rgba(148,163,184,0.16)",
  },
  infoIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "#ecfeff",
    color: "#0f766e",
  },
  infoLabel: {
    color: "#64748b",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "4px",
  },
  infoValue: {
    color: "#0f172a",
    fontWeight: "700",
    wordBreak: "break-word",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginTop: "22px",
  },
  summaryCard: {
    background: "linear-gradient(180deg,#ffffff,#f8fafc)",
    borderRadius: "20px",
    padding: "20px",
    border: "1px solid rgba(148,163,184,0.16)",
    boxShadow: "0 14px 28px rgba(15,23,42,0.06)",
    textAlign: "left",
  },
  summaryBar: {
    width: "56px",
    height: "5px",
    borderRadius: "999px",
    marginBottom: "18px",
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: "13px",
    marginBottom: "10px",
  },
  summaryValue: {
    fontSize: "32px",
    fontWeight: "800",
  },
  quickSection: {
    marginTop: "30px",
  },
  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
  },
  quickCard: {
    textAlign: "left",
    padding: "20px",
    borderRadius: "20px",
    background: "linear-gradient(180deg,#f8fafc,#eef2ff)",
    color: "#0f172a",
    border: "1px solid rgba(148,163,184,0.16)",
    minHeight: "150px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: "12px",
  },
  quickIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "#ffffff",
    color: "#2563eb",
    boxShadow: "0 10px 24px rgba(37,99,235,0.12)",
  },
  quickLabel: {
    fontWeight: "800",
    fontSize: "16px",
  },
  quickNote: {
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.6,
  },
};

export default Profile;
