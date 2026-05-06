import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../utils/api";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_SCRIPT_ID = "google-identity-services";

const Login = () => {
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [strength, setStrength] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [authView, setAuthView] = useState("login");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notifyInfo, setNotifyInfo] = useState("");
  const [googleReady, setGoogleReady] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
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

    if (password.length < 6) {
      setStrength("Weak");
    } else if (password.length < 10) {
      setStrength("Medium");
    } else {
      setStrength("Strong");
    }
  }, [password]);

  useEffect(() => {
    setOtp("");
    setOtpSent(false);
  }, [email, password, authView]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      return;
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existingScript) {
      if (window.google?.accounts?.id) {
        setGoogleReady(true);
      } else {
        existingScript.addEventListener("load", () => setGoogleReady(true), {
          once: true,
        });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    script.onerror = () =>
      setNotifyInfo("Google sign-in script could not be loaded right now.");
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!googleReady || !GOOGLE_CLIENT_ID || !googleButtonRef.current) {
      return;
    }

    if (!window.google?.accounts?.id) {
      return;
    }

    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        await handleGoogleCredential(response?.credential);
      },
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      text: authView === "signup" ? "signup_with" : "continue_with",
      shape: "pill",
      width: 384,
    });
  }, [authView, googleReady]);

  const validateEmail = (value) => /\S+@\S+\.\S+/.test(value);

  const finishLogin = (result, fallbackEmail = email) => {
    const username = result?.username || fallbackEmail;
    if (remember) {
      localStorage.setItem("rememberUser", username);
    }

    localStorage.setItem("username", username);
    localStorage.setItem(
      "displayName",
      result?.display_name || displayName || username
    );
    localStorage.setItem("isAdmin", result?.is_admin ? "true" : "false");
    localStorage.removeItem("pendingVerifyEmail");
    setOtp("");
    setOtpSent(false);

    if (result?.login_notification_sent === false) {
      setNotifyInfo(
        result?.login_notification_warning ||
          "Logged in, but the login notification email could not be sent."
      );
    } else if (result?.login_notification_sent) {
      setNotifyInfo("Login alert email sent successfully.");
    }

    setMessage(result?.message || "Login successful.");
    navigate(result?.is_admin ? "/admin" : "/analyzer");
  };

  const handleGoogleCredential = async (credential) => {
    if (!credential) {
      setError("Google login response was empty. Please try again.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setNotifyInfo("");

    try {
      const result = await fetchJson("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential }),
      });
      finishLogin(result, result?.username);
    } catch (loginError) {
      setError(loginError.message || "Google login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");
    setNotifyInfo("");

    if (!validateEmail(email)) {
      setError("Please enter a valid real email address.");
      return;
    }

    if (!password) {
      setError("Password required");
      return;
    }

    if (attempts >= 5) {
      setError("Too many login attempts");
      return;
    }

    if (authView === "signup") {
      if (!displayName.trim()) {
        setError("Username required");
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      if (!otp.trim()) {
        setError("Enter the OTP sent to your email.");
        return;
      }

      try {
        setLoading(true);
        const result = await fetchJson("/register", {
          method: "POST",
          body: JSON.stringify({
            username: email,
            password,
            display_name: displayName,
            otp: otp.trim(),
          }),
        });

        setMessage("Signup successful. Please login.");
        setAuthView("login");
        setPassword("");
        setConfirmPassword("");
        setOtp("");
        setOtpSent(false);
      } catch (signupError) {
        setError(signupError.message || "Signup failed");
      } finally {
        setLoading(false);
      }

      return;
    }

    if (!otp.trim()) {
      setError("Enter the OTP sent to your email.");
      return;
    }

    setLoading(true);
    try {
      const result = await fetchJson("/login", {
        method: "POST",
        body: JSON.stringify({
          username: email,
          password,
          otp: otp.trim(),
        }),
      });
      finishLogin(result, email);
    } catch (loginError) {
      setError(loginError.message || "Login failed");
      setAttempts((current) => current + 1);
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    setError("");
    setMessage("");
    setNotifyInfo("");

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Password required");
      return;
    }

    if (authView === "signup") {
      if (!displayName.trim()) {
        setError("Username required");
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setOtpBusy(true);
    try {
      const path =
        authView === "signup" ? "/register/request-otp" : "/login/request-otp";
      const result = await fetchJson(path, {
        method: "POST",
        body: JSON.stringify({
          username: email,
          email,
          password,
          display_name: displayName,
        }),
      });

      setOtpSent(true);
      setMessage(
        result?.otp_sent
          ? "OTP sent successfully. Please check your email."
          : "OTP was generated, but it could not be delivered."
      );
      if (!result?.otp_sent && result?.email_error) {
        setNotifyInfo(result.email_error);
      }
      localStorage.setItem("pendingVerifyEmail", email.trim().toLowerCase());
    } catch (otpError) {
      setError(otpError.message || "Could not send OTP.");
    } finally {
      setOtpBusy(false);
    }
  };

  const togglePassword = () => {
    setShowPassword((current) => !current);
  };

  const forgotPassword = () => {
    setMessage("Password reset feature coming soon");
  };

  const clearLocalData = () => {
    localStorage.removeItem("fr_users_v1");
    localStorage.removeItem("fr_reviews_v1");
    localStorage.removeItem("recentReviews");
    localStorage.removeItem("username");
    localStorage.removeItem("displayName");
    localStorage.removeItem("rememberUser");
    localStorage.removeItem("pendingVerifyEmail");
    localStorage.removeItem("isAdmin");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setDisplayName("");
    setAttempts(0);
    setError("");
    setNotifyInfo("");
    setMessage("Local data cleared. Please sign up again.");
  };

  return (
    <div style={styles.page}>
      <div style={styles.layout}>
        <div style={styles.card}>
          <div style={styles.brandRow}>
            <span style={styles.brandBadge}>Secure Workspace</span>
          </div>

          <h1 style={styles.title}>Fake Review Detector</h1>

          <p style={styles.subtitle}>
            Professional access to your review detection dashboard
          </p>

          <div style={styles.infoRow}>
            <div style={styles.infoChip}>Real-time analysis</div>
            <div style={styles.infoChip}>Tracked sessions</div>
            <div style={styles.infoChip}>Admin protected</div>
          </div>

          <div style={styles.sectionTitle}>
            {authView === "signup" ? "Create your account" : "Login to continue"}
          </div>

          {error && <div style={styles.error}>{error}</div>}
          {message && <div style={styles.success}>{message}</div>}
          {notifyInfo && <div style={styles.notice}>{notifyInfo}</div>}

          <form onSubmit={handleSubmit}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={styles.input}
              />
            </div>

            {authView === "signup" && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Username</label>
                <input
                  type="text"
                  placeholder="Enter username"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  style={styles.input}
                />
              </div>
            )}

            <div style={styles.inputGroup}>
              <label style={styles.label}>
                {authView === "signup" ? "Create Password" : "Password"}
              </label>

              <div style={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={styles.input}
                />

                <button
                  type="button"
                  style={styles.showBtn}
                  onClick={togglePassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {strength && (
                <div style={styles.strength}>Password Strength: {strength}</div>
              )}
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Enter OTP</label>
              <div style={styles.otpRow}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/[^\d]/g, "").slice(0, 6))
                  }
                  style={styles.otpInput}
                />

                <button
                  type="button"
                  style={styles.sendOtpBtn}
                  onClick={sendOtp}
                  disabled={otpBusy}
                >
                  {otpBusy ? "Sending..." : "Send OTP"}
                </button>
              </div>
              {otpSent && (
                <div style={styles.otpHint}>
                  OTP sent. Check your email and enter it here.
                </div>
              )}
            </div>

            {authView === "signup" && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Confirm Password</label>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  style={styles.input}
                />
              </div>
            )}

            {authView === "login" && (
              <div style={styles.options}>
                <label>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={() => setRemember((current) => !current)}
                  />
                  Remember me
                </label>

                <button type="button" style={styles.link} onClick={forgotPassword}>
                  Forgot password?
                </button>
              </div>
            )}

            <button style={styles.loginBtn} disabled={loading}>
              {loading
                ? "Processing..."
                : authView === "signup"
                ? "Create Account"
                : "Login"}
            </button>

            <>
              <div style={styles.dividerRow}>
                <span style={styles.dividerLine} />
                <span style={styles.dividerText}>or continue with</span>
                <span style={styles.dividerLine} />
              </div>

              <div style={styles.googleCard}>
                <div style={styles.googleTitle}>Continue with Google</div>
                <div ref={googleButtonRef} style={styles.googleSlot} />
                {GOOGLE_CLIENT_ID && !googleReady && (
                  <div style={styles.googlePlaceholder}>
                    Loading Google sign-in...
                  </div>
                )}
              </div>

              {!GOOGLE_CLIENT_ID && (
                <div style={styles.notice}>
                  Add `VITE_GOOGLE_CLIENT_ID` in `frontend/.env` to enable real
                  Google sign-in.
                </div>
              )}

              <div style={styles.switchRow}>
                {authView === "login" ? (
                  <>
                    <span>Don&apos;t have an account?</span>
                    <button
                      type="button"
                      onClick={() => setAuthView("signup")}
                      style={styles.switchLink}
                    >
                      Sign Up
                    </button>
                  </>
                ) : (
                  <>
                    <span>Already have an account?</span>
                    <button
                      type="button"
                      onClick={() => setAuthView("login")}
                      style={styles.switchLink}
                    >
                      Login
                    </button>
                  </>
                )}
              </div>
            </>
          </form>

          <button type="button" onClick={clearLocalData} style={styles.clearBtn}>
            Clear Local Data
          </button>

          <div style={styles.footer}>
            <p>Secure Login - AI Powered System</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "32px 20px",
    background: "linear-gradient(180deg,#020617 0%,#0f172a 45%,#111827 100%)",
  },

  layout: {
    width: "100%",
    maxWidth: "520px",
  },

  card: {
    width: "100%",
    background: "linear-gradient(180deg,#0f172a 0%,#111827 100%)",
    padding: "34px 34px 28px",
    borderRadius: "24px",
    border: "1px solid rgba(148,163,184,0.16)",
    boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  brandRow: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "12px",
  },

  brandBadge: {
    background: "rgba(37,99,235,0.16)",
    color: "#dbeafe",
    padding: "6px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.04em",
    border: "1px solid rgba(96,165,250,0.35)",
  },

  title: {
    textAlign: "center",
    fontSize: "32px",
    marginBottom: "8px",
    color: "#f8fafc",
  },

  subtitle: {
    textAlign: "center",
    color: "#cbd5e1",
    marginBottom: "18px",
    fontSize: "14px",
    lineHeight: "1.5",
  },

  infoRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "8px",
    marginBottom: "20px",
  },

  infoChip: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(148,163,184,0.18)",
    fontSize: "12px",
    color: "#e2e8f0",
    fontWeight: "600",
  },

  sectionTitle: {
    marginBottom: "18px",
    textAlign: "center",
    color: "#f8fafc",
    fontSize: "18px",
    fontWeight: "700",
  },

  inputGroup: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "14px",
  },

  label: {
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: "600",
  },

  input: {
    padding: "12px",
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: "10px",
    marginTop: "5px",
    fontSize: "14px",
    outline: "none",
    background: "rgba(255,255,255,0.06)",
    color: "#f8fafc",
  },

  passwordWrapper: {
    display: "flex",
    gap: "10px",
  },

  showBtn: {
    padding: "10px",
    background: "rgba(255,255,255,0.08)",
    color: "#f8fafc",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: "10px",
    cursor: "pointer",
  },

  strength: {
    fontSize: "13px",
    marginTop: "5px",
    color: "#cbd5e1",
  },

  options: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "20px",
  },

  link: {
    background: "none",
    border: "none",
    color: "#93c5fd",
    cursor: "pointer",
  },

  loginBtn: {
    width: "100%",
    padding: "12px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "16px",
    cursor: "pointer",
  },

  dividerRow: {
    marginTop: "16px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  dividerLine: {
    flex: 1,
    height: "1px",
    background: "rgba(148,163,184,0.2)",
  },

  dividerText: {
    color: "#94a3b8",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  googleCard: {
    marginTop: "14px",
    padding: "14px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(148,163,184,0.18)",
  },

  googleTitle: {
    color: "#e2e8f0",
    fontSize: "13px",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: "10px",
  },

  otpRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    marginTop: "5px",
  },

  otpInput: {
    flex: 1,
    padding: "12px",
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    background: "rgba(255,255,255,0.06)",
    color: "#f8fafc",
  },

  sendOtpBtn: {
    minWidth: "118px",
    padding: "12px 14px",
    background: "#dc2626",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "700",
    whiteSpace: "nowrap",
  },

  otpHint: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#fca5a5",
  },

  googleSlot: {
    minHeight: "44px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  googlePlaceholder: {
    marginTop: "8px",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: "12px",
  },

  switchRow: {
    marginTop: "10px",
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    fontSize: "13px",
    color: "#cbd5e1",
  },

  switchLink: {
    background: "none",
    border: "none",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: "600",
  },

  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "10px",
    borderRadius: "6px",
    marginBottom: "15px",
    textAlign: "center",
  },

  success: {
    background: "#dcfce7",
    color: "#166534",
    padding: "10px",
    borderRadius: "6px",
    marginBottom: "15px",
    textAlign: "center",
  },

  notice: {
    background: "#e0e7ff",
    color: "#3730a3",
    padding: "8px",
    borderRadius: "6px",
    marginBottom: "12px",
    textAlign: "center",
    fontSize: "12px",
  },

  footer: {
    marginTop: "20px",
    textAlign: "center",
    fontSize: "12px",
    color: "#94a3b8",
  },

  clearBtn: {
    width: "100%",
    marginTop: "14px",
    padding: "10px 12px",
    background: "transparent",
    color: "#e2e8f0",
    border: "1px solid rgba(148,163,184,0.28)",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "14px",
  },
};

export default Login;
