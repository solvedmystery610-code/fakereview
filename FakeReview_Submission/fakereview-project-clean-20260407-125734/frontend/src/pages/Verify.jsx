import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ScrollReveal from "../components/ScrollReveal";
import { fetchJson } from "../utils/api";
import "./Verify.css";

function Verify() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState("pending");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const token = (searchParams.get("token") || "").trim();
  const email = (
    searchParams.get("email") || localStorage.getItem("pendingVerifyEmail") || ""
  )
    .trim()
    .toLowerCase();
  const sentFlag = searchParams.get("sent");

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
      setMessage("We could not find the email address to verify.");
      setNotice("Please go back to signup and try again.");
      return () => {
        cancelled = true;
      };
    }

    setStatus("pending");
    setMessage(`We are ready to verify ${email}.`);

    if (sentFlag === "0") {
      setNotice(
        "Your account was created, but the verification email could not be delivered automatically. Use resend below."
      );
    } else if (sentFlag === "1") {
      setNotice("Verification email sent successfully. Please check your inbox.");
    } else {
      setNotice("Open the verification link from your inbox, or resend it below.");
    }

    return () => {
      cancelled = true;
    };
  }, [email, navigate, sentFlag, token]);

  const handleResend = async () => {
    if (!email) {
      setStatus("error");
      setMessage("We could not find the email address to verify.");
      setNotice("Please go back to signup and try again.");
      return;
    }

    setLoading(true);
    setStatus("pending");
    setMessage("Sending a fresh verification email...");
    setNotice("");

    try {
      const result = await fetchJson("/verify-email/resend", {
        method: "POST",
        body: JSON.stringify({
          email,
        }),
      });

      localStorage.setItem("pendingVerifyEmail", email);
      setStatus(result?.verification_sent ? "success" : "error");
      setMessage(
        result?.verification_sent
          ? `A fresh verification email was sent to ${email}.`
          : "Verification email was prepared, but it could not be delivered."
      );
      setNotice(
        result?.verification_sent
          ? "Check your Gmail inbox and open the verification link."
          : result?.email_error || "Please try again in a moment."
      );
    } catch (resendError) {
      setStatus("error");
      setMessage(
        resendError.message || "Could not resend verification email."
      );
      setNotice("Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-page">
      <ScrollReveal>
        <div className="verify-card">
          <h1>Email Verification</h1>
          <p className={status === "error" ? "error-text" : "success-text"}>
            {message}
          </p>
          {notice && <p className="notice-text">{notice}</p>}

          <div className="verify-actions">
            {!token && (
              <button
                onClick={handleResend}
                className="verify-btn"
                disabled={loading || !email}
              >
                {loading ? "Sending..." : "Resend Verification Email"}
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
