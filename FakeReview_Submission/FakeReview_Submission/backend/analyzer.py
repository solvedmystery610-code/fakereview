import csv
import hashlib
import logging
import os
import re
import threading
from collections import Counter, deque
from datetime import datetime

try:
    import numpy as np
    from scipy import sparse
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score, confusion_matrix, precision_score, recall_score
    from sklearn.model_selection import GroupShuffleSplit
    SKLEARN_IMPORT_ERROR = None
except Exception as exc:
    np = None
    sparse = None
    TfidfVectorizer = None
    LogisticRegression = None
    accuracy_score = None
    confusion_matrix = None
    precision_score = None
    recall_score = None
    GroupShuffleSplit = None
    SKLEARN_IMPORT_ERROR = str(exc)


BASE_DIR = os.path.dirname(__file__)
DATASET_CANDIDATES = [
    os.environ.get("FAKEREVIEW_DATASET_PATH"),
    os.path.join(BASE_DIR, "..", "frontend", "public", "datasets", "final_labeled_fake_reviews.csv"),
    os.path.join(BASE_DIR, "datasets", "final_labeled_fake_reviews.csv"),
]

MAX_TRAIN_ROWS = int(os.environ.get("FAKEREVIEW_TRAIN_ROWS", "50000"))
WORD_MAX_FEATURES = int(os.environ.get("FAKEREVIEW_WORD_MAX_FEATURES", "80000"))
CHAR_MAX_FEATURES = int(os.environ.get("FAKEREVIEW_CHAR_MAX_FEATURES", "80000"))
MIN_DF = int(os.environ.get("FAKEREVIEW_MIN_DF", "5"))
LOGREG_C = float(os.environ.get("FAKEREVIEW_LOGREG_C", "4.0"))
MAX_ITER = int(os.environ.get("FAKEREVIEW_MAX_ITER", "1500"))
SEED = int(os.environ.get("FAKEREVIEW_SEED", "42"))

TOKEN_RE = re.compile(r"[a-zA-Z0-9']+")
REPEATED_CHAR_RE = re.compile(r"(.)\1{3,}")
DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
LATIN_RE = re.compile(r"[a-zA-Z]")
SENTENCE_SPLIT_RE = re.compile(r"[.!?]+")


def _dataset_path():
    for path in DATASET_CANDIDATES:
        if path and os.path.exists(path):
            return path
    return None


def normalize_text(text):
    cleaned = " ".join(TOKEN_RE.findall((text or "").lower()))
    return cleaned.strip()


def tokenize(text):
    tokens = TOKEN_RE.findall((text or "").lower())
    return [token for token in tokens if len(token) >= 3]


def split_sentences(text):
    return [part.strip() for part in SENTENCE_SPLIT_RE.split(text or "") if part.strip()]


def build_ngrams(tokens):
    bigrams = [f"{tokens[i]} {tokens[i + 1]}" for i in range(len(tokens) - 1)]
    return tokens + bigrams


def detect_language(text):
    devanagari = len(DEVANAGARI_RE.findall(text or ""))
    latin = len(LATIN_RE.findall(text or ""))
    if devanagari and latin:
        return "Mixed"
    if devanagari:
        return "Hindi"
    if latin:
        return "English"
    return "Unknown"


def clamp(value, min_value, max_value):
    return max(min_value, min(max_value, value))


def compute_simhash(text):
    tokens = tokenize(text)
    if not tokens:
        return 0
    features = build_ngrams(tokens)
    weights = [0] * 64
    for token in features:
        digest = hashlib.md5(token.encode("utf-8")).hexdigest()[:16]
        bits = int(digest, 16)
        for index in range(64):
            if bits & (1 << index):
                weights[index] += 1
            else:
                weights[index] -= 1
    fingerprint = 0
    for index in range(64):
        if weights[index] > 0:
            fingerprint |= 1 << index
    return fingerprint


def hamming_distance(first, second):
    return (first ^ second).bit_count()


