"""
Veritas Academic — AIML Subject & Question Bank Templates
=========================================================
Dedicated to the Artificial Intelligence & Machine Learning (AIML) domain.
Includes comprehensive standard reference model answers, rubrics, and MCQs.
"""

SUBJECT_TEMPLATES = {
    "ai_ml": {
        "name": "Artificial Intelligence & Machine Learning",
        "department": "AI & Data Science",
        "questions": [
            {
                "question": "Briefly introduce yourself, your academic background, and your key projects in Artificial Intelligence and Machine Learning.",
                "reference_answer": "Student summarizes their background in AI/ML, mathematics (linear algebra, probability, calculus), programming tools (Python, PyTorch/TensorFlow, Scikit-Learn), and highlights 1-2 major machine learning or deep learning projects.",
                "rubric_keywords": ["Machine Learning", "Deep Learning", "Python", "PyTorch/TensorFlow", "Projects", "Data Science"],
                "max_marks": 5,
                "time_limit_sec": 90,
            },
            {
                "question": "What is the difference between Supervised, Unsupervised, and Reinforcement Learning? Give real-world examples of each.",
                "reference_answer": "Supervised learning trains on labeled input-output pairs to learn a mapping function (e.g. Linear Regression, Random Forest for fraud detection). Unsupervised learning discovers hidden patterns in unlabeled data without predefined ground truth (e.g. K-Means clustering for customer segmentation, PCA). Reinforcement learning trains agents to make sequences of decisions via environmental rewards and penalties (e.g. Q-Learning, PPO for robotics and autonomous driving).",
                "rubric_keywords": ["labeled data", "unlabeled data", "reward/penalty", "mapping function", "clustering", "agent & environment"],
                "max_marks": 10,
                "time_limit_sec": 120,
            },
            {
                "question": "Explain the Bias-Variance Tradeoff. How do L1/L2 Regularization, Cross-Validation, and Dropout prevent overfitting?",
                "reference_answer": "Bias represents error from erroneous assumptions or oversimplified models (underfitting). Variance represents error from sensitivity to small fluctuations in training data (overfitting). L1 regularization (Lasso) adds absolute weights penalty driving irrelevant features to zero; L2 regularization (Ridge) penalizes squared weights to constrain large coefficients. K-Fold Cross-validation ensures models generalize across data folds. Dropout randomly deactivates neurons during training to prevent co-adaptation.",
                "rubric_keywords": ["underfitting", "overfitting", "L1/L2 penalty", "generalization", "cross-validation", "dropout", "high bias vs high variance"],
                "max_marks": 10,
                "time_limit_sec": 120,
            },
            {
                "question": "How does the Self-Attention mechanism in Transformer models work, and why does it outperform traditional RNNs/LSTMs?",
                "reference_answer": "Self-attention computes dynamic attention weights between all token pairs in a sequence using Query (Q), Key (K), and Value (V) projections: Attention(Q,K,V) = softmax(QK^T / sqrt(d_k)) * V. Unlike sequential RNNs that suffer from vanishing gradients and sequential compute bottlenecks, Transformers allow full parallelization during training and capture long-range token dependencies directly regardless of distance in the sequence.",
                "rubric_keywords": ["Query, Key, Value (Q,K,V)", "Softmax", "parallelization", "long-range dependencies", "vanishing gradient in RNNs"],
                "max_marks": 10,
                "time_limit_sec": 120,
            },
            {
                "question": "What is Retrieval-Augmented Generation (RAG) and how does vector similarity search with embeddings improve LLM factual accuracy?",
                "reference_answer": "RAG combines retrieval systems with generative LLMs to mitigate hallucinations. Documents are split into semantic chunks and converted into dense vector embeddings using embedding models. When a user submits a prompt, vector databases (like FAISS or Pinecone) perform cosine similarity search to retrieve top-k authoritative context chunks, which are injected into the LLM system prompt for grounded, citeable generation.",
                "rubric_keywords": ["dense embeddings", "vector database/FAISS", "cosine similarity", "hallucination mitigation", "context injection", "retrieval grounding"],
                "max_marks": 10,
                "time_limit_sec": 120,
            },
            {
                "question": "Explain Backpropagation and Gradient Descent in Deep Neural Networks. What causes the Vanishing Gradient problem and how is it mitigated?",
                "reference_answer": "Gradient descent minimizes the loss function by iteratively updating network weights in the opposite direction of the loss gradient. Backpropagation uses the calculus chain rule to propagate error gradients backward from the output layer to input layers. Vanishing gradients occur when using saturating activation functions (like Sigmoid or Tanh) where derivative values are < 1, causing gradients to diminish exponentially in deep layers. It is mitigated by ReLU/GELU activations, Residual Connections (ResNets), and Layer/Batch Normalization.",
                "rubric_keywords": ["Chain rule", "loss gradient", "weight update", "ReLU activation", "Residual connections", "saturating activations"],
                "max_marks": 10,
                "time_limit_sec": 120,
            },
        ],
    }
}


