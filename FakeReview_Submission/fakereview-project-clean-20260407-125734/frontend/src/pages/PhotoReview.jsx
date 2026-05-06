import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ScrollReveal from "../components/ScrollReveal";
import { analyzeImageFile } from "../utils/imageAnalyzer";
import { fetchJson, fireAndForgetJson } from "../utils/api";
import "./PhotoReview.css";

const MODE_UPLOAD = "upload";
const MODE_VENUE = "venue";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getRiskLabel = (score) => {
  if (score >= 25) return "High Risk";
  if (score >= 12) return "Medium Risk";
  return "Low Risk";
};

const getServerProbFake = (data) => {
  if (typeof data?.prob_fake === "number") {
    return data.prob_fake;
  }
  if (data?.result === "Fake") {
    return (data?.confidence || 50) / 100;
  }
  return 1 - (data?.confidence || 50) / 100;
};

const formatCoord = (value) =>
  typeof value === "number" ? value.toFixed(5) : "-";

const formatDistance = (meters) => {
  if (typeof meters !== "number") {
    return "-";
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
};

const parseCoordinateNumber = (value, kind) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (kind === "lat" && (parsed < -90 || parsed > 90)) {
    return null;
  }

  if (kind === "lng" && (parsed < -180 || parsed > 180)) {
    return null;
  }

  return parsed;
};

const parseVenueCoordinates = (input) => {
  const raw = (input || "").trim();
  if (!raw) {
    return null;
  }

  const directMatch = raw.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (directMatch) {
    return {
      lat: Number(directMatch[1]),
      lng: Number(directMatch[2]),
    };
  }

  const atMatch = raw.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (atMatch) {
    return {
      lat: Number(atMatch[1]),
      lng: Number(atMatch[2]),
    };
  }

  const mapsMatch = raw.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (mapsMatch) {
    return {
      lat: Number(mapsMatch[1]),
      lng: Number(mapsMatch[2]),
    };
  }

  return null;
};

const resolveVenueCoordinates = ({ latitude, longitude, mapLink }) => {
  const lat = parseCoordinateNumber(latitude, "lat");
  const lng = parseCoordinateNumber(longitude, "lng");

  if (lat !== null && lng !== null) {
    return { lat, lng, source: "manual" };
  }

  const parsedLink = parseVenueCoordinates(mapLink);
  if (parsedLink) {
    return { ...parsedLink, source: "map_link" };
  }

  return null;
};

const toRadians = (value) => (value * Math.PI) / 180;

const getDistanceMeters = (from, to) => {
  if (!from || !to) {
    return null;
  }

  const earthRadius = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
};

const buildVenueVerification = ({
  venueName,
  venueCoords,
  captureLocation,
}) => {
  const safeVenueName = venueName?.trim() || "the claimed venue";

  if (!venueCoords) {
    return {
      label: "Need venue coordinates",
      status: "pending",
      probabilityShift: 0,
      summary:
        "Venue verification could not run because the map link did not contain usable coordinates.",
      detail:
        "Paste a full Google Maps link with coordinates or enter latitude,longitude.",
    };
  }

  if (!captureLocation) {
    return {
      label: "Location unavailable",
      status: "unavailable",
      probabilityShift: 0,
      summary:
        "Live photo was captured, but browser location was not available, so venue proof could not be confirmed.",
      detail:
        "The final result still uses the shared Analyzer text logic plus image quality checks.",
    };
  }

  const distanceMeters = getDistanceMeters(captureLocation, venueCoords);
  const accuracyMeters = captureLocation.accuracy || 0;
  const verifiedLimit = Math.max(180, accuracyMeters * 1.5);
  const nearbyLimit = Math.max(650, accuracyMeters * 3);

  if (distanceMeters <= verifiedLimit) {
    return {
      label: "On-site verified",
      status: "verified",
      probabilityShift: -0.12,
      distanceMeters,
      accuracyMeters,
      summary: `Live capture was taken close to ${safeVenueName}, which supports that the reviewer was physically at the venue.`,
      detail: `Captured location is ${formatDistance(distanceMeters)} away with GPS accuracy around ${formatDistance(
        accuracyMeters
      )}.`,
    };
  }

  if (distanceMeters <= nearbyLimit) {
    return {
      label: "Nearby venue",
      status: "nearby",
      probabilityShift: -0.05,
      distanceMeters,
      accuracyMeters,
      summary: `Live capture was taken near ${safeVenueName}, which is a mild positive authenticity signal.`,
      detail: `Captured location is ${formatDistance(distanceMeters)} away with GPS accuracy around ${formatDistance(
        accuracyMeters
      )}.`,
    };
  }

  return {
    label: "Location mismatch",
    status: "mismatch",
    probabilityShift: 0.12,
    distanceMeters,
    accuracyMeters,
    summary: `Live capture location does not line up with ${safeVenueName}, which weakens the venue-review claim.`,
    detail: `Captured location is ${formatDistance(distanceMeters)} away while GPS accuracy is around ${formatDistance(
      accuracyMeters
    )}.`,
  };
};