def simhash_bands(simhash_value):
    if not simhash_value:
        return []
    bands = []
    for index in range(4):
        chunk = (simhash_value >> (index * 16)) & 0xFFFF
        bands.append(f"{chunk:04x}")
    return bands


class TfidfLinearModel:
    def __init__(self, dataset_path, max_rows=MAX_TRAIN_ROWS):
        self.dataset_path = dataset_path
        self.max_rows = max_rows
        self.version = "tfidf-word-char-logreg-v4"
        self.word_vectorizer = None
        self.char_vectorizer = None
        self.classifier = None
        self.meta_classifier = None
        self.decision_threshold = 0.5
        self.generic_idf_threshold = None
        self.word_feature_names = []
        self.top_fake_tokens = set()
        self.top_genuine_tokens = set()
        self.sentiment_weights = {}
        self.metrics = {}
        self.training_summary = {}
        self.ready = False
        self.error = None
        self._train()

    def _load_rows(self):
        rows = []
        with open(self.dataset_path, newline="", encoding="utf-8", errors="ignore") as handle:
            reader = csv.DictReader(handle)
            processed = 0
            for row in reader:
                if processed >= self.max_rows:
                    break
                title = (row.get("title") or "").strip()
                text = (row.get("text") or "").strip()
                combined = f"{title} {text}".strip()
                if not combined:
                    continue
                label_raw = row.get("label")
                if label_raw is None:
                    continue
                rating_raw = row.get("rating")
                try:
                    rating_value = float(rating_raw) if rating_raw not in (None, "") else 0.0
                except ValueError:
                    rating_value = 0.0
                rows.append({
                    "text": combined,
                    "label": 1 if str(label_raw).strip() == "1" else 0,
                    "group": row.get("parent_asin") or row.get("asin") or row.get("user_id") or f"row-{processed}",
                    "rating": rating_value,
                })
                processed += 1
        return rows

    def _split_rows(self, rows):
        texts = np.array([row["text"] for row in rows])
        labels = np.array([row["label"] for row in rows])
        groups = np.array([row["group"] for row in rows])

        try:
            first_split = GroupShuffleSplit(n_splits=1, test_size=0.15, random_state=SEED)
            train_idx, test_idx = next(first_split.split(texts, labels, groups))
            second_split = GroupShuffleSplit(n_splits=1, test_size=0.1667, random_state=SEED)
            train_sub_idx, calib_sub_idx = next(second_split.split(texts[train_idx], labels[train_idx], groups[train_idx]))
            final_train = train_idx[train_sub_idx]
            final_calib = train_idx[calib_sub_idx]
            train_rows = [rows[index] for index in final_train]
            calib_rows = [rows[index] for index in final_calib]
            test_rows = [rows[index] for index in test_idx]
            return train_rows, calib_rows, test_rows
        except Exception:
            rng = np.random.default_rng(SEED)
            indices = np.arange(len(rows))
            rng.shuffle(indices)
            train_cut = int(len(indices) * 0.7)
            calib_cut = int(len(indices) * 0.85)
            train_rows = [rows[index] for index in indices[:train_cut]]
            calib_rows = [rows[index] for index in indices[train_cut:calib_cut]]
            test_rows = [rows[index] for index in indices[calib_cut:]]
            return train_rows, calib_rows, test_rows

    def _texts(self, rows):
        return [row["text"] for row in rows]

    def _labels(self, rows):
        return np.array([row["label"] for row in rows])

    def _fit_vectorizers(self, train_rows):
        self.word_vectorizer = TfidfVectorizer(
            analyzer="word",
            ngram_range=(1, 2),
            min_df=MIN_DF,
            max_features=WORD_MAX_FEATURES,
            sublinear_tf=True,
            strip_accents="unicode",
        )
        self.char_vectorizer = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(3, 5),
            min_df=MIN_DF,
            max_features=CHAR_MAX_FEATURES,
            sublinear_tf=True,
        )
        texts = self._texts(train_rows)
        word_matrix = self.word_vectorizer.fit_transform(texts)
        char_matrix = self.char_vectorizer.fit_transform(texts)
        self.word_feature_names = self.word_vectorizer.get_feature_names_out().tolist()
        return sparse.hstack([word_matrix, char_matrix]).tocsr()

    def _transform_texts(self, texts):
        if not texts:
            return sparse.csr_matrix((0, 0))
        word_matrix = self.word_vectorizer.transform(texts)
        char_matrix = self.char_vectorizer.transform(texts)
        return sparse.hstack([word_matrix, char_matrix]).tocsr()

    def _build_sentiment_weights(self, train_rows):
        positive_counts = Counter()
        negative_counts = Counter()
        total_positive = 0
        total_negative = 0
        for row in train_rows:
            tokens = tokenize(row["text"])
            if row["rating"] >= 4:
                for token in tokens:
                    positive_counts[token] += 1
                    total_positive += 1
            elif 0 < row["rating"] <= 2:
                for token in tokens:
                    negative_counts[token] += 1
                    total_negative += 1
        vocab = set(positive_counts) | set(negative_counts)
        if not vocab:
            self.sentiment_weights = {}
            return
        vocab_size = len(vocab)
        total_positive += vocab_size
        total_negative += vocab_size
        weights = {}
        for token in vocab:
            pos = (positive_counts.get(token, 0) + 1) / total_positive
            neg = (negative_counts.get(token, 0) + 1) / total_negative
            weights[token] = float(np.log(pos) - np.log(neg))
        self.sentiment_weights = weights

    def _build_explanation_tokens(self):
        if not self.word_feature_names or self.classifier is None:
            return
        coefficients = self.classifier.coef_[0][: len(self.word_feature_names)]
        scored = list(zip(self.word_feature_names, coefficients))
        scored.sort(key=lambda item: item[1], reverse=True)
        self.top_fake_tokens = {token for token, score in scored[:150] if score > 0}
        scored.sort(key=lambda item: item[1])
        self.top_genuine_tokens = {token for token, score in scored[:150] if score < 0}

    def _compute_generic_threshold(self, train_rows):
        scores = []
        for row in train_rows[:5000]:
            average = self.average_idf(row["text"])
            if average is not None:
                scores.append(average)
        if len(scores) >= 20:
            self.generic_idf_threshold = float(np.percentile(scores, 30))

    def sentiment_score(self, text):
        if not self.sentiment_weights:
            return 0.0
        scores = [self.sentiment_weights[token] for token in tokenize(text) if token in self.sentiment_weights]
        if not scores:
            return 0.0
        return float(sum(scores) / len(scores))

    def structural_feature_vector(self, text):
        tokens = tokenize(text)
        word_count = len(tokens)
        unique_ratio = len(set(tokens)) / word_count if word_count else 0.0
        sentence_count = len(split_sentences(text))
        numeric_hits = len(re.findall(r"\b\d+(?:\.\d+)?\b", text or ""))
        exclamations = (text or "").count("!")
        question_marks = (text or "").count("?")
        caps_words = len(re.findall(r"\b[A-Z]{3,}\b", text or ""))
        repeated_chars = len(REPEATED_CHAR_RE.findall(text or ""))
        avg_token_length = sum(len(token) for token in tokens) / word_count if word_count else 0.0
        long_token_ratio = sum(1 for token in tokens if len(token) >= 7) / word_count if word_count else 0.0
        repeated_bigrams = 0
        if len(tokens) > 1:
            bigram_counts = Counter(f"{tokens[index]} {tokens[index + 1]}" for index in range(len(tokens) - 1))
            repeated_bigrams = sum(1 for count in bigram_counts.values() if count >= 2)

        tracked_tokens = 0
        if self.word_vectorizer:
            vocab = self.word_vectorizer.vocabulary_ or {}
            tracked_tokens = sum(1 for token in tokens if token in vocab)
        tracked_ratio = tracked_tokens / word_count if word_count else 0.0
        average_idf = self.average_idf(text) or 0.0

        return [
            float(word_count),
            float(unique_ratio),
            float(sentence_count),
            float(numeric_hits),
            float(exclamations),
            float(question_marks),
            float(caps_words),
            float(repeated_chars),
            float(avg_token_length),
            float(long_token_ratio),
            float(repeated_bigrams),
            float(tracked_ratio),
            float(average_idf),
            float(self.sentiment_score(text)),
        ]

    def _structural_feature_matrix(self, texts):
        return np.array([self.structural_feature_vector(text) for text in texts], dtype=float)

    def _fit_meta_classifier(self, calib_rows):
        if not calib_rows:
            self.meta_classifier = None
            return

        labels = self._labels(calib_rows)
        if len(set(labels.tolist())) < 2:
            self.meta_classifier = None
            return

        base_probabilities = self.predict_base_batch_proba(self._texts(calib_rows))
        structural = self._structural_feature_matrix(self._texts(calib_rows))
        meta_features = np.column_stack([base_probabilities, structural])

        meta_classifier = LogisticRegression(max_iter=5000, C=2.0, solver="liblinear")
        meta_classifier.fit(meta_features, labels)
        self.meta_classifier = meta_classifier

    def predict_base_batch_proba(self, texts):
        if self.classifier is None or self.word_vectorizer is None or self.char_vectorizer is None:
            return np.array([0.5] * len(texts), dtype=float)
        matrix = self._transform_texts(texts)
        if matrix.shape[0] == 0:
            return np.array([0.5] * len(texts), dtype=float)
        return self.classifier.predict_proba(matrix)[:, 1]

    def predict_batch_proba(self, texts):
        base_probabilities = self.predict_base_batch_proba(texts)
        if self.meta_classifier is None or not texts:
            return base_probabilities
        structural = self._structural_feature_matrix(texts)
        meta_features = np.column_stack([base_probabilities, structural])
        return self.meta_classifier.predict_proba(meta_features)[:, 1]

    def predict_fake_probability(self, text):
        if not text:
            return 0.5
        return float(self.predict_batch_proba([text])[0])

    def predict_base_probability(self, text):
        if not text:
            return 0.5
        return float(self.predict_base_batch_proba([text])[0])

    def average_idf(self, text):
        if not self.word_vectorizer:
            return None
        tokens = tokenize(text)
        if not tokens:
            return None
        values = []
        vocab = self.word_vectorizer.vocabulary_ or {}
        idf = self.word_vectorizer.idf_
        for token in tokens:
            index = vocab.get(token)
            if index is not None:
                values.append(idf[index])
        if not values:
            return None
        return float(sum(values) / len(values))

    def generic_token_ratio(self, text):
        if self.generic_idf_threshold is None or not self.word_vectorizer:
            return None
        tokens = tokenize(text)
        if not tokens:
            return None
        tracked = 0
        generic = 0
        vocab = self.word_vectorizer.vocabulary_ or {}
        idf = self.word_vectorizer.idf_
        for token in tokens:
            index = vocab.get(token)
            if index is None:
                continue
            tracked += 1
            if idf[index] <= self.generic_idf_threshold:
                generic += 1
        if tracked == 0:
            return None
        return generic / tracked

    def predict_sentiment(self, text, rating_value):
        rating_sentiment = "Neutral"
        if rating_value >= 4:
            rating_sentiment = "Positive"
        elif 0 < rating_value <= 2:
            rating_sentiment = "Negative"
        if not self.sentiment_weights:
            return rating_sentiment
        scores = [self.sentiment_weights[token] for token in tokenize(text) if token in self.sentiment_weights]
        if not scores:
            return rating_sentiment
        average = sum(scores) / len(scores)
        if average > 0.12:
            return "Positive"
        if average < -0.12:
            return "Negative"
        return "Neutral"

    def _select_threshold(self, calib_rows):
        if not calib_rows:
            self.decision_threshold = 0.5
            return
        labels = self._labels(calib_rows)
        probabilities = self.predict_batch_proba(self._texts(calib_rows))
        best_threshold = 0.5
        best_score = -1.0
        for value in range(35, 66):
            threshold = value / 100.0
            predicted = (probabilities >= threshold).astype(int)
            tp = int(((predicted == 1) & (labels == 1)).sum())
            tn = int(((predicted == 0) & (labels == 0)).sum())
            fp = int(((predicted == 1) & (labels == 0)).sum())
            fn = int(((predicted == 0) & (labels == 1)).sum())
            tpr = tp / (tp + fn) if (tp + fn) else 0.0
            tnr = tn / (tn + fp) if (tn + fp) else 0.0
            score = (tpr + tnr) / 2
            if score > best_score:
                best_score = score
                best_threshold = threshold
        self.decision_threshold = best_threshold

    def _evaluate_rows(self, rows):
        if not rows:
            return {
                "samples": 0,
                "accuracy": None,
                "precision": None,
                "recall": None,
                "confusion_matrix": {"tp": 0, "tn": 0, "fp": 0, "fn": 0},
            }
        labels = self._labels(rows)
        probabilities = self.predict_batch_proba(self._texts(rows))
        predicted = (probabilities >= self.decision_threshold).astype(int)
        tn, fp, fn, tp = confusion_matrix(labels, predicted, labels=[0, 1]).ravel()
        return {
            "samples": int(len(rows)),
            "accuracy": round(float(accuracy_score(labels, predicted)), 4),
            "precision": round(float(precision_score(labels, predicted, zero_division=0)), 4),
            "recall": round(float(recall_score(labels, predicted, zero_division=0)), 4),
            "confusion_matrix": {"tp": int(tp), "tn": int(tn), "fp": int(fp), "fn": int(fn)},
        }

    def _train(self):
        if SKLEARN_IMPORT_ERROR:
            self.error = f"Model dependencies missing: {SKLEARN_IMPORT_ERROR}"
            self.ready = False
            return
        try:
            rows = self._load_rows()
            if not rows:
                self.error = "Dataset is empty"
                self.ready = False
                return
            train_rows, calib_rows, test_rows = self._split_rows(rows)
            if not train_rows or not calib_rows or not test_rows:
                self.error = "Dataset split failed"
                self.ready = False
                return
            train_matrix = self._fit_vectorizers(train_rows)
            train_labels = self._labels(train_rows)
            self.classifier = LogisticRegression(max_iter=MAX_ITER, C=LOGREG_C, solver="liblinear")
            self.classifier.fit(train_matrix, train_labels)
            self._build_sentiment_weights(train_rows)
            self._build_explanation_tokens()
            self._compute_generic_threshold(train_rows)
            self._fit_meta_classifier(calib_rows)
            if self.meta_classifier is None:
                self._select_threshold(calib_rows)
            else:
                self.decision_threshold = 0.5
            self.metrics = {
                "threshold": round(float(self.decision_threshold), 4),
                "train": self._evaluate_rows(train_rows[: min(len(train_rows), 6000)]),
                "calibration": self._evaluate_rows(calib_rows),
                "test": self._evaluate_rows(test_rows),
            }
            self.training_summary = {
                "dataset_path": self.dataset_path,
                "rows_loaded": len(rows),
                "train_samples": len(train_rows),
                "calibration_samples": len(calib_rows),
                "test_samples": len(test_rows),
                "word_features": len(self.word_feature_names),
                "char_features": len(self.char_vectorizer.get_feature_names_out()),
                "meta_enabled": self.meta_classifier is not None,
                "max_rows": self.max_rows,
                "min_df": MIN_DF,
                "trained_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "version": self.version,
            }
            self.ready = True
            self.error = None
        except Exception as exc:
            self.error = str(exc)
            self.ready = False


