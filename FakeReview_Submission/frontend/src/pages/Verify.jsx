import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ScrollReveal from "../components/ScrollReveal";
import { fetchJson } from "../utils/api";
import "./Verify.css";

const PENDING_AUTH_EMAIL_KEY = "pendingAuthEmail";
const PENDING_AUTH_MODE_KEY = "pendingAuthMode";

function Verify() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState("pending");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const token = (searchParams.get("token") || "").trim();
  const email = (
    searchParams.get("email") ||
    localStorage.getItem(PENDING_AUTH_EMAIL_KEY) ||
    localStorage.getItem("pendingVerifyEmail") ||
    ""
  )
    .trim()
    .toLowerCase();
  const mode =
    (searchParams.get("mode") || localStorage.getItem(PENDING_AUTH_MODE_KEY) || "")
      .trim()
      .toLowerCase() || (token ? "email-link" : "email-link");
  const isLoginOtpMode = mode === "login-otp";
  const isVerifyOtpMode = mode === "verify-otp";

  useEffect(() => {
    let cancelled = false;

    const verifyFromLink = async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setStatus("verifying");
      setMessage("Verifying your email...");
      setNotice("");

      try {
        const result = await fetchJson("/verify-email/confirm", {
          method: "POST",
          body: JSON.stringify({
            token,
            email,
          }),
        });

        if (cancelled) {
          return;
        }

        setStatus("success");
        setMessage(result?.message || "Email verified successfully.");
        setNotice("Redirecting to login...");
        localStorage.removeItem("pendingVerifyEmail");
        localStorage.removeItem(PENDING_AUTH_EMAIL_KEY);
        localStorage.removeItem(PENDING_AUTH_MODE_KEY);
        setTimeout(() => navigate("/login"), 1600);
      } catch (verifyError) {
        if (cancelled) {
          return;
        }

        setStatus("error");
        setMessage(
          verifyError.message ||
            "Verification link is invalid or expired. Please request a new email."
        );
        setNotice("You can resend the verification email below.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (token) {
      verifyFromLink();
      return () => {
        cancelled = true;
      };
    }

    if (!email) {
      setStatus("error");
      setMessage("We could not find the email address.");
      setNotice("Please go back and enter your email again.");
      return () => {
        cancelled = true;
      };
    }

    setStatus("pending");

    if (isLoginOtpMode) {
      setMessage(`Enter the login OTP sent to ${email}.`);
      setNotice("Use the same password screen to request a fresh OTP if needed.");
      return () => {
        cancelled = true;
      };
    }

    if (isVerifyOtpMode) {
      setMessage(`Enter the verification OTP sent to ${email}.`);
      setNotice("If the OTP expires, request a fresh verification OTP below.");
      return () => {
        cancelled = true;
      };
    }

    setMessage(`We are ready to verify ${email}.`);
    setNotice("Open the verification link from your inbox, or resend it below.");

    return () => {
      cancelled = true;
    };
  }, [email, isLoginOtpMode, isVerifyOtpMode, navigate, token]);

  const handleVerifyOtp = async () => {
    if (!email) {
      setStatus("error");
      setMessage("We could not find the email address.");
      setNotice("Please go back and enter your email again.");
      return;
    }

    if (!otp.trim()) {
      setStatus("error");
      setMessage("Enter the OTP sent to your email.");
      setNotice("");
      return;
    }

    setLoading(true);
    setStatus("verifying");
    setMessage("Checking your OTP...");
    setNotice("");

    try {
      const endpoint = isLoginOtpMode
        ? "/login/verify-otp"
        : "/verify-email/confirm-otp";
      const result = await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          email,
          otp: otp.trim(),
        }),
      });

      localStorage.removeItem("pendingVerifyEmail");
      localStorage.removeItem(PENDING_AUTH_EMAIL_KEY);
      localStorage.removeItem(PENDING_AUTH_MODE_KEY);

      if (isLoginOtpMode) {
        const username = result?.username || email;
        localStorage.setItem("username", username);
        localStorage.setItem(
          "displayName",
          result?.display_name || username
        );
        localStorage.setItem("isAdmin", result?.is_admin ? "true" : "false");
        setStatus("success");
        setMessage(result?.message || "Login successful.");
        setNotice("Redirecting to your workspace...");
        setTimeout(
          () => navigate(result?.is_admin ? "/admin" : "/analyzer"),
          1500
        );
      } else {
        setStatus("success");
        setMessage(result?.message || "Email verified successfully.");
        setNotice("Redirecting to login...");
        setTimeout(() => navigate("/login"), 1500);
      }
    } catch (otpError) {
      setStatus("error");
      setMessage(otpError.message || "OTP verification failed.");
      setNotice(
        isLoginOtpMode
          ? "Return to login and request a fresh OTP if this one expired."
          : "Request a fresh verification OTP below if needed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setStatus("error");
      setMessage("We could not find the email address.");
      setNotice("Please go back and try again.");
      return;
    }

    if (isLoginOtpMode) {
      setStatus("pending");
      setMessage(`Go back to login to send a fresh OTP for ${email}.`);
      setNotice("For login OTP, the password is checked before sending a new code.");
      return;
    }

    setLoading(true);
    setStatus("pending");
    setMessage(
      isVerifyOtpMode
        ? "Sending a fresh verification OTP..."
        : "Sending a fresh verification email..."
    );
    setNotice("");

    try {
      const endpoint = isVerifyOtpMode
        ? "/verify-email/request-otp"
        : "/verify-email/resend";
      const result = await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          email,
        }),
      });

      localStorage.setItem(PENDING_AUTH_EMAIL_KEY, email);
      if (isVerifyOtpMode) {
        localStorage.setItem(PENDING_AUTH_MODE_KEY, "verify-otp");
      }

      setStatus(result?.otp_sent || result?.verification_sent ? "success" : "error");
      setMessage(
        isVerifyOtpMode
          ? result?.otp_sent
            ? `A fresh verification OTP was sent to ${email}.`
            : "Verification OTP was generated, but it could not be delivered."
          : result?.verification_sent
          ? `A fresh verification email was sent to ${email}.`
          : "Verification email was prepared, but it could not be delivered."
      );
      setNotice(
        isVerifyOtpMode
          ? result?.otp_sent
            ? "Check your inbox and enter the new OTP."
            : result?.email_error || "Please try again in a moment."
          : result?.verification_sent
          ? "Check your inbox and open the verification link."
          : result?.email_error || "Please try again in a moment."
      );
    } catch (resendError) {
      setStatus("error");
      setMessage(
        resendError.message ||
          (isVerifyOtpMode
            ? "Could not resend verification OTP."
            : "Could not resend verification email.")
      );
      setNotice("Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const heading = isLoginOtpMode
    ? "Login OTP"
    : isVerifyOtpMode
    ? "Verification OTP"
    : "Email Verification";

  return (
    <div className="verify-page">
      <ScrollReveal>
        <div className="verify-card">
          <h1>{heading}</h1>
          <p className={status === "error" ? "error-text" : "success-text"}>
            {message}
          </p>
          {notice && <p className="notice-text">{notice}</p>}

          {(isLoginOtpMode || isVerifyOtpMode) && !token && (
            <div className="verify-otp-panel">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter OTP"
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/[^\d]/g, "").slice(0, 6))
                }
                className="verify-input"
              />
              <button
                onClick={handleVerifyOtp}
                className="verify-btn"
                disabled={loading || !otp.trim()}
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          )}

          <div className="verify-actions">
            {!token && (
              <button
                onClick={handleResend}
                className="verify-btn"
                disabled={loading || !email}
              >
                {loading
                  ? "Sending..."
                  : isLoginOtpMode
                  ? "Go To Login To Resend"
                  : isVerifyOtpMode
                  ? "Resend OTP"
                  : "Resend Verification Email"}
              </button>
            )}

            <button
              onClick={() => navigate("/login")}
              className="verify-btn verify-btn-secondary"
            >
              Go To Login
            </button>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}

export default Verify;