function PhotoReview() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [mode, setMode] = useState(MODE_UPLOAD);
  const [review, setReview] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueLatitude, setVenueLatitude] = useState("");
  const [venueLongitude, setVenueLongitude] = useState("");
  const [venueLink, setVenueLink] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageSignals, setImageSignals] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [captureLocation, setCaptureLocation] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [analysis, setAnalysis] = useState([]);
  const [sentiment, setSentiment] = useState("");
  const [modelLabel, setModelLabel] = useState("");
  const [venueVerification, setVenueVerification] = useState(null);

  const parsedVenueCoords = resolveVenueCoordinates({
    latitude: venueLatitude,
    longitude: venueLongitude,
    mapLink: venueLink,
  });

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const clearPreview = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview("");
  };

  const resetOutcome = () => {
    setResult(null);
    setConfidence(0);
    setAnalysis([]);
    setSentiment("");
    setModelLabel("");
    setVenueVerification(null);
  };

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [imagePreview]);

  const requestCurrentLocation = async ({ silent = false } = {}) => {
    if (!navigator.geolocation) {
      const message = "Geolocation is not supported in this browser.";
      if (!silent) {
        setLocationError(message);
      }
      return null;
    }

    setLocationLoading(true);
    if (!silent) {
      setLocationError("");
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        });
      });

      const nextLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        capturedAt: new Date().toISOString(),
      };

      setCaptureLocation(nextLocation);
      return nextLocation;
    } catch (locationIssue) {
      const message =
        locationIssue?.message ||
        "Location permission was denied, so venue verification will be weaker.";
      if (!silent) {
        setLocationError(message);
      }
      return null;
    } finally {
      setLocationLoading(false);
    }
  };

  const processImageFile = async (file, source) => {
    if (!file) {
      clearPreview();
      setImageSignals(null);
      resetOutcome();
      return;
    }

    setImageLoading(true);
    setError("");
    setCameraError("");
    resetOutcome();

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    const currentUser = localStorage.getItem("username") || "guest";
    fireAndForgetJson("/track/upload", {
      username: currentUser,
      file_name: file.name,
      file_size: file.size,
      status: "processing",
      source,
    });

    try {
      const signals = await analyzeImageFile(file);
      setImageSignals(signals);
      fireAndForgetJson("/track/upload", {
        username: currentUser,
        file_name: file.name,
        file_size: file.size,
        status: "completed",
        source,
      });
    } catch {
      setError("Unable to analyze the image. Please try another file.");
      setImageSignals(null);
      fireAndForgetJson("/track/upload", {
        username: currentUser,
        file_name: file.name,
        file_size: file.size,
        status: "failed",
        source,
        error: "Image analyzer failed",
      });
    } finally {
      setImageLoading(false);
    }
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      clearPreview();
      setImageSignals(null);
      resetOutcome();
      setImageLoading(false);
      return;
    }

    await processImageFile(file, "photo_review_upload");
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Live camera is not supported in this browser.");
      return;
    }

    if (
      !window.isSecureContext &&
      !["localhost", "127.0.0.1"].includes(window.location.hostname)
    ) {
      setCameraError(
        "Camera access needs HTTPS or localhost. Open the app on localhost/127.0.0.1 or use HTTPS."
      );
      return;
    }

    setCameraLoading(true);
    setCameraError("");

    try {
      stopCamera();
      const constraintOptions = [
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        {
          video: true,
          audio: false,
        },
      ];

      let stream = null;
      let lastError = null;

      for (const constraints of constraintOptions) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (issue) {
          lastError = issue;
        }
      }

      if (!stream) {
        throw lastError || new Error("Could not access camera.");
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => resolve();
        });
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (captureIssue) {
      const issueName = captureIssue?.name || "";
      if (issueName === "NotAllowedError") {
        setCameraError(
          "Camera permission was denied. Allow camera access in the browser and try again."
        );
      } else if (issueName === "NotFoundError") {
        setCameraError(
          "No camera device was found on this system. Try another camera or use upload mode."
        );
      } else if (issueName === "NotReadableError") {
        setCameraError(
          "Camera is already being used by another app. Close other camera apps and try again."
        );
      } else {
        setCameraError(
          captureIssue?.message ||
            "Camera could not be opened. Try again or use upload mode."
        );
      }
    } finally {
      setCameraLoading(false);
    }
  };

  const captureLivePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setCameraError("Camera preview is not ready yet.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    if (!width || !height) {
      setCameraError("Live camera frame is not ready yet.");
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Camera capture failed. Please try again.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );

    if (!blob) {
      setCameraError("Could not convert the live camera frame into an image.");
      return;
    }

    await requestCurrentLocation({ silent: false });

    const liveFile = new File([blob], `venue-capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    await processImageFile(liveFile, "photo_review_live_venue");
    stopCamera();
  };

  const handleModeChange = (nextMode) => {
    if (nextMode === mode) {
      return;
    }

    setMode(nextMode);
    setError("");
    setCameraError("");
    setLocationError("");
    setCaptureLocation(null);
    setVenueName("");
    setVenueLatitude("");
    setVenueLongitude("");
    setVenueLink("");
    clearPreview();
    setImageSignals(null);
    resetOutcome();
    stopCamera();
  };

  const runAnalysis = async () => {
    setError("");

    if (!review.trim()) {
      setError("Please add review text to analyze.");
      return;
    }

    if (!imageSignals) {
      setError(
        mode === MODE_VENUE
          ? "Please capture a live venue photo first."
          : "Please upload a review image first."
      );
      return;
    }

    if (mode === MODE_VENUE && !parsedVenueCoords) {
      setError(
        "Paste a full Google Maps link or latitude,longitude so venue verification can run."
      );
      return;
    }

    setAnalysisLoading(true);

    try {
      const payload = {
        review,
        username: localStorage.getItem("username") || "guest",
        persist: false,
      };

      const data = await fetchJson("/analyze", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const textProbFake = getServerProbFake(data);
      const imageProbFake = clamp((imageSignals.riskScore || 0) / 100, 0, 1);
      let finalProbFake = clamp(textProbFake, 0.01, 0.99);

      if (imageProbFake >= 0.25 && textProbFake >= 0.35) {
        finalProbFake = clamp(finalProbFake + 0.08, 0.01, 0.99);
      } else if (imageProbFake >= 0.12 && textProbFake >= 0.43) {
        finalProbFake = clamp(finalProbFake + 0.04, 0.01, 0.99);
      } else if (imageProbFake <= 0.08 && textProbFake <= 0.3) {
        finalProbFake = clamp(finalProbFake - 0.02, 0.01, 0.99);
      }

      const reasons = [...(data.analysis || [])];
      if (imageProbFake >= 0.25 && textProbFake >= 0.35) {
        reasons.push(
          "Image risk strengthened the text model's suspicious review prediction."
        );
      } else if (imageProbFake <= 0.08 && textProbFake <= 0.3) {
        reasons.push("Image quality did not add extra suspicious evidence.");
      } else {
        reasons.push(
          "Final decision is driven mainly by the same shared Analyzer model used for text review detection."
        );
      }

      if (imageSignals.flags?.length) {
        imageSignals.flags.forEach((flag) => {
          reasons.push(`Image check: ${flag}`);
        });
      }

      let venueCheck = null;
      if (mode === MODE_VENUE) {
        venueCheck = buildVenueVerification({
          venueName,
          venueCoords: parsedVenueCoords,
          captureLocation,
        });
        finalProbFake = clamp(
          finalProbFake + venueCheck.probabilityShift,
          0.01,
          0.99
        );
        reasons.push(venueCheck.summary);
        if (venueCheck.detail) {
          reasons.push(venueCheck.detail);
        }
      }

      const finalResult = finalProbFake >= 0.5 ? "Fake" : "Genuine";
      const computedConfidence = Math.round(
        Math.max(finalProbFake, 1 - finalProbFake) * 100
      );

      setVenueVerification(venueCheck);
      setResult(finalResult);
      setConfidence(computedConfidence);
      setAnalysis(reasons);
      setSentiment(data.sentiment || "");
      setModelLabel(
        data.model === "tfidf_word_char_logreg"
          ? "Word + Char TF-IDF"
          : data.model === "tfidf_linear_calibrated"
          ? "TF-IDF + Linear"
          : data.model || "Server model"
      );
    } catch (analysisIssue) {
      setError(analysisIssue.message || "Analysis failed. Please try again.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const riskScore = imageSignals?.riskScore ?? 0;
  const riskLabel = getRiskLabel(riskScore);
  const showAnalysis = analysis.length > 0;
  const showImageFlags = !showAnalysis && (imageSignals?.flags?.length || 0) > 0;
  const showNoFlags =
    !showAnalysis &&
    !showImageFlags &&
    !(mode === MODE_VENUE && venueVerification);

  return (
    <div className="photo-page">
      <div className="photo-shell">
        <ScrollReveal>
          <header className="photo-hero">
            <div>
              <p className="photo-kicker">Photo Review Intelligence</p>
              <h1>Photo Review + Live Venue Verification</h1>
              <p className="photo-subtitle">
                Upload regular review photos for ecommerce checks, or switch to
                live venue mode to capture a real-time hotel or restaurant photo
                with browser GPS proof.
              </p>
              <div className="photo-actions">
                <button onClick={() => navigate("/analyzer")}>
                  Go To Analyzer
                </button>
                <button className="ghost" onClick={() => navigate("/history")}>
                  View History
                </button>
              </div>
            </div>
            <div className="photo-card">
              <h3>Key Checks</h3>
              <ul>
                <li>Shared text model from the Analyzer</li>
                <li>Image quality and suspicious screenshot signals</li>
                <li>Live camera + GPS venue verification</li>
              </ul>
            </div>
          </header>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <section className="photo-panel">
            <div className="upload-card">
              <h2>
                {mode === MODE_VENUE ? "Live Venue Review" : "Review Text + Image"}
              </h2>
              <p className="photo-helper">
                {mode === MODE_VENUE
                  ? "Use live camera capture for hotel, restaurant, or Google Maps style reviews. Add nomination/place name plus latitude and longitude, and the app will compare them with live GPS."
                  : "Add a review photo, screenshot, or product image to evaluate authenticity signals."}
              </p>

              <div className="mode-switch">
                <button
                  type="button"
                  className={mode === MODE_UPLOAD ? "mode-btn active" : "mode-btn"}
                  onClick={() => handleModeChange(MODE_UPLOAD)}
                >
                  Product / Upload
                </button>
                <button
                  type="button"
                  className={mode === MODE_VENUE ? "mode-btn active" : "mode-btn"}
                  onClick={() => handleModeChange(MODE_VENUE)}
                >
                  Venue Live Proof
                </button>
              </div>

              <textarea
                className="photo-textarea"
                placeholder="Paste the review text here..."
                value={review}
                onChange={(event) => setReview(event.target.value)}
              />

              {mode === MODE_UPLOAD ? (
                <input type="file" accept="image/*" onChange={handleImageChange} />
              ) : (
                <div className="venue-box">
                  <input
                    className="venue-input"
                    type="text"
                    placeholder="Nomination / Place name"
                    value={venueName}
                    onChange={(event) => setVenueName(event.target.value)}
                  />
                  <div className="coord-grid">
                    <input
                      className="venue-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="Latitude"
                      value={venueLatitude}
                      onChange={(event) => setVenueLatitude(event.target.value)}
                    />
                    <input
                      className="venue-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="Longitude"
                      value={venueLongitude}
                      onChange={(event) => setVenueLongitude(event.target.value)}
                    />
                  </div>
                  <textarea
                    className="venue-input venue-textarea"
                    placeholder="Optional: paste Google Maps link to auto-read coordinates"
                    value={venueLink}
                    onChange={(event) => setVenueLink(event.target.value)}
                  />
                  <div className="camera-actions">
                    <button
                      type="button"
                      className="blue-btn"
                      onClick={startCamera}
                      disabled={cameraLoading}
                    >
                      {cameraLoading ? "Opening Camera..." : "Start Camera"}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => requestCurrentLocation({ silent: false })}
                      disabled={locationLoading}
                    >
                      {locationLoading ? "Getting GPS..." : "Capture Location"}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={captureLivePhoto}
                      disabled={!cameraActive || imageLoading}
                    >
                      Capture Live Photo
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={stopCamera}
                      disabled={!cameraActive}
                    >
                      Stop Camera
                    </button>
                  </div>

                  {cameraActive && (
                    <div className="camera-shell">
                      <video
                        ref={videoRef}
                        className="camera-preview"
                        autoPlay
                        muted
                        playsInline
                      />
                    </div>
                  )}

                  {!cameraActive && (
                    <div className="camera-empty">
                      Camera preview will appear here after you click Start Camera.
                    </div>
                  )}

                  <canvas ref={canvasRef} className="hidden-canvas" />

                  {parsedVenueCoords ? (
                    <div className="location-box">
                      <p className="location-title">Venue Coordinates</p>
                      <p className="location-copy">
                        {formatCoord(parsedVenueCoords.lat)},{" "}
                        {formatCoord(parsedVenueCoords.lng)}
                      </p>
                      <p className="location-meta">
                        Source:{" "}
                        {parsedVenueCoords.source === "manual"
                          ? "Latitude / Longitude fields"
                          : "Google Maps link"}
                      </p>
                    </div>
                  ) : venueLink.trim() ? (
                    <p className="photo-note">
                      Could not read coordinates from that link yet. Enter
                      latitude and longitude manually or paste a fuller Google
                      Maps URL.
                    </p>
                  ) : venueLatitude.trim() || venueLongitude.trim() ? (
                    <p className="photo-note">
                      Latitude or longitude is incomplete. Add both values to run
                      venue verification.
                    </p>
                  ) : null}

                  {captureLocation && (
                    <div className="location-box">
                      <p className="location-title">Captured Live GPS</p>
                      <p className="location-copy">
                        {formatCoord(captureLocation.lat)},{" "}
                        {formatCoord(captureLocation.lng)}
                      </p>
                      <p className="location-meta">
                        Accuracy: {formatDistance(captureLocation.accuracy)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {imagePreview && (
                <div className="preview-box">
                  <img src={imagePreview} alt="Review preview" />
                </div>
              )}

              {imageLoading && <p className="photo-note">Analyzing image...</p>}
              {analysisLoading && (
                <p className="photo-note">Analyzing review...</p>
              )}
              {cameraError && <p className="photo-error">{cameraError}</p>}
              {locationError && <p className="photo-error">{locationError}</p>}
              {error && <p className="photo-error">{error}</p>}

              <button
                className="blue-btn analyze-btn"
                onClick={runAnalysis}
                disabled={analysisLoading || imageLoading}
              >
                {mode === MODE_VENUE
                  ? "Analyze Venue Review"
                  : "Analyze Photo + Text"}
              </button>
            </div>

            <div className="result-card">
              <div className="result-head">
                <h2>Photo Risk Result</h2>
                {imageSignals && (
                  <span
                    className={`risk-pill risk-${riskLabel
                      .toLowerCase()
                      .replace(" ", "")}`}
                  >
                    {riskLabel}
                  </span>
                )}
              </div>

              {!imageSignals && !imageLoading && (
                <p className="photo-note">
                  {mode === MODE_VENUE
                    ? "Capture a live venue photo to see the combined review summary."
                    : "Upload an image to see the analysis summary."}
                </p>
              )}

              {imageSignals && (
                <div className="result-body">
                  <div className="result-grid">
                    <div>
                      <p className="label">Risk Score</p>
                      <p className="value">{riskScore}%</p>
                    </div>
                    <div>
                      <p className="label">Confidence</p>
                      <p className="value">
                        {confidence || Math.min(98, 80 + riskScore)}%
                      </p>
                    </div>
                    <div>
                      <p className="label">Sentiment</p>
                      <p className="value">{sentiment || "-"}</p>
                    </div>
                    <div>
                      <p className="label">Resolution</p>
                      <p className="value">
                        {imageSignals.width}x{imageSignals.height}
                      </p>
                    </div>
                    <div>
                      <p className="label">Model</p>
                      <p className="value">{modelLabel || "Waiting"}</p>
                    </div>
                    {mode === MODE_VENUE && (
                      <div>
                        <p className="label">Venue Check</p>
                        <p className="value">
                          {venueVerification?.label || "Pending"}
                        </p>
                      </div>
                    )}
                    {mode === MODE_VENUE && (
                      <div>
                        <p className="label">Nomination</p>
                        <p className="value venue-mini">
                          {venueName?.trim() || "-"}
                        </p>
                      </div>
                    )}
                    {mode === MODE_VENUE && (
                      <div>
                        <p className="label">Latitude / Longitude</p>
                        <p className="value venue-mini">
                          {parsedVenueCoords
                            ? `${formatCoord(parsedVenueCoords.lat)}, ${formatCoord(
                                parsedVenueCoords.lng
                              )}`
                            : "-"}
                        </p>
                      </div>
                    )}
                  </div>

                  {result && (
                    <div className="result-summary">
                      <div>
                        <p className="label">Final Result</p>
                        <p className="value">{result}</p>
                      </div>
                    </div>
                  )}

                  {mode === MODE_VENUE && venueVerification && (
                    <div className={`venue-status ${venueVerification.status}`}>
                      <p className="venue-title">{venueVerification.label}</p>
                      <p>{venueVerification.summary}</p>
                      {venueVerification.detail && (
                        <p className="venue-detail">{venueVerification.detail}</p>
                      )}
                    </div>
                  )}

                  {showAnalysis && (
                    <div className="flag-list">
                      {analysis.map((reason, index) => (
                        <div key={`${reason}-${index}`} className="flag-item">
                          {reason}
                        </div>
                      ))}
                    </div>
                  )}

                  {showImageFlags && (
                    <div className="flag-list">
                      {imageSignals.flags.map((flag) => (
                        <div key={flag} className="flag-item">
                          {flag}
                        </div>
                      ))}
                    </div>
                  )}

                  {showNoFlags && (
                    <p className="photo-note">
                      No critical photo risk flags detected.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delay={180}>
          <section className="photo-section">
            <h2>Why Photo Checks Matter</h2>
            <div className="photo-grid">
              <div className="photo-info">
                <div className="photo-visual visual-shot">
                  <img
                    className="visual-img img-shot"
                    src="/images/photo-shot.jpg"
                    alt="Review screenshots"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                <h3>Trust Screenshots</h3>
                <p>
                  Low-resolution or edited screenshots often indicate copied
                  reviews or manipulated listings.
                </p>
                <button className="link-btn" onClick={() => navigate("/demo")}>
                  Review Examples
                </button>
              </div>
              <div className="photo-info">
                <div className="photo-visual visual-auth">
                  <img
                    className="visual-img img-auth"
                    src="/images/photo-auth.jpg"
                    alt="Visual authenticity"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                <h3>Venue Proof</h3>
                <p>
                  Live venue mode captures a real photo and browser GPS together,
                  which helps support hotel and restaurant review authenticity.
                </p>
                <button className="link-btn" onClick={() => handleModeChange(MODE_VENUE)}>
                  Try Venue Mode
                </button>
              </div>
              <div className="photo-info">
                <div className="photo-visual visual-fraud">
                  <img
                    className="visual-img img-fraud"
                    src="/images/photo-fraud.jpg"
                    alt="Fraud prevention"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                <h3>Fraud Prevention</h3>
                <p>
                  Image signals help catch re-used or fake review assets, while
                  venue verification adds an extra real-world consistency check.
                </p>
                <button className="link-btn" onClick={() => navigate("/demo")}>
                  Explore Signals
                </button>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </div>
    </div>
  );
}

export default PhotoReview;