_MODEL = None
_MODEL_TRAINING = False
_MODEL_TRAINING_THREAD = None
_MODEL_TRAINING_SINCE = None
_MODEL_TRAINING_ERROR = None
_DATASET_MISSING_LOGGED = False
_MODEL_TRAINING_HISTORY = deque(maxlen=25)


def warm_model_async():
    global _MODEL
    global _MODEL_TRAINING
    global _MODEL_TRAINING_THREAD
    global _DATASET_MISSING_LOGGED
    global _MODEL_TRAINING_SINCE
    global _MODEL_TRAINING_ERROR

    if _MODEL is not None and _MODEL.ready:
        return
    if _MODEL_TRAINING:
        return
    path = _dataset_path()
    if not path:
        if not _DATASET_MISSING_LOGGED:
            logging.warning("Dataset not found for model training; falling back to rule-based scoring.")
            _DATASET_MISSING_LOGGED = True
        return

    def _train():
        global _MODEL
        global _MODEL_TRAINING
        global _MODEL_TRAINING_THREAD
        global _MODEL_TRAINING_SINCE
        global _MODEL_TRAINING_ERROR

        start_time = datetime.now()
        logging.info(
            "Model training started (path=%s, rows=%s, word_features=%s, char_features=%s)",
            path,
            MAX_TRAIN_ROWS,
            WORD_MAX_FEATURES,
            CHAR_MAX_FEATURES,
        )
        try:
            model = TfidfLinearModel(path)
            _MODEL = model
            elapsed = round((datetime.now() - start_time).total_seconds(), 2)
            if not model.ready:
                _MODEL_TRAINING_ERROR = model.error or "Model training failed"
                logging.warning("Model training failed: %s", _MODEL_TRAINING_ERROR)
                _MODEL_TRAINING_HISTORY.appendleft({
                    "status": "failed",
                    "started_at": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "finished_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "duration_seconds": elapsed,
                    "error": _MODEL_TRAINING_ERROR,
                    "dataset_path": path,
                })
            else:
                _MODEL_TRAINING_ERROR = None
                logging.info("Model training complete in %.2fs", elapsed)
                _MODEL_TRAINING_HISTORY.appendleft({
                    "status": "completed",
                    "started_at": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "finished_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "duration_seconds": elapsed,
                    "error": None,
                    "dataset_path": path,
                    "version": model.version,
                })
        except Exception as exc:
            _MODEL = None
            _MODEL_TRAINING_ERROR = str(exc)
            logging.exception("Model training crashed: %s", exc)
            _MODEL_TRAINING_HISTORY.appendleft({
                "status": "crashed",
                "started_at": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "finished_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "duration_seconds": round((datetime.now() - start_time).total_seconds(), 2),
                "error": str(exc),
                "dataset_path": path,
            })
        finally:
            _MODEL_TRAINING = False
            _MODEL_TRAINING_THREAD = None
            _MODEL_TRAINING_SINCE = None

    _MODEL_TRAINING = True
    _MODEL_TRAINING_SINCE = datetime.now()
    _MODEL_TRAINING_ERROR = None
    _MODEL_TRAINING_THREAD = threading.Thread(target=_train, daemon=True)
    _MODEL_TRAINING_THREAD.start()


