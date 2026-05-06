# Dataset and Algorithm Description

This document provides a detailed overview of the training dataset and the specific machine learning algorithms used in the **FakeReviewAnalysis** system.

## 1. Dataset
The system uses a large-scale **Labeled Dataset** (collected from Kaggle) for training and validation purposes.
*   **Structure:** It contains review text, user ratings, and product information.
*   **Labels:** Each review is specifically labeled as **Genuine (1)** or **Fake (0)**.
*   **Purpose:** This dataset allows the machine learning model to study the linguistic and behavioral differences between real customers and automated bots.

## 2. Algorithm Description

The analysis engine combines three primary algorithms to determine the authenticity of a review:

### TF-IDF (Term Frequency-Inverse Document Frequency)
*   **Mechanism:** This algorithm converts text into a mathematical format by scoring words based on their frequency in a specific review compared to the entire dataset.
*   **Usage:** It helps the system identify unique keywords and phrases that are common in fraudulent reviews while ignoring common words like 'and' or 'the'.

### Logistic Regression
*   **Mechanism:** A robust classification algorithm that calculates the probability of a review being fake. It processes the scores from the TF-IDF vectorizer and assigns a final verdict.
*   **Usage:** It serves as the primary decision-making core for determining if a review is suspicious or authentic.

### Simhash Algorithm
*   **Mechanism:** A type of hashing that creates a 64-bit numerical fingerprint for every review. Similar or slightly modified reviews produce similar fingerprints.
*   **Usage:** It is specifically used for detecting near-duplicate and copy-pasted reviews by calculating the *Hamming Distance* between hashes.

## 3. Dataset Analysis via ML Model
The machine learning model analyzes the dataset in the following steps:
1.  **Reading:** The system loads the labeled CSV data using the Python file interface.
2.  **Transformation:** It applies the **TF-IDF algorithm** to turn raw text data into numbers.
3.  **Training:** The **Logistic Regression model** studies the dataset to identify patterns correlated with fake versus genuine reviews.
4.  **Prediction:** When a user submits a review, the model compares its features against the learned patterns from the original dataset to provide a final detection result.
