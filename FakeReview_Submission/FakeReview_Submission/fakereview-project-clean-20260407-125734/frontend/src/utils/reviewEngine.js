const detectLanguage = (text) => {
  const devanagari = (text.match(/[\u0900-\u097F]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;

  if (devanagari > 0 && latin > 0) return "Mixed";
  if (devanagari > 0) return "Hindi";
  if (latin > 0) return "English";
  return "Unknown";
};

const tokenize = (text, language) => {
  if (language === "Hindi" || language === "Mixed") {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\u0900-\u097F\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
};

const countMatches = (text, pattern) => (text.match(pattern) || []).length;

export const getReviewSignals = (rawText = "") => {
  const text = rawText.trim();
  if (!text) {
    return {
      language: "Unknown",
      wordCount: 0,
      charCount: 0,
      exclamations: 0,
      questionMarks: 0,
      capsWords: 0,
      uniqueRatio: 0,
      repeatedChars: 0
    };
  }

  const language = detectLanguage(text);
  const tokens = tokenize(text, language);
  const wordCount = tokens.length;
  const charCount = text.length;

  const exclamations = countMatches(rawText, /!/g);
  const questionMarks = countMatches(rawText, /\?/g);
  const capsWords = countMatches(rawText, /\b[A-Z]{3,}\b/g);
  const repeatedChars = countMatches(rawText, /(.)\1{3,}/g);
  const uniqueRatio = wordCount ? new Set(tokens).size / wordCount : 0;

  return {
    language,
    wordCount,
    charCount,
    exclamations,
    questionMarks,
    capsWords,
    uniqueRatio: Number(uniqueRatio.toFixed(2)),
    repeatedChars
  };
};
