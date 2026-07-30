"""
Interview Question Templates
============================
Pre-built question banks organized by role.
"""

QUESTION_TEMPLATES = {
    "backend_engineer": {
        "label": "Backend Engineer",
        "questions": [
            "Tell me about yourself and your background.",  # Calibration
            "Describe a system you designed that had to handle high throughput. What were the tradeoffs?",
            "Walk me through a tricky bug you debugged in production.",
            "How do you decide between SQL and NoSQL for a new service?",
            "Tell me about a time you disagreed with a technical decision your team made.",
            "What's your approach to API versioning?",
        ],
    },
    "data_scientist": {
        "label": "Data Scientist",
        "questions": [
            "Tell me about yourself and your background.",  # Calibration
            "Describe an analysis you did that changed a business decision.",
            "Walk me through a model you built — what features did you try and why?",
            "How do you handle imbalanced datasets?",
            "Tell me about a model that performed well in training but failed in production.",
            "How do you decide whether a result is statistically significant in practice?",
        ],
    },
    "product_manager": {
        "label": "Product Manager",
        "questions": [
            "Tell me about yourself and your background.",  # Calibration
            "Describe a product you launched. What metrics moved and why?",
            "Tell me about a feature you decided NOT to build. Why?",
            "How do you prioritize between engineering effort and customer impact?",
            "Walk me through a time you killed a project you championed.",
            "How do you handle disagreement between engineering and design?",
        ],
    },
    "frontend_engineer": {
        "label": "Frontend Engineer",
        "questions": [
            "Tell me about yourself and your background.",  # Calibration
            "Describe a complex UI you built. What was the hardest part?",
            "Walk me through a performance problem you debugged in the browser.",
            "How do you decide between client-state vs. server-state for a feature?",
            "Tell me about a time you had to argue against a design choice.",
            "What's your testing strategy for components with heavy user interaction?",
        ],
    },
    "ml_engineer": {
        "label": "ML Engineer",
        "questions": [
            "Tell me about yourself and your background.",  # Calibration
            "Describe an ML system you put into production. What broke first?",
            "How do you handle data drift in production models?",
            "Walk me through a model you retired or replaced. Why?",
            "Tell me about a time you reduced inference cost meaningfully.",
            "How do you decide when a model is 'good enough' to ship?",
        ],
    },
}


def list_templates():
    return [
        {"key": k, "label": v["label"], "count": len(v["questions"])}
        for k, v in QUESTION_TEMPLATES.items()
    ]


def get_template(key: str):
    return QUESTION_TEMPLATES.get(key)
