import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ScrollReveal from "../components/ScrollReveal";
import { fetchJson } from "../utils/api";
import "./BatchAnalyzer.css";

const MAX_BATCH_REVIEWS = 1000;
const REVIEW_COLUMNS = ["review", "text", "content", "body", "comment"];
const LABEL_COLUMNS = ["label", "expected", "actual", "class", "target"];
const RATING_COLUMNS = ["rating", "stars", "score"];

const sanitizeReview = (value) => (value || "").replace(/\s+/g, " ").trim();

const normalizeLabel = (value) => {
  const normalized = sanitizeReview(value).toLowerCase();
  if (!normalized) {
    return null;
  }
  if (["fake", "fraud", "spam"].includes(normalized)) {
    return "Fake";
  }
  if (["genuine", "real", "authentic", "legit"].includes(normalized)) {
    return "Genuine";
  }
  return null;
};

const truncateReview = (review, maxLength = 180) => {
  const clean = sanitizeReview(review);
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, maxLength - 1).trim()}...`;
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter((columns) => columns.some((item) => String(item).trim()));
};

const findColumnIndex = (header, candidates) =>
  header.findIndex((name) => candidates.includes(name));

const extractRowsFromCsv = (text) => {
  const rows = parseCsv(text);
  if (!rows.length) {
    return [];
  }

  const header = rows[0].map((cell) => sanitizeReview(cell).toLowerCase());
  const reviewIndex = findColumnIndex(header, REVIEW_COLUMNS);
  const labelIndex = findColumnIndex(header, LABEL_COLUMNS);
  const ratingIndex = findColumnIndex(header, RATING_COLUMNS);

  const hasHeader = reviewIndex >= 0 || labelIndex >= 0 || ratingIndex >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const reviewColumn = reviewIndex >= 0 ? reviewIndex : 0;

  return dataRows
    .map((columns) => ({
      review: sanitizeReview(columns[reviewColumn]),
      label: labelIndex >= 0 ? normalizeLabel(columns[labelIndex]) : null,
      rating: ratingIndex >= 0 ? sanitizeReview(columns[ratingIndex]) : "",
    }))
    .filter((item) => item.review);
};

const extractRowsFromText = (text) =>
  (text || "")
    .split(/\r?\n/)
    .map((line) => sanitizeReview(line))
    .filter(Boolean)
    .map((review) => ({
      review,
      label: null,
      rating: "",
    }));

const buildPredictionSummary = (results) => {
  const fake = results.filter((item) => item.status === "Fake").length;
  const genuine = results.filter((item) => item.status === "Genuine").length;
  const avgConfidence = results.length
    ? Math.round(
        results.reduce((sum, item) => sum + (item.confidence || 0), 0) / results.length
      )
    : 0;

  return {
    total: results.length,
    fake,
    genuine,
    avgConfidence,
  };
};

const buildDatasetSummary = (rows) => {
  const labeled = rows.filter((item) => item.label);
  const fake = labeled.filter((item) => item.label === "Fake").length;
  const genuine = labeled.filter((item) => item.label === "Genuine").length;

  return {
    total: rows.length,
    labeled: labeled.length,
    fake,
    genuine,
  };
};

const buildEvaluationSummary = (rows, results) => {
  if (!rows.length || !results.length) {
    return null;
  }

  let comparable = 0;
  let matches = 0;

  results.forEach((result, index) => {
    const expected = rows[index]?.label;
    if (!expected) {
      return;
    }
    comparable += 1;
    if (expected === result.status) {
      matches += 1;
    }
  });

  if (!comparable) {
    return null;
  }

  return {
    comparable,
    matches,
    accuracy: Math.round((matches / comparable) * 100),
  };
};

function BatchAnalyzer() {
  const navigate = useNavigate();
  const [queuedReviews, setQueuedReviews] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [serverSummary, setServerSummary] = useState(null);

  const datasetSummary = useMemo(() => buildDatasetSummary(queuedReviews), [queuedReviews]);
  const predictionSummary = useMemo(() => {
    const fallback = buildPredictionSummary(results);
    if (!serverSummary) {
      return fallback;
    }
    return {
      total: serverSummary.total ?? fallback.total,
      fake: serverSummary.fake ?? fallback.fake,
      genuine: serverSummary.genuine ?? fallback.genuine,
      avgConfidence:
        serverSummary.avgConfidence ?? serverSummary.avg_confidence ?? fallback.avgConfidence,
    };
  }, [results, serverSummary]);
  const evaluationSummary = useMemo(
    () => buildEvaluationSummary(queuedReviews, results),
    [queuedReviews, results]
  );

  const comparisonNote = useMemo(() => {
    if (!datasetSummary.labeled || !predictionSummary.total) {
      return "";
    }

    const fakeGap = predictionSummary.fake - datasetSummary.fake;
    const genuineGap = predictionSummary.genuine - datasetSummary.genuine;
    if (Math.abs(fakeGap) < 25 && Math.abs(genuineGap) < 25) {
      return "The model prediction is fairly close to the label balance in this dataset.";
    }

    if (fakeGap > 0) {
      return `This CSV is balanced, but the current model is leaning fake on this run: predicted ${predictionSummary.fake} fake vs labeled ${datasetSummary.fake}.`;
    }

    return `This CSV is balanced, but the current model is leaning genuine on this run: predicted ${predictionSummary.genuine} genuine vs labeled ${datasetSummary.genuine}.`;
  }, [datasetSummary, predictionSummary]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setResults([]);
    setServerSummary(null);
    setProgress(0);
    setFileName(file.name);

    try {
      const text = await file.text();
      const rows = file.name.toLowerCase().endsWith(".csv")
        ? extractRowsFromCsv(text)
        : extractRowsFromText(text);

      const limitedRows = rows.slice(0, MAX_BATCH_REVIEWS);
      setQueuedReviews(limitedRows);

      if (!limitedRows.length) {
        setError("That file did not contain any readable review rows.");
      } else if (rows.length > MAX_BATCH_REVIEWS) {
        setError(`Only the first ${MAX_BATCH_REVIEWS} reviews were loaded for this run.`);
      }
    } catch (issue) {
      setQueuedReviews([]);
      setFileName("");
      setError(issue.message || "Could not read that file.");
    }
  };

  const clearLoadedData = () => {
    setQueuedReviews([]);
    setFileName("");
    setResults([]);
    setServerSummary(null);
    setError("");
    setProgress(0);
  };

  const runBatchAnalysis = async () => {
    if (!queuedReviews.length) {
      setError("Upload a CSV or TXT file first.");
      return;
    }

    setLoading(true);
    setProgress(12);
    setError("");
    setResults([]);
    setServerSummary(null);

    try {
      const payload = queuedReviews.slice(0, MAX_BATCH_REVIEWS).map((item) => ({
        review: item.review,
        rating: item.rating,
      }));

      const data = await fetchJson("/analyze-batch", {
        method: "POST",
        body: JSON.stringify({
          reviews: payload,
          username: localStorage.getItem("username") || "guest",
          persist: false,
        }),
      });

      setProgress(88);
      const output = (data.results || []).map((item, index) => ({
        id: item.id || index + 1,
        review: item.review,
        expectedLabel: queuedReviews[index]?.label || null,
        status: item.status || item.result || "Unknown",
        confidence: item.confidence || 0,
        sentiment: item.sentiment || "Neutral",
        reasons: (item.reasons || item.analysis || []).slice(0, 1),
        probFake: item.prob_fake,
      }));

      setResults(output);
      setServerSummary(data.summary || null);
      setProgress(100);
    } catch (issue) {
      setError(issue.message || "Batch analysis failed.");
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const exportResults = () => {
    if (!results.length) {
      return;
    }

    const header = [
      "id",
      "expected_label",
      "predicted_label",
      "confidence",
      "sentiment",
      "prob_fake",
      "review",
      "highlight",
    ];
    const lines = results.map((item) =>
      [
        item.id,
        item.expectedLabel || "",
        item.status,
        item.confidence,
        item.sentiment,
        item.probFake,
        item.review,
        item.reasons[0] || "",
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    );

    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `batch-review-analysis-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="batch-page">
      <div className="batch-shell">
        <ScrollReveal>
          <header className="batch-hero">
            <div>
              <p className="batch-kicker">Batch Review Analyzer</p>
              <h1>Evaluate A Whole Review Dataset In One Run</h1>
              <p className="batch-subtitle">
                Upload a CSV or TXT dataset, run server-side analysis, and compare the model
                prediction against your dataset balance in a cleaner review lab.
              </p>
              <div className="batch-actions">
                <button
                  className="batch-primary"
                  onClick={runBatchAnalysis}
                  disabled={loading || !queuedReviews.length}
                >
                  {loading ? "Analyzing Dataset..." : "Analyze Dataset"}
                </button>
                <button className="batch-secondary" onClick={() => navigate("/analyzer")}>
                  Open Single Analyzer
                </button>
              </div>
            </div>

            <div className="batch-hero-card">
              <h3>Best Use Case</h3>
              <ul>
                <li>CSV datasets with `Review`, `Rating`, and `label` columns</li>
                <li>Balanced evaluation files where you want prediction vs ground truth</li>
                <li>Up to 1000 reviews per run with backend batch scoring</li>
              </ul>
            </div>
          </header>
        </ScrollReveal>

        <ScrollReveal delay={90}>
          <section className="batch-grid">
            <div className="batch-card">
              <div className="batch-head">
                <h2>Dataset Intake</h2>
                <span className="batch-chip">{fileName || "No dataset loaded"}</span>
              </div>

              <div className="drop-card">
                <div className="drop-copy">
                  <strong>Upload review dataset</strong>
                  <p>Choose a CSV or TXT file. If your CSV has a `label` column, we will compare expected vs predicted output.</p>
                </div>

                <div className="batch-upload-row">
                  <input type="file" accept=".txt,.csv" onChange={handleFileChange} />
                  <button
                    className="batch-primary"
                    onClick={runBatchAnalysis}
                    type="button"
                    disabled={loading || !queuedReviews.length}
                  >
                    {loading ? "Running..." : "Analyze Loaded File"}
                  </button>
                  <button className="batch-secondary" onClick={clearLoadedData} type="button">
                    Clear
                  </button>
                </div>
              </div>

              {error && <div className="batch-error">{error}</div>}

              <div className="intake-grid">
                <div className="intake-item">
                  <p className="summary-label">Loaded Reviews</p>
                  <p className="summary-value">{datasetSummary.total}</p>
                </div>
                <div className="intake-item">
                  <p className="summary-label">Labeled Rows</p>
                  <p className="summary-value">{datasetSummary.labeled}</p>
                </div>
                <div className="intake-item">
                  <p className="summary-label">Dataset Fake</p>
                  <p className="summary-value">{datasetSummary.fake}</p>
                </div>
                <div className="intake-item">
                  <p className="summary-label">Dataset Genuine</p>
                  <p className="summary-value">{datasetSummary.genuine}</p>
                </div>
              </div>

              <div className="batch-progress">
                <div className="batch-progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <p className="batch-note">
                {loading
                  ? `Progress: ${progress}% - server-side batch scoring in progress.`
                  : results.length
                    ? `${results.length} reviews processed in the latest run.`
                    : queuedReviews.length
                      ? `${queuedReviews.length} reviews loaded and ready.`
                      : "Upload a dataset to begin."}
              </p>
            </div>

            <div className="batch-card">
              <div className="batch-head">
                <h2>Run Summary</h2>
                <span className="batch-chip">Prediction vs Labels</span>
              </div>

              <div className="batch-summary-grid">
                <div className="batch-summary-item emphasis">
                  <p className="summary-label">Predicted Fake</p>
                  <p className="summary-value">{predictionSummary.fake}</p>
                </div>
                <div className="batch-summary-item emphasis">
                  <p className="summary-label">Predicted Genuine</p>
                  <p className="summary-value">{predictionSummary.genuine}</p>
                </div>
                <div className="batch-summary-item">
                  <p className="summary-label">Avg Confidence</p>
                  <p className="summary-value">{predictionSummary.avgConfidence}%</p>
                </div>
                <div className="batch-summary-item">
                  <p className="summary-label">Label Match</p>
                  <p className="summary-value">
                    {evaluationSummary ? `${evaluationSummary.accuracy}%` : "-"}
                  </p>
                </div>
              </div>

              {comparisonNote && <div className="comparison-note">{comparisonNote}</div>}

              <button
                className="batch-primary full-btn"
                type="button"
                onClick={exportResults}
                disabled={!results.length}
              >
                Export CSV
              </button>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <section className="batch-card">
            <div className="batch-head">
              <h2>Batch Results</h2>
              <span className="batch-chip">Professional Review Grid</span>
            </div>

            {!results.length ? (
              <p className="batch-note">
                No results yet. Upload a dataset and run analysis to see predicted label, expected label, and top evidence per review.
              </p>
            ) : (
              <div className="batch-table-wrap">
                <table className="batch-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Review Snapshot</th>
                      <th>Expected</th>
                      <th>Predicted</th>
                      <th>Match</th>
                      <th>Confidence</th>
                      <th>Top Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((item) => {
                      const matched = item.expectedLabel ? item.expectedLabel === item.status : null;

                      return (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td className="review-cell">
                            <div className="review-snippet">{truncateReview(item.review)}</div>
                          </td>
                          <td>
                            {item.expectedLabel ? (
                              <span
                                className={`table-pill ${item.expectedLabel === "Fake" ? "fake" : "genuine"}`}
                              >
                                {item.expectedLabel}
                              </span>
                            ) : (
                              <span className="table-muted">Unlabeled</span>
                            )}
                          </td>
                          <td>
                            <span className={`table-pill ${item.status === "Fake" ? "fake" : "genuine"}`}>
                              {item.status}
                            </span>
                          </td>
                          <td>
                            {matched === null ? (
                              <span className="table-muted">-</span>
                            ) : (
                              <span className={`match-pill ${matched ? "match" : "mismatch"}`}>
                                {matched ? "Match" : "Mismatch"}
                              </span>
                            )}
                          </td>
                          <td>{item.confidence}%</td>
                          <td>
                            <span className="reason-mini">
                              {item.reasons[0] || "No highlight returned for this row."}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </ScrollReveal>
      </div>
    </div>
  );
}

export default BatchAnalyzer;