def get_model():
    global _MODEL
    global _DATASET_MISSING_LOGGED
    global _MODEL_TRAINING_ERROR
    if _MODEL is not None:
        return _MODEL if _MODEL.ready else None
    if _MODEL_TRAINING:
        return None
    path = _dataset_path()
    if not path:
        if not _DATASET_MISSING_LOGGED:
            logging.warning("Dataset not found for model training; falling back to rule-based scoring.")
            _DATASET_MISSING_LOGGED = True
        return None
    model = TfidfLinearModel(path)
    _MODEL = model
    _MODEL_TRAINING_ERROR = model.error if not model.ready else None
    return model if model.ready else None


def get_model_status():
    global _DATASET_MISSING_LOGGED
    path = _dataset_path()
    if not path:
        if not _DATASET_MISSING_LOGGED:
            logging.warning("Dataset not found for model training; falling back to rule-based scoring.")
            _DATASET_MISSING_LOGGED = True
        return {
            "ready": False,
            "model": "rule_fallback",
            "error": "Dataset not found",
            "dataset_path": None,
        }
    if SKLEARN_IMPORT_ERROR:
        return {
            "ready": False,
            "model": "rule_fallback",
            "error": f"Model dependencies missing: {SKLEARN_IMPORT_ERROR}",
            "dataset_path": path,
        }
    if _MODEL is not None and _MODEL.ready:
        return {
            "ready": True,
            "model": "tfidf_word_char_logreg",
            "error": None,
            "dataset_path": path,
        }
    if _MODEL is not None and _MODEL.error:
        return {
            "ready": False,
            "model": "rule_fallback",
            "error": _MODEL.error,
            "dataset_path": path,
        }
    if _MODEL_TRAINING:
        elapsed = None
        if _MODEL_TRAINING_SINCE is not None:
            elapsed = round((datetime.now() - _MODEL_TRAINING_SINCE).total_seconds(), 2)
        return {
            "ready": False,
            "model": "training",
            "error": _MODEL_TRAINING_ERROR or "Model training in progress",
            "dataset_path": path,
            "training_seconds": elapsed,
        }
    warm_model_async()
    return {
        "ready": False,
        "model": "training",
        "error": "Model training in progress",
        "dataset_path": path,
    }


