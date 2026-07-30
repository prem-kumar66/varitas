"""
Demo Mode
=========
Pre-scripted candidate answers that bypass mic capture entirely.
Use during live demos when network/audio reliability is at risk.

Each scenario is designed to demonstrate a specific signal pattern.
"""

DEMO_SCENARIOS = {
    "ai_assisted": {
        "label": "AI-assisted answer (suspicious)",
        "description": "Polished, delayed, zero hesitation — classic AI-piped pattern",
        "rounds": [
            {
                "question": "Tell me about a challenging bug you debugged recently.",
                "transcript": (
                    "Essentially, in my previous role, I encountered a complex concurrency issue "
                    "that required a systematic debugging approach. Leveraging comprehensive logging "
                    "and utilizing established best practices, I was able to identify the root cause "
                    "in our distributed system. Furthermore, I implemented robust unit tests to "
                    "prevent regression. It is worth noting that this experience reinforced my "
                    "understanding of holistic approaches to distributed system reliability."
                ),
                "delay_before_answer": 7.2,
                "answer_duration": 26.0,
            },
            {
                "question": "What's your approach to code reviews?",
                "transcript": (
                    "I firmly believe that code reviews are essentially a comprehensive collaborative "
                    "process. Firstly, I prioritize understanding the broader context. Secondly, "
                    "I focus on leveraging established design patterns. Additionally, I always "
                    "ensure that the changes align with our team's best practices and facilitate "
                    "long-term maintainability of the codebase."
                ),
                "delay_before_answer": 5.8,
                "answer_duration": 18.0,
            },
        ],
    },

    "natural": {
        "label": "Natural human answer",
        "description": "Hesitations, self-corrections, varied pacing",
        "rounds": [
            {
                "question": "Tell me about a challenging bug you debugged recently.",
                "transcript": (
                    "Um, so the worst one was, like, this race condition in our payment service. "
                    "I, I thought it was a database issue at first, you know? Took me like two "
                    "days actually. I tried adding indexes, that didn't help. Eventually I added "
                    "a bunch of logs and realized two threads were hitting the same row. "
                    "Pretty embarrassing, honestly."
                ),
                "delay_before_answer": 1.3,
                "answer_duration": 19.0,
            },
            {
                "question": "What's your approach to code reviews?",
                "transcript": (
                    "Hmm, depends honestly. For juniors I try to like, ask questions instead of "
                    "saying do this. For seniors I just, you know, point out things and let them "
                    "decide. I've messed this up before — I used to be too nitpicky and people "
                    "started ignoring my reviews. So now I try to focus on the big stuff first."
                ),
                "delay_before_answer": 0.9,
                "answer_duration": 17.0,
            },
        ],
    },

    "borderline": {
        "label": "Borderline / articulate human",
        "description": "Polished but with real signal of personal experience",
        "rounds": [
            {
                "question": "Tell me about a challenging bug you debugged recently.",
                "transcript": (
                    "Last month I had a memory leak in our Node service that only showed up in "
                    "production. The tricky part was that local profiling showed nothing. I ended "
                    "up taking heap snapshots from production with clinic.js, diffing them, and "
                    "found that we were caching response objects in a closure that never got "
                    "garbage collected. Fixed it by switching to a weak reference map."
                ),
                "delay_before_answer": 2.5,
                "answer_duration": 22.0,
            },
        ],
    },
}


def get_scenario(name: str):
    return DEMO_SCENARIOS.get(name)


def list_scenarios():
    return [
        {"key": k, "label": v["label"], "description": v["description"], "rounds": len(v["rounds"])}
        for k, v in DEMO_SCENARIOS.items()
    ]
