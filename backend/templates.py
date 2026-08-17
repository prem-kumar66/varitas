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