def get_model_details():
    status = get_model_status()
    model = get_model()
    details = {
        "status": status,
        "training_history": list(_MODEL_TRAINING_HISTORY),
        "version": None,
        "metrics": {},
        "training_summary": {},
        "feature_count": 0,
    }
    if model:
        details["version"] = model.version
        details["metrics"] = model.metrics or {}
        details["training_summary"] = model.training_summary or {}
        word_count = len(model.word_feature_names) if model.word_feature_names else 0
        char_count = len(model.char_vectorizer.get_feature_names_out()) if model.char_vectorizer else 0
        details["feature_count"] = word_count + char_count
    return details


def build_signals(original_text, tokens):
    word_count = len(tokens)
    char_count = len(original_text or "")
    exclamations = (original_text or "").count("!")
    question_marks = (original_text or "").count("?")
    caps_words = len(re.findall(r"\b[A-Z]{3,}\b", original_text or ""))
    repeated_chars = len(REPEATED_CHAR_RE.findall(original_text or ""))
    unique_ratio = round(len(set(tokens)) / word_count, 2) if word_count else 0
    return {
        "language": detect_language(original_text),
        "wordCount": word_count,
        "charCount": char_count,
        "exclamations": exclamations,
        "questionMarks": question_marks,
        "capsWords": caps_words,
        "uniqueRatio": unique_ratio,
        "repeatedChars": repeated_chars,
    }


