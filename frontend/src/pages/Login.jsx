import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../utils/api";
import ScrollReveal from "../components/ScrollReveal";

const LOGIN_BG = "";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_SCRIPT_ID = "google-identity-services";
const PENDING_AUTH_EMAIL_KEY = "pendingAuthEmail";
const PENDING_AUTH_MODE_KEY = "pendingAuthMode";

const Login = () => {
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // eslint-disable-line no-unused-vars
  const [remember, setRemember] = useState(false);
  const [strength, setStrength] = useState(""); // eslint-disable-line no-unused-vars
  const [attempts, setAttempts] = useState(0);
  const [authView, setAuthView] = useState("login");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notifyInfo, setNotifyInfo] = useState(""); // eslint-disable-line no-unused-vars
  const [googleReady, setGoogleReady] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false); // eslint-disable-line no-unused-vars
  const [otpBusy, setOtpBusy] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("rememberUser");
    if (savedUser) {
      setEmail(savedUser);
      setRemember(true);
    }
  }, []);

  useEffect(() => {
    if (password.length === 0) {
      setStrength("");
      return;
    }
    if (password.length < 6) setStrength("Weak");
    else if (password.length < 10) setStrength("Medium");
    else setStrength("Strong");
  }, [password]);

  useEffect(() => {
    setOtp("");
    setOtpSent(false);
    localStorage.removeItem(PENDING_AUTH_EMAIL_KEY);
    localStorage.removeItem(PENDING_AUTH_MODE_KEY);
  }, [email, password, authView]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existingScript) {
      if (window.google?.accounts?.id) setGoogleReady(true);
      else existingScript.addEventListener("load", () => setGoogleReady(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true; script.defer = true;
    script.onload = () => setGoogleReady(true);
    script.onerror = () => setNotifyInfo("Google sign-in script could not be loaded.");
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!googleReady || !GOOGLE_CLIENT_ID || !googleButtonRef.current) return;
    if (!window.google?.accounts?.id) return;

    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => { await handleGoogleCredential(response?.credential); },
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline", size: "large",
      text: authView === "signup" ? "signup_with" : "continue_with",
      shape: "pill", width: 384,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authView, googleReady]);

  const validateEmail = (value) => /\S+@\S+\.\S+/.test(value);

  const finishLogin = (result, fallbackEmail = email) => {
    const username = result?.username || fallbackEmail;
    if (remember) localStorage.setItem("rememberUser", username);
    localStorage.setItem("username", username);
    localStorage.setItem("displayName", result?.display_name || displayName || username);
    localStorage.setItem("isAdmin", result?.is_admin ? "true" : "false");
    localStorage.removeItem("pendingVerifyEmail");
    localStorage.removeItem(PENDING_AUTH_EMAIL_KEY);
    localStorage.removeItem(PENDING_AUTH_MODE_KEY);
    setOtp(""); setOtpSent(false);
    navigate(result?.is_admin ? "/admin" : "/analyzer");
  };

  const handleGoogleCredential = async (credential) => {
    if (!credential) { setError("Google login response was empty."); return; }
    setLoading(true); setError(""); setMessage(""); setNotifyInfo("");
    try {
      const result = await fetchJson("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential }),
      });
      finishLogin(result, result?.username);
    } catch (err) { setError(err.message || "Google login failed."); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(""); setMessage(""); setNotifyInfo("");
    if (!validateEmail(email)) { setError("Please enter a valid real email."); return; }
    if (!password) { setError("Password required"); return; }
    if (attempts >= 5) { setError("Too many login attempts"); return; }

    if (authView === "signup") {
      if (!displayName.trim()) { setError("Username required"); return; }
      if (password.length < 6) { setError("Password too short"); return; }
      if (password !== confirmPassword) { setError("Passwords do not match"); return; }
      if (!otp.trim()) { setError("Enter the OTP."); return; }

      try {
        setLoading(true);
        await fetchJson("/register", {
          method: "POST",
          body: JSON.stringify({ username: email, password, display_name: displayName, otp: otp.trim() }),
        });
        setMessage("Signup successful. Please login.");
        setAuthView("login"); setPassword(""); setConfirmPassword(""); setOtp(""); setOtpSent(false);
      } catch (err) { setError(err.message || "Signup failed"); }
      finally { setLoading(false); }
      return;
    }

    if (!otp.trim()) { setError("Enter the OTP sent to your email."); return; }
    setLoading(true);
    try {
      const result = await fetchJson("/login", {
        method: "POST",
        body: JSON.stringify({ username: email, password, otp: otp.trim() }),
      });
      finishLogin(result, email);
    } catch (err) {
      setError(err.message || "Login failed");
      setAttempts(c => c + 1);
    } finally { setLoading(false); }
  };

  const sendOtp = async () => {
    setError(""); setMessage(""); setNotifyInfo("");
    if (!validateEmail(email)) { setError("Enter a valid email."); return; }
    if (!password) { setError("Password required"); return; }
    if (authView === "signup") {
      if (!displayName.trim() || password.length < 6 || password !== confirmPassword) {
        setError("Please complete all signup fields correctly first."); return;
      }
    }
    setOtpBusy(true);
    try {
      const path = authView === "signup" ? "/register/request-otp" : "/login/request-otp";
      const result = await fetchJson(path, {
        method: "POST",
        body: JSON.stringify({ username: email, email, password, display_name: displayName }),
      });
      setOtpSent(true);
      const msg = result?.message || (result?.otp_sent ? "OTP sent to your email." : "OTP generation failed.");
      setMessage(msg);
      if (result?.email_sent === false) {
        setNotifyInfo("Email delivery failed. Check your server terminal/logs for the OTP code.");
      }
      localStorage.setItem(PENDING_AUTH_EMAIL_KEY, email.trim().toLowerCase());
    } catch (err) { setError(err.message || "Could not send OTP."); }
    finally { setOtpBusy(false); }
  };

  return (
    <div className="login-page">
      {/* Background is now global in App.jsx */}
      <div style={styles.layout}>
        <ScrollReveal>
          <div style={styles.card}>
            <div style={styles.sectionTitle}>
              {authView === "signup" ? "Create Account" : "Login"}
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {message && <div style={styles.success}>{message}</div>}

            <form onSubmit={handleSubmit} autoComplete="off">
              <div style={styles.inputGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  autoComplete="new-password"
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                />
              </div>

              {authView === "signup" && (
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Username</label>
                  <input
                    type="text"
                    placeholder="e.g. analyst_01"
                    value={displayName}
                    autoComplete="off"
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={styles.input}
                  />
                </div>
              )}

              <div style={styles.inputGroup}>
                <label style={styles.label}>Access Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Identity OTP</label>
                <div style={styles.otpRow}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                    style={styles.otpInput}
                  />
                  <button type="button" style={styles.sendOtpBtn} onClick={sendOtp} disabled={otpBusy}>
                    {otpBusy ? "Sending..." : "Send OTP"}
                  </button>
                </div>
              </div>

              {authView === "signup" && (
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Repeat Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    autoComplete="new-password"
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={styles.input}
                  />
                </div>
              )}

              <button style={styles.loginBtn} disabled={loading}>
                {loading ? "Authenticating..." : (authView === "signup" ? "Register" : "Login")}
              </button>

              <div style={styles.dividerRow}>
                <span style={styles.dividerLine} />
                <span style={styles.dividerText}>Social Login</span>
                <span style={styles.dividerLine} />
              </div>

              <div style={styles.googleSlot} ref={googleButtonRef} />

              <div style={styles.switchRow}>
                {authView === "login" ? (
                  <>
                    <span>No account?</span>
                    <button type="button" onClick={() => setAuthView("signup")} style={styles.switchLink}>Sign Up</button>
                  </>
                ) : (
                  <>
                    <span>Active Analyst?</span>
                    <button type="button" onClick={() => setAuthView("login")} style={styles.switchLink}>Login Instead</button>
                  </>
                )}
              </div>
            </form>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
};

const styles = {
  layout: { 
    width: "100%", 
    maxWidth: "460px", 
    position: "relative", 
    zIndex: 2,
    margin: "140px auto 0" /* Center in main content */
  },
  card: {
    background: "rgba(255, 255, 255, 0.1)", backdropFilter: "blur(40px)",
    border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: "32px",
    padding: "40px", boxShadow: "0 40px 100px rgba(0,0,0,0.3)"
  },
  sectionTitle: {
    textAlign: "center", fontSize: "28px", fontWeight: "800",
    color: "white", marginBottom: "32px", letterSpacing: "-0.5px"
  },
  inputGroup: { marginBottom: "20px" },
  label: { display: "block", color: "rgba(255,255,255,0.8)", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" },
  input: {
    width: "100%", padding: "14px", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.2)", borderRadius: "14px",
    color: "white", outline: "none"
  },
  otpRow: { display: "flex", gap: "10px" },
  otpInput: {
    flex: 1, padding: "14px", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.2)", borderRadius: "14px",
    color: "white", outline: "none", textAlign: "center", fontSize: "18px", letterSpacing: "4px"
  },
  loginBtn: {
    width: "100%", padding: "16px", background: "#2563eb", border: "none",
    borderRadius: "14px", color: "white", fontWeight: "800", fontSize: "16px",
    cursor: "pointer", marginTop: "10px", boxShadow: "0 20px 40px rgba(37, 99, 235, 0.3)"
  },
  sendOtpBtn: {
    padding: "0 20px", background: "white", border: "none", borderRadius: "14px",
    color: "#0f172a", fontWeight: "700", cursor: "pointer"
  },
  dividerRow: { display: "flex", alignItems: "center", gap: "15px", margin: "30px 0" },
  dividerLine: { flex: 1, height: "1px", background: "rgba(255,255,255,0.2)" },
  dividerText: { color: "rgba(255,255,255,0.5)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px" },
  googleSlot: { display: "flex", justifyContent: "center" },
  switchRow: { marginTop: "24px", textAlign: "center", color: "white", fontSize: "14px" },
  switchLink: { background: "none", border: "none", color: "#38bdf8", fontWeight: "700", cursor: "pointer", marginLeft: "8px" },
  error: { background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", padding: "12px", borderRadius: "12px", marginBottom: "20px", fontSize: "14px", textAlign: "center", border: "1px solid rgba(239, 68, 68, 0.4)" },
  success: { background: "rgba(34, 197, 94, 0.2)", color: "#86efac", padding: "12px", borderRadius: "12px", marginBottom: "20px", fontSize: "14px", textAlign: "center", border: "1px solid rgba(34, 197, 94, 0.4)" }
};

export default Login;
