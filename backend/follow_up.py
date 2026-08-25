"""
Adaptive Follow-Up Generator
Generates probing follow-up questions designed to test lived experience.
Supports multiple languages — uses Groq llama-3.1-8b which is multilingual.
"""
import os
from typing import Optional
from groq import Groq


SYSTEM_PROMPTS = {
    "en": """You are an expert technical interviewer skilled at distinguishing surface-level vs.
deep understanding. Given a candidate's answer, generate ONE sharp follow-up that:

1. Requires SPECIFIC personal experience (not theory)
2. Asks for a FAILURE case, edge case, or trade-off
3. Cannot be answered from documentation
4. Is short (max 25 words)

Examples:
Answer: "Blockchain improves transparency."
Follow-up: "Describe a real project where blockchain transparency caused a privacy problem you had to solve."

Answer: "I used Redis for caching in my last project."
Follow-up: "What was the cache invalidation strategy, and where did it break first?"

Return ONLY the follow-up question. No preamble.""",

    "hi": """आप एक विशेषज्ञ तकनीकी साक्षात्कारकर्ता हैं। उम्मीदवार के उत्तर के आधार पर एक तीखा फॉलो-अप प्रश्न
तैयार करें जो विशिष्ट व्यक्तिगत अनुभव की मांग करे, असफलता या ट्रेड-ऑफ पर केंद्रित हो, और संक्षिप्त हो (अधिकतम 25 शब्द)।
केवल फॉलो-अप प्रश्न लौटाएं, कोई प्रस्तावना नहीं।""",

    "te": """మీరు ఒక నిపుణుడైన సాంకేతిక ఇంటర్వ్యూయర్. అభ్యర్థి సమాధానం ఆధారంగా, నిర్దిష్ట వ్యక్తిగత అనుభవం అవసరమయ్యే,
వైఫల్యం లేదా ట్రేడ్-ఆఫ్‌పై దృష్టి సారించే, మరియు చిన్నదిగా ఉండే (గరిష్టంగా 25 పదాలు) ఒక పదునైన ఫాలో-అప్ ప్రశ్నను రూపొందించండి.
కేవలం ఫాలో-అప్ ప్రశ్నను మాత్రమే తిరిగి ఇవ్వండి.""",
}


FALLBACK_TEMPLATES = {
    "en": [
        "Can you describe a specific time this approach failed for you?",
        "What was the hardest edge case you hit when implementing this?",
        "If you had to do this again, what would you change and why?",
        "Walk me through the actual code or steps — not the concept.",
        "What did your team initially try that didn't work?",
    ],
    "hi": [
        "क्या आप एक विशिष्ट उदाहरण साझा कर सकते हैं जब यह दृष्टिकोण विफल हुआ?",
        "इसे लागू करते समय आपको सबसे कठिन एज केस क्या मिला?",
        "यदि आप इसे फिर से करें, तो आप क्या बदलेंगे?",
    ],
    "te": [
        "ఈ విధానం మీకు విఫలమైన నిర్దిష్ట సందర్భాన్ని వివరించగలరా?",
        "దీన్ని అమలు చేస్తున్నప్పుడు మీరు ఎదుర్కొన్న అత్యంత కష్టమైన ఎడ్జ్ కేస్ ఏమిటి?",
        "మళ్లీ చేస్తే ఏం మారుస్తారు, ఎందుకు?",
    ],
}


class FollowUpGenerator:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key or self.api_key.startswith("gsk_your"):
            self.client = None
            print("⚠️  GROQ_API_KEY not set — follow-ups will use fallback templates")
        else:
            self.client = Groq(api_key=self.api_key)

    def generate(
        self,
        question: str,
        answer: str,
        risk_score: float,
        language: str = "en",
        context_chunks: Optional[list] = None,
    ) -> str:
        if not answer.strip() or len(answer.split()) < 5:
            return self._fallback(answer, language)[0]

        if self.client is None:
            return self._pick_fallback(answer, language)

        system_prompt = SYSTEM_PROMPTS.get(language, SYSTEM_PROMPTS["en"])
        urgency = (
            "The candidate's answer scored HIGH on AI-assistance risk. "
            "Generate a follow-up that specifically requires lived experience they couldn't fake."
            if risk_score > 60
            else "Generate a thoughtful probe to test deeper understanding."
        )

        rag_prompt_section = ""
        if context_chunks:
            top_contexts = "\n".join([f"- {c.get('text', '')[:200]}" for c in context_chunks[:2]])
            rag_prompt_section = f"\nRelevant Syllabus Context:\n{top_contexts}\nProbe on nuanced application of these concepts."

        try:
            response = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content":
                        f"Original question: {question}\n\n"
                        f"Candidate's answer: {answer}\n\n"
                        f"{rag_prompt_section}\n\n"
                        f"{urgency}\n\n"
                        f"Follow-up question:"
                    },
                ],
                temperature=0.7,
                max_tokens=80,
            )
            return response.choices[0].message.content.strip().strip('"').strip("'")
        except Exception as e:
            print(f"Groq error: {e}")
            return self._pick_fallback(answer, language)

    def _fallback(self, _answer: str, language: str) -> list:
        return FALLBACK_TEMPLATES.get(language, FALLBACK_TEMPLATES["en"])

    def _pick_fallback(self, answer: str, language: str) -> str:
        templates = self._fallback(answer, language)
        a = answer.lower()
        if any(w in a for w in ["implement", "built", "developed", "लागू", "నిర్మించాను"]):
            return templates[min(3, len(templates)-1)]
        if any(w in a for w in ["team", "we ", "our ", "टीम", "మా"]):
            return templates[min(4, len(templates)-1)]
        return templates[0]