def _add_reason(reasons, message):
    if message and message not in reasons:
        reasons.append(message)


def analyze_review(review, rating, duplicate_info=None):
    original = review or ""
    text = original.strip()
    tokens = tokenize(text)
    signals = build_signals(original, tokens)
    reasons = []

    try:
        rating_value = float(rating)
    except (TypeError, ValueError):
        rating_value = 0.0

    model = get_model()
    model_name = "tfidf_word_char_logreg" if model else ("training" if _MODEL_TRAINING else "rule_fallback")
    probability = model.predict_fake_probability(text) if model else 0.5
    threshold = model.decision_threshold if model else 0.5
    sentiment = model.predict_sentiment(text, rating_value) if model else ("Positive" if rating_value >= 4 else "Negative" if 0 < rating_value <= 2 else "Neutral")
    sentiment_score = model.sentiment_score(text) if model else 0.0

    word_count = signals["wordCount"]
    sentence_count = len(split_sentences(text))
    numeric_hits = len(re.findall(r"\b\d+(?:\.\d+)?\b", text))
    repeated_bigrams = 0
    if len(tokens) > 2:
        bigram_counts = Counter(f"{tokens[index]} {tokens[index + 1]}" for index in range(len(tokens) - 1))
        repeated_bigrams = sum(1 for count in bigram_counts.values() if count >= 2)

    generic_ratio = model.generic_token_ratio(text) if model else None
    average_idf = model.average_idf(text) if model else None

    if word_count < 4:
        probability += 0.06
        _add_reason(reasons, "Extremely short review provides too little evidence to look trustworthy")

    if duplicate_info:
        distance = duplicate_info.get("distance")
        if duplicate_info.get("exact"):
            probability += 0.22
            _add_reason(reasons, "Exact duplicate of an existing review")
        elif duplicate_info.get("near"):
            if distance is not None and distance <= 3:
                probability += 0.16
                _add_reason(reasons, "Very close match to another stored review")
            else:
                probability += 0.1
                _add_reason(reasons, "Noticeably similar to another stored review")

    if generic_ratio is not None and word_count >= 10 and generic_ratio >= 0.72:
        _add_reason(reasons, "Language is unusually generic compared with the training reviews")

    if signals["uniqueRatio"] < 0.45 and word_count >= 12:
        _add_reason(reasons, "Low vocabulary variety suggests templated phrasing")

    if repeated_bigrams >= 2:
        _add_reason(reasons, "Repeated phrase structure detected")

    if sentence_count >= 2 and word_count >= 18:
        _add_reason(reasons, "Review includes multi-sentence context rather than only a slogan")

    if model and sentiment_score >= 0.18 and word_count <= 30 and sentence_count <= 2 and numeric_hits == 0 and signals["uniqueRatio"] >= 0.75:
        _add_reason(reasons, "Short, highly positive testimonial-style structure often appears in fake reviews")

    if model and sentence_count >= 2 and signals["uniqueRatio"] >= 0.55 and (numeric_hits >= 1 or (average_idf is not None and model.generic_idf_threshold is not None and average_idf >= model.generic_idf_threshold + 0.2)):
        _add_reason(reasons, "Specific, varied review structure is more typical of genuine reviews")

    if model and tokens:
        features = build_ngrams(tokens)
        fake_hits = []
        genuine_hits = []
        seen_fake = set()
        seen_genuine = set()
        for feature in features:
            if feature in model.top_fake_tokens and feature not in seen_fake:
                fake_hits.append(feature)
                seen_fake.add(feature)
            if feature in model.top_genuine_tokens and feature not in seen_genuine:
                genuine_hits.append(feature)
                seen_genuine.add(feature)
            if len(fake_hits) >= 3 and len(genuine_hits) >= 3:
                break
        if fake_hits:
            _add_reason(reasons, "Matches patterns the model often sees in fake reviews: " + ", ".join(fake_hits[:3]))
        if genuine_hits:
            _add_reason(reasons, "Matches patterns the model often sees in genuine reviews: " + ", ".join(genuine_hits[:3]))

    probability = clamp(probability, 0.01, 0.99)
    status = "Fake" if probability >= threshold else "Genuine"
    confidence = int(round(max(probability, 1 - probability) * 100))
    confidence = int(clamp(confidence, 50, 99))

    if model and abs(probability - threshold) >= 0.12:
        if probability > threshold:
            _add_reason(reasons, "The retrained model strongly aligns this review with fake-review patterns")
        else:
            _add_reason(reasons, "The retrained model strongly aligns this review with genuine-review patterns")

    if not reasons:
        _add_reason(reasons, "Review language matches the stronger retrained model without suspicious template signals")

    return {
        "status": status,
        "confidence": confidence,
        "prob_fake": round(float(probability), 4),
        "sentiment": sentiment,
        "word_count": word_count,
        "analysis": reasons,
        "signals": signals,
        "model": model_name,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
