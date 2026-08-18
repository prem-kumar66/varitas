"""
College Student Recruitment — Subject & Question Bank Templates
=================================================================
Pre-built academic subjects with standard reference model answers and rubric criteria.
"""

SUBJECT_TEMPLATES = {
    "computer_science": {
        "name": "Computer Science & Data Structures",
        "department": "Engineering",
        "questions": [
            {
                "question": "Briefly introduce yourself, your academic background, and your key projects.",
                "reference_answer": "Student introduces their name, academic branch, core interest areas (such as algorithms, web development, or AI), and highlights 1-2 major technical projects.",
                "rubric_keywords": ["academics", "projects", "skills", "experience", "interests"],
                "max_marks": 5,
                "time_limit_sec": 90,
            },
            {
                "question": "Explain the difference between QuickSort and MergeSort. When would you prefer one over the other?",
                "reference_answer": "QuickSort is an in-place divide-and-conquer algorithm with average O(n log n) time complexity, but worst-case O(n^2). MergeSort guarantees O(n log n) time complexity in all cases but requires O(n) auxiliary memory space. QuickSort is preferred for memory-constrained systems, while MergeSort is preferred for stable sorting and linked lists.",
                "rubric_keywords": ["O(n log n)", "in-place", "space complexity", "stability", "worst-case O(n^2)"],
                "max_marks": 10,
                "time_limit_sec": 120,
            },
            {
                "question": "What is Object-Oriented Programming? Explain encapsulation, polymorphism, inheritance, and abstraction.",
                "reference_answer": "OOP is a programming paradigm based on objects containing data and code. Encapsulation bundles data and methods while hiding internal details. Inheritance enables classes to derive properties from parent classes. Polymorphism allows methods to take multiple forms (overloading/overriding). Abstraction hides complex implementation details behind simple interfaces.",
                "rubric_keywords": ["Encapsulation", "Inheritance", "Polymorphism", "Abstraction", "Objects & Classes"],
                "max_marks": 10,
                "time_limit_sec": 120,
            },
            {
                "question": "How does dynamic programming differ from recursion? Give an example problem.",
                "reference_answer": "Recursion solves problems by calling a function within itself, which can lead to redundant computation of overlapping subproblems. Dynamic programming optimizes recursion by storing solutions to subproblems (memoization or tabulation) to avoid recalculation, reducing exponential time complexity to polynomial time. Examples include Fibonacci series and 0/1 Knapsack.",
                "rubric_keywords": ["memoization", "tabulation", "overlapping subproblems", "optimal substructure", "Knapsack/Fibonacci"],
                "max_marks": 10,
                "time_limit_sec": 120,
            },
        ],
    },
    "data_science": {
        "name": "Data Science & Artificial Intelligence",
        "department": "Computer Science & Analytics",
        "questions": [
            {
                "question": "Briefly introduce yourself and your background in data science or analytics.",
                "reference_answer": "Student summarizes their background in statistics, machine learning algorithms, programming tools (Python, SQL), and data analytics projects.",
                "rubric_keywords": ["analytics", "Python", "machine learning", "projects", "statistics"],
                "max_marks": 5,
                "time_limit_sec": 90,
            },
            {
                "question": "What is the difference between Supervised and Unsupervised Learning? Give two examples of each.",
                "reference_answer": "Supervised learning uses labeled training data to learn a mapping function from input variables to target outputs (e.g., Linear Regression, Random Forest). Unsupervised learning works on unlabeled data to find hidden patterns, clusters, or distributions (e.g., K-Means Clustering, PCA).",
                "rubric_keywords": ["labeled data", "unlabeled data", "regression/classification", "clustering", "K-Means"],
                "max_marks": 10,
                "time_limit_sec": 120,
            },
            {
                "question": "Explain Overfitting and Underfitting in Machine Learning models. How do you prevent overfitting?",
                "reference_answer": "Overfitting occurs when a model learns training data noise too well, performing poorly on unseen data (high variance). Underfitting occurs when a model is too simple to capture underlying patterns (high bias). Overfitting can be prevented using cross-validation, regularization (L1/L2), pruning, dropout, and increasing training data.",
                "rubric_keywords": ["high bias", "high variance", "regularization", "cross-validation", "unseen data"],
                "max_marks": 10,
                "time_limit_sec": 120,
            },
        ],
    },
    "business_admin": {
        "name": "Business Administration & Management",
        "department": "Business & Commerce",
        "questions": [
            {
                "question": "Introduce yourself and discuss your leadership or management experience in campus activities.",
                "reference_answer": "Student introduces themselves, highlighting student body leadership, club organization experience, conflict management, and team coordination.",
                "rubric_keywords": ["leadership", "teamwork", "organization", "campus activities", "management"],
                "max_marks": 5,
                "time_limit_sec": 90,
            },
            {
                "question": "What is a SWOT analysis, and how would you apply it to evaluate a new product launch?",
                "reference_answer": "SWOT analysis evaluates Strengths, Weaknesses, Opportunities, and Threats. Strengths and Weaknesses focus on internal organizational capabilities (e.g. brand, capital), while Opportunities and Threats analyze external market conditions (e.g. competitors, regulations, market demand).",
                "rubric_keywords": ["Strengths", "Weaknesses", "Opportunities", "Threats", "internal vs external"],
                "max_marks": 10,
                "time_limit_sec": 120,
            },
        ],
    },
    "general_aptitude": {
        "name": "General Aptitude & Logical Reasoning",
        "department": "Placement Cell",
        "questions": [
            {
                "question": "Introduce yourself and state why you are interested in this campus recruitment drive.",
                "reference_answer": "Candidate gives a professional overview of career goals, academic accomplishments, and motivation for participating in campus placement.",
                "rubric_keywords": ["goals", "career", "academics", "motivation", "strengths"],
                "max_marks": 5,
                "time_limit_sec": 90,
            },
            {
                "question": "Describe a difficult situation you faced during a group project and how you resolved it.",
                "reference_answer": "Candidate uses STAR method (Situation, Task, Action, Result) to explain a team conflict or deadline pressure, effective communication, and successful outcome.",
                "rubric_keywords": ["STAR method", "communication", "conflict resolution", "collaboration", "outcome"],
                "max_marks": 10,
                "time_limit_sec": 120,
            },
        ],
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# MCQ QUESTION BANK  (Quiz mode only)
# correct_answer is NEVER sent to the frontend — validated server-side only
# ─────────────────────────────────────────────────────────────────────────────
MCQ_TEMPLATES: dict = {
    "computer_science": {
        "name": "Computer Science & Data Structures",
        "questions": [
            {
                "question": "Which data structure provides average O(1) time complexity for insertion, deletion, and lookup by key?",
                "options": {"A": "Binary Search Tree", "B": "Hash Map", "C": "Linked List", "D": "Stack"},
                "correct_answer": "B",
                "explanation": "A Hash Map uses a hash function to map keys to buckets, giving O(1) average-case performance. BSTs are O(log n) and Linked Lists are O(n).",
            },
            {
                "question": "What is the worst-case time complexity of QuickSort?",
                "options": {"A": "O(n log n)", "B": "O(n)", "C": "O(n²)", "D": "O(log n)"},
                "correct_answer": "C",
                "explanation": "QuickSort degrades to O(n²) when the pivot consistently picks the smallest or largest element (e.g., already-sorted input with naive pivot selection).",
            },
            {
                "question": "Which OOP principle allows a subclass to be treated as an instance of its parent class?",
                "options": {"A": "Encapsulation", "B": "Abstraction", "C": "Polymorphism", "D": "Liskov Substitution"},
                "correct_answer": "D",
                "explanation": "The Liskov Substitution Principle (LSP) states that objects of a subclass should be substitutable for objects of the superclass without altering program correctness.",
            },
            {
                "question": "In a min-heap, which element is always at the root?",
                "options": {"A": "The largest element", "B": "The median element", "C": "The most recently inserted element", "D": "The smallest element"},
                "correct_answer": "D",
                "explanation": "A min-heap always places the smallest element at the root, with each parent node being smaller than or equal to its children.",
            },
            {
                "question": "Which of the following sorting algorithms is stable AND has O(n log n) worst-case time complexity?",
                "options": {"A": "QuickSort", "B": "HeapSort", "C": "MergeSort", "D": "Selection Sort"},
                "correct_answer": "C",
                "explanation": "MergeSort is stable (equal elements retain their original order) and guarantees O(n log n) in all cases. QuickSort is not stable; HeapSort is not stable; Selection Sort is O(n²).",
            },
            {
                "question": "What does the 'S' in SOLID principles stand for?",
                "options": {"A": "Synchronization Principle", "B": "Single Responsibility Principle", "C": "Substitution Principle", "D": "Separation of Concerns"},
                "correct_answer": "B",
                "explanation": "S = Single Responsibility Principle: a class should have only one reason to change, meaning it should have only one job or responsibility.",
            },
        ],
    },
    "data_science": {
        "name": "Data Science & Artificial Intelligence",
        "questions": [
            {
                "question": "Which of the following is an example of unsupervised learning?",
                "options": {"A": "Linear Regression", "B": "Random Forest Classification", "C": "K-Means Clustering", "D": "Logistic Regression"},
                "correct_answer": "C",
                "explanation": "K-Means Clustering works on unlabeled data to find natural groupings. The other three options are supervised learning algorithms that require labeled training data.",
            },
            {
                "question": "What does a high variance (overfitting) model indicate?",
                "options": {"A": "The model performs well on both training and test data", "B": "The model is too simple to capture the data pattern", "C": "The model memorizes training data and fails on new data", "D": "The model has high bias"},
                "correct_answer": "C",
                "explanation": "High variance (overfitting) means the model has memorized the training data too closely, including noise, and generalizes poorly to unseen data.",
            },
            {
                "question": "Which regularization technique adds the sum of the absolute values of coefficients as a penalty term?",
                "options": {"A": "L2 (Ridge)", "B": "Elastic Net", "C": "Dropout", "D": "L1 (Lasso)"},
                "correct_answer": "D",
                "explanation": "L1 regularization (Lasso) adds |w| as penalty, which can shrink coefficients to exactly zero, effectively performing feature selection. L2 (Ridge) adds w² and rarely zeroes coefficients.",
            },
            {
                "question": "In a confusion matrix, what does 'False Positive' mean?",
                "options": {"A": "The model correctly predicted a negative class", "B": "The model predicted positive but the actual label was negative", "C": "The model predicted negative but the actual label was positive", "D": "The model correctly predicted a positive class"},
                "correct_answer": "B",
                "explanation": "A False Positive (Type I error) occurs when the model predicts the positive class but the ground truth is actually negative — a false alarm.",
            },
            {
                "question": "Which activation function is most commonly used in hidden layers of deep neural networks to avoid the vanishing gradient problem?",
                "options": {"A": "Sigmoid", "B": "Tanh", "C": "Softmax", "D": "ReLU"},
                "correct_answer": "D",
                "explanation": "ReLU (Rectified Linear Unit) f(x)=max(0,x) is preferred because it does not saturate for positive values, allowing gradients to flow without vanishing. Sigmoid and Tanh saturate at extremes.",
            },
            {
                "question": "Principal Component Analysis (PCA) is primarily used for:",
                "options": {"A": "Classification of data points", "B": "Dimensionality reduction", "C": "Outlier detection", "D": "Hyperparameter tuning"},
                "correct_answer": "B",
                "explanation": "PCA transforms data into a new coordinate system of principal components ordered by variance explained, reducing dimensionality while retaining most information.",
            },
        ],
    },
    "business_admin": {
        "name": "Business Administration & Management",
        "questions": [
            {
                "question": "Which of the following best describes 'economies of scale'?",
                "options": {"A": "Cost increases proportionally with output", "B": "Average cost per unit decreases as production volume increases", "C": "Fixed costs increase with more employees", "D": "Revenue grows faster than expenses at all times"},
                "correct_answer": "B",
                "explanation": "Economies of scale occur when increasing the scale of production leads to lower average costs per unit, due to spreading fixed costs over more units and operational efficiencies.",
            },
            {
                "question": "In a SWOT analysis, 'Opportunities' refer to:",
                "options": {"A": "Internal advantages the company possesses", "B": "Internal weaknesses that need improvement", "C": "External factors the company can exploit for growth", "D": "External threats from competitors or regulations"},
                "correct_answer": "C",
                "explanation": "Opportunities are external favorable factors — such as new markets, emerging trends, or reduced competition — that the organization can leverage to achieve its goals.",
            },
            {
                "question": "Which leadership style involves making decisions without consulting team members?",
                "options": {"A": "Democratic", "B": "Laissez-faire", "C": "Transformational", "D": "Autocratic"},
                "correct_answer": "D",
                "explanation": "Autocratic (authoritarian) leadership involves the leader making all decisions unilaterally, with little to no input from team members.",
            },
            {
                "question": "Porter's Five Forces does NOT include which of the following?",
                "options": {"A": "Threat of new entrants", "B": "Bargaining power of suppliers", "C": "Employee satisfaction index", "D": "Threat of substitute products"},
                "correct_answer": "C",
                "explanation": "Porter's Five Forces are: (1) Competitive rivalry, (2) Threat of new entrants, (3) Bargaining power of buyers, (4) Bargaining power of suppliers, (5) Threat of substitutes. Employee satisfaction is not one of them.",
            },
            {
                "question": "Which financial statement shows a company's revenues and expenses over a specific period?",
                "options": {"A": "Balance Sheet", "B": "Cash Flow Statement", "C": "Income Statement (Profit & Loss)", "D": "Statement of Retained Earnings"},
                "correct_answer": "C",
                "explanation": "The Income Statement (P&L) shows revenues, costs, and profits/losses over a period. The Balance Sheet shows assets/liabilities at a point in time. The Cash Flow Statement shows cash movements.",
            },
        ],
    },
    "general_aptitude": {
        "name": "General Aptitude & Logical Reasoning",
        "questions": [
            {
                "question": "If all Bloops are Razzles and all Razzles are Lazzles, which statement must be true?",
                "options": {"A": "All Lazzles are Bloops", "B": "All Bloops are Lazzles", "C": "Some Razzles are not Lazzles", "D": "No Bloops are Lazzles"},
                "correct_answer": "B",
                "explanation": "Using transitive logic: Bloop → Razzle → Lazzle. Therefore all Bloops are Lazzles. The reverse (all Lazzles are Bloops) is not necessarily true.",
            },
            {
                "question": "A train travels 300 km in 4 hours. If it increases its speed by 25%, how long will it take to travel the same 300 km?",
                "options": {"A": "3 hours 12 minutes", "B": "3 hours 30 minutes", "C": "2 hours 40 minutes", "D": "3 hours 45 minutes"},
                "correct_answer": "A",
                "explanation": "Original speed = 75 km/h. Increased by 25% = 93.75 km/h. Time = 300 / 93.75 = 3.2 hours = 3 hours 12 minutes.",
            },
            {
                "question": "Find the odd one out: 2, 3, 5, 7, 11, 14, 13",
                "options": {"A": "11", "B": "7", "C": "14", "D": "13"},
                "correct_answer": "C",
                "explanation": "All other numbers (2, 3, 5, 7, 11, 13) are prime numbers. 14 = 2 × 7, so it is composite and is the odd one out.",
            },
            {
                "question": "Which of the following problem-solving frameworks uses Situation, Task, Action, and Result?",
                "options": {"A": "SWOT", "B": "STAR", "C": "SMART", "D": "PDCA"},
                "correct_answer": "B",
                "explanation": "The STAR method (Situation, Task, Action, Result) is a structured framework for answering behavioral interview questions by narrating a specific relevant experience.",
            },
            {
                "question": "If a clock shows 3:15, what is the angle between the hour and minute hands?",
                "options": {"A": "0°", "B": "7.5°", "C": "15°", "D": "22.5°"},
                "correct_answer": "B",
                "explanation": "At 3:15, the minute hand is at 90° (15×6). The hour hand at 3:00 is at 90°, but moves 0.5° per minute, so at 3:15 it's at 90° + 7.5° = 97.5°. Angle between them = 97.5° − 90° = 7.5°.",
            },
        ],
    },
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
    return SUBJECT_TEMPLATES.get(key)


def get_mcq_questions(subject_key: str, include_answers: bool = False) -> list:
    """Return MCQ questions for a subject. Never include correct_answer unless server needs it."""
    template = MCQ_TEMPLATES.get(subject_key, {})
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
    template = MCQ_TEMPLATES.get(subject_key, {})
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