# ─────────────────────────────────────────────────────────────────────────────
# MCQ QUESTION BANK  (AIML Quiz mode)
# validated server-side only
# ─────────────────────────────────────────────────────────────────────────────
MCQ_TEMPLATES: dict = {
    "ai_ml": {
        "name": "Artificial Intelligence & Machine Learning",
        "questions": [
            {
                "question": "Which of the following is an example of an unsupervised learning algorithm?",
                "options": {"A": "Logistic Regression", "B": "Random Forest Classifier", "C": "K-Means Clustering", "D": "Support Vector Machine"},
                "correct_answer": "C",
                "explanation": "K-Means Clustering works on unlabeled data to discover natural groupings without target labels. The others are supervised learning algorithms.",
            },
            {
                "question": "In Transformer architectures, what is the formula for Scaled Dot-Product Attention?",
                "options": {
                    "A": "softmax(QK^T / sqrt(d_k)) * V",
                    "B": "sigmoid(QV^T) * K",
                    "C": "relu(QK) * V",
                    "D": "tanh(Q * K^T / d_k) * V"
                },
                "correct_answer": "A",
                "explanation": "Scaled Dot-Product Attention is computed as softmax(QK^T / sqrt(d_k)) * V, where queries and keys are dotted, scaled by the square root of key dimension d_k, and normalized with softmax.",
            },
            {
                "question": "Which regularization technique adds a penalty equal to the sum of the absolute values of the coefficients (L1 penalty)?",
                "options": {"A": "Ridge Regularization", "B": "Lasso Regularization", "C": "Batch Normalization", "D": "Dropout"},
                "correct_answer": "B",
                "explanation": "Lasso (L1) adds the sum of absolute values of weights, which can drive weights to exact zero and perform automatic feature selection. Ridge (L2) adds squared weights.",
            },
            {
                "question": "Which activation function is most widely used in deep neural network hidden layers to prevent vanishing gradients?",
                "options": {"A": "Sigmoid", "B": "Tanh", "C": "ReLU (Rectified Linear Unit)", "D": "Binary Step"},
                "correct_answer": "C",
                "explanation": "ReLU f(x) = max(0, x) has a constant gradient of 1 for positive inputs, preventing the gradient from diminishing exponentially during backpropagation.",
            },
            {
                "question": "In Retrieval-Augmented Generation (RAG), which metric is used to measure cosine similarity between dense text embeddings?",
                "options": {
                    "A": "Inner product of L2-normalized vector embeddings",
                    "B": "Manhattan distance between token counts",
                    "C": "Levenshtein edit distance",
                    "D": "Jaccard index of characters"
                },
                "correct_answer": "A",
                "explanation": "Cosine similarity is mathematically equivalent to the inner (dot) product of L2-normalized embedding vectors, as implemented in FAISS IndexFlatIP.",
            },
            {
                "question": "In model evaluation, what does the Area Under the ROC Curve (ROC-AUC) measure?",
                "options": {
                    "A": "The training loss convergence rate",
                    "B": "The model's ability to discriminate between positive and negative classes across all classification thresholds",
                    "C": "The computation time per epoch",
                    "D": "The proportion of true negatives only"
                },
                "correct_answer": "B",
                "explanation": "ROC-AUC plots True Positive Rate vs. False Positive Rate across all decision thresholds, quantifying the probability that the classifier ranks a random positive instance higher than a random negative one.",
            },
            {
                "question": "Which optimization algorithm maintains per-parameter adaptive learning rates by tracking both first and second moments of gradients?",
                "options": {"A": "Stochastic Gradient Descent (SGD)", "B": "Adam Optimizer", "C": "Adagrad", "D": "Mini-batch SGD"},
                "correct_answer": "B",
                "explanation": "Adam (Adaptive Moment Estimation) computes adaptive learning rates for each parameter by storing exponentially decaying averages of past gradients (first moment) and past squared gradients (second moment).",
            },
        ],
    }
}


def list_templates():
    return [
        {
            "key": k,
            "label": v["name"],
            "department": v["department"],
            "count": len(v["questions"]),
        }
        for k, v in SUBJECT_TEMPLATES.items()
    ]


def get_template(key: str):
    return SUBJECT_TEMPLATES.get(key) or list(SUBJECT_TEMPLATES.values())[0]


def get_mcq_questions(subject_key: str, include_answers: bool = False) -> list:
    """Return MCQ questions for a subject. Never include correct_answer unless server needs it."""
    template = MCQ_TEMPLATES.get(subject_key) or list(MCQ_TEMPLATES.values())[0]
    questions = template.get("questions", [])
    result = []
    for i, q in enumerate(questions):
        entry = {
            "index": i,
            "question": q["question"],
            "options": q["options"],
        }
        if include_answers:
            entry["correct_answer"] = q["correct_answer"]
            entry["explanation"] = q.get("explanation", "")
        result.append(entry)
    return result


def check_mcq_answer(subject_key: str, question_index: int, selected_option: str):
    """Validate a quiz answer server-side. Returns result dict."""
    template = MCQ_TEMPLATES.get(subject_key) or list(MCQ_TEMPLATES.values())[0]
    questions = template.get("questions", [])
    if question_index < 0 or question_index >= len(questions):
        return None
    q = questions[question_index]
    correct = q["correct_answer"]
    is_correct = selected_option.upper() == correct.upper()
    return {
        "correct": is_correct,
        "correct_answer": correct,
        "correct_answer_text": q["options"][correct],
        "selected_option": selected_option.upper(),
        "selected_text": q["options"].get(selected_option.upper(), ""),
        "explanation": q.get("explanation", ""),
        "score": 10 if is_correct else 0,
    }
