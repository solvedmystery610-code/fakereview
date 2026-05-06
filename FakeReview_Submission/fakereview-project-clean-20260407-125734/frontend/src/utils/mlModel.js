let modelCache = null;
let trainingPromise = null;

const cleanText = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (text) =>
  cleanText(text)
    .split(" ")
    .filter((token) => token.length > 2);

const parseCsvLine = (line) => {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
};

const createCounter = () => Object.create(null);

export const trainModel = async ({
  maxRows = 5000,
  onProgress
} = {}) => {
  if (modelCache) return modelCache;
  if (trainingPromise) return trainingPromise;

  trainingPromise = (async () => {
    const response = await fetch(
      "/datasets/final_labeled_fake_reviews.csv"
    );

    if (!response.ok) {
      throw new Error("Dataset not found");
    }

    const raw = await response.text();
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      throw new Error("Dataset is empty");
    }

    const header = parseCsvLine(lines[0]);
    const textIndex = header.indexOf("text");
    const titleIndex = header.indexOf("title");
    const labelIndex = header.indexOf("label");

    if (textIndex === -1 || labelIndex === -1) {
      throw new Error("Dataset columns not found");
    }

    const fakeCounts = createCounter();
    const genuineCounts = createCounter();
    const vocabulary = new Set();
    let fakeDocs = 0;
    let genuineDocs = 0;
    let totalFakeWords = 0;
    let totalGenuineWords = 0;
    let processed = 0;

    for (let i = 1; i < lines.length && processed < maxRows; i += 1) {
      const row = parseCsvLine(lines[i]);
      if (!row.length) continue;

      const text = row[textIndex] || "";
      const title = titleIndex >= 0 ? row[titleIndex] || "" : "";
      const labelRaw = row[labelIndex];
      if (!text || labelRaw === undefined) continue;

      const label = Number(labelRaw) === 1 ? "Fake" : "Genuine";
      const tokens = tokenize(`${title} ${text}`);
      if (!tokens.length) continue;

      if (label === "Fake") {
        fakeDocs += 1;
      } else {
        genuineDocs += 1;
      }

      tokens.forEach((token) => {
        vocabulary.add(token);
        if (label === "Fake") {
          fakeCounts[token] = (fakeCounts[token] || 0) + 1;
          totalFakeWords += 1;
        } else {
          genuineCounts[token] = (genuineCounts[token] || 0) + 1;
          totalGenuineWords += 1;
        }
      });

      processed += 1;
      if (processed % 500 === 0 && onProgress) {
        onProgress(processed / maxRows);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const vocabSize = vocabulary.size || 1;
    modelCache = {
      fakeCounts,
      genuineCounts,
      totalFakeWords,
      totalGenuineWords,
      vocabSize,
      fakeDocs,
      genuineDocs
    };

    if (onProgress) onProgress(1);
    return modelCache;
  })();

  return trainingPromise;
};

export const predictWithModel = (text) => {
  if (!modelCache) return null;

  const tokens = tokenize(text);
  if (!tokens.length) return null;

  const {
    fakeCounts,
    genuineCounts,
    totalFakeWords,
    totalGenuineWords,
    vocabSize,
    fakeDocs,
    genuineDocs
  } = modelCache;

  const totalDocs = fakeDocs + genuineDocs || 1;
  const priorFake = Math.log((fakeDocs + 1) / (totalDocs + 2));
  const priorGenuine = Math.log((genuineDocs + 1) / (totalDocs + 2));

  let scoreFake = priorFake;
  let scoreGenuine = priorGenuine;

  tokens.forEach((token) => {
    const fakeCount = fakeCounts[token] || 0;
    const genuineCount = genuineCounts[token] || 0;
    scoreFake += Math.log(
      (fakeCount + 1) / (totalFakeWords + vocabSize)
    );
    scoreGenuine += Math.log(
      (genuineCount + 1) / (totalGenuineWords + vocabSize)
    );
  });

  const diff = scoreGenuine - scoreFake;
  const probFake = 1 / (1 + Math.exp(diff));
  const probGenuine = 1 - probFake;
  const confidence = Math.round(Math.max(probFake, probGenuine) * 100);

  return {
    probFake,
    probGenuine,
    label: probFake >= 0.5 ? "Fake" : "Genuine",
    confidence
  };
};
