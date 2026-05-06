const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

const getConfig = () => ({
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || "",
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "",
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "",
  appBaseUrl: window.location.origin || import.meta.env.VITE_APP_BASE_URL || ""
});

export const isEmailServiceConfigured = () => {
  const { serviceId, templateId, publicKey } = getConfig();
  return Boolean(serviceId && templateId && publicKey);
};

export const buildVerificationUrl = (token, email) => {
  const { appBaseUrl } = getConfig();
  const base = (appBaseUrl || window.location.origin).replace(/\/$/, "");
  const params = new URLSearchParams();

  if (token) {
    params.set("token", token);
  }
  if (email) {
    params.set("email", email);
  }

  return `${base}/verify?${params.toString()}`;
};

export const sendVerificationEmail = async ({
  toEmail,
  toName,
  verificationUrl,
  verificationToken = ""
}) => {
  const { serviceId, templateId, publicKey } = getConfig();
  let derivedToken = verificationToken;

  if (!isEmailServiceConfigured()) {
    throw new Error("Email service is not configured yet.");
  }

  if (!derivedToken && verificationUrl) {
    try {
      derivedToken = new URL(verificationUrl).searchParams.get("token") || "";
    } catch {
      derivedToken = "";
    }
  }

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      to_email: toEmail,
      email: toEmail,
      user_email: toEmail,
      to_name: toName || toEmail,
      user_name: toName || toEmail,
      link: verificationUrl,
      url: verificationUrl,
      verification_link: verificationUrl,
      verification_url: verificationUrl,
      verify_url: verificationUrl,
      verification_token: derivedToken,
      token: derivedToken,
      message: `Verify your FakeReviewAI account: ${verificationUrl}`,
      app_name: "FakeReviewAI"
    }
  };

  const response = await fetch(EMAILJS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || "Failed to send verification email.");
  }

  return true;
};
