"""Port of lib/router.ts — Hybrid Intent Router.

Stage 1: zero-cost regex rule interceptor.
Stage 2: lightweight Cerebras JSON-schema intent classifier, only reached
when Stage 1 can't decide.
"""
import json
import re
from dataclasses import dataclass

from app.core.logging import get_logger
from app.services.llm_client import instrumented_completion

logger = get_logger(__name__)

RouteIntent = str  # "CHAT" | "RAG" | "TOOL" | "CLARIFICATION"
_VALID_ROUTES = {"CHAT", "RAG", "TOOL", "CLARIFICATION"}


@dataclass
class RouteDecision:
    route: RouteIntent
    reason: str
    confidence: float
    search_query: str | None = None


_GREETING_RE = re.compile(
    r"^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening)|thanks|thank\s+you|thx|cool|ok|okay|got\s+it|sounds\s+good|bye|who\s+are\s+you|what\s+can\s+you\s+do)($|\s+.*)",
    re.IGNORECASE,
)
_DOC_KEYWORDS_RE = re.compile(
    r"(document|file|pdf|report|contract|policy|q3|revenue|vacation|ebitda|audit|diligence)", re.IGNORECASE
)
_MATH_RE = re.compile(
    r"^(what\s+is\s+|calculate\s+|compute\s+)?\d+(\.\d+)?\s*[\+\-\*/\^%]\s*\d+(\.\d+)?$", re.IGNORECASE
)
_CODE_RE = re.compile(
    r"^(write|give\s+me|create|build|implement|show\s+me)\s+(a|an|the)?\s*(python|typescript|javascript|react|html|css|sql|function|script|regex|class|code)",
    re.IGNORECASE,
)
_CODE_HOWTO_RE = re.compile(
    r"how\s+to\s+(center\s+a\s+div|reverse\s+a\s+string|parse\s+json|sort\s+an\s+array)", re.IGNORECASE
)
_TASK_RE = re.compile(
    r"(create|add|make|set\s*up|put|save)\s+(a\s+|an\s+|the\s+|new\s+)?(task|action\s+item|todo|reminder)",
    re.IGNORECASE,
)
_SUMMARY_RE = re.compile(
    r"(summarize|summary|overview)\s+(the\s+|this\s+|all\s+)?(deal\s+room|workspace|documents|files|audit)",
    re.IGNORECASE,
)
_RAG_KEYWORDS_RE = re.compile(
    r"(according\s+to|in\s+(the\s+)?(uploaded\s+)?(document|file|pdf|report|contract|10-k)|what\s+does\s+the\s+file\s+say|policy|ebitda|revenue|audit|due\s+diligence)",
    re.IGNORECASE,
)


def match_rule_based_route(query_text: str) -> RouteDecision | None:
    if not query_text or not isinstance(query_text, str):
        return RouteDecision(route="CHAT", reason="Empty or invalid input string", confidence=1.0)

    cleaned = query_text.lower().strip()
    if not cleaned:
        return RouteDecision(route="CHAT", reason="Empty query", confidence=1.0)

    if _GREETING_RE.match(cleaned) and not _DOC_KEYWORDS_RE.search(cleaned):
        return RouteDecision(route="CHAT", reason="Conversational greeting or acknowledgment", confidence=1.0)

    if _MATH_RE.match(cleaned):
        return RouteDecision(route="CHAT", reason="Pure mathematical expression", confidence=1.0)

    if _CODE_RE.match(cleaned) or _CODE_HOWTO_RE.search(cleaned):
        return RouteDecision(route="CHAT", reason="General programming or coding request", confidence=0.95)

    if _TASK_RE.search(cleaned):
        return RouteDecision(route="TOOL", reason="Task creation request", confidence=0.95)

    if _SUMMARY_RE.search(cleaned):
        return RouteDecision(route="TOOL", reason="Deal room summarization request", confidence=0.95)

    if _RAG_KEYWORDS_RE.search(cleaned):
        return RouteDecision(
            route="RAG",
            reason="Explicit document reference or grounding keyword detected",
            confidence=0.95,
            search_query=query_text,
        )

    return None


_CLASSIFIER_MODEL = "gpt-oss-120b"


async def classify_intent_with_llm(query_text: str, recent_history: str) -> RouteDecision:
    prompt = f"""System: You are an intent classifier for an enterprise M&A Data Room and Financial Audit document assistant.
Analyze the user message and conversation history to determine if answering it REQUIRES searching the user's uploaded deal room documents (RAG), calling a deal room tool (TOOL), or if it can be answered directly by standard LLM knowledge/conversation (CHAT).

Routes:
- "RAG": Requires looking up info inside the user's uploaded files/documents (e.g. contracts, financial reports, 10-Ks, cap tables, specific M&A facts).
- "CHAT": Conversational chat, general coding, writing assistance, general knowledge, greetings.
- "TOOL": Creating checklist tasks, summarizing deal room, extracting financials, comparing contracts.
- "CLARIFICATION": Ambiguous or incomplete input requiring user follow-up.

USER QUERY: "{query_text}"
RECENT HISTORY:
{recent_history or 'None'}

Return ONLY a valid JSON object matching this schema:
{{
  "route": "CHAT" | "RAG" | "TOOL" | "CLARIFICATION",
  "reason": "short explanation",
  "searchQuery": "clean search query for vector DB if route is RAG, otherwise empty string"
}}"""

    try:
        response = await instrumented_completion(
            _CLASSIFIER_MODEL,
            messages=[{"role": "user", "content": prompt}],
            # gpt-oss-120b is a reasoning model — it spends completion tokens on an
            # internal `reasoning` field before emitting final `content`. The original
            # lib/router.ts used max_completion_tokens=60, which reasoning alone
            # consumes for any non-trivial query, leaving `content` empty and silently
            # collapsing every Stage-2 classification to the RAG fallback default.
            # Confirmed against the live Cerebras API before raising this budget.
            max_completion_tokens=400,
            temperature=0.0,
        )

        raw_content = (response.choices[0].message.content or "").strip()
        match = re.search(r"\{[\s\S]*\}", raw_content)
        if match:
            parsed = json.loads(match.group(0))
            route = parsed.get("route") if parsed.get("route") in _VALID_ROUTES else "RAG"
            return RouteDecision(
                route=route,
                reason=parsed.get("reason") or "LLM Intent Classifier decision",
                confidence=0.85,
                search_query=parsed.get("searchQuery") or query_text,
            )
    except Exception as error:
        logger.warning("router.llm_classifier.failed", error=str(error))

    return RouteDecision(route="RAG", reason="Classifier fallback default", confidence=0.5, search_query=query_text)


async def route_query_intent(query_text: str, recent_history: str) -> RouteDecision:
    rule_decision = match_rule_based_route(query_text)
    if rule_decision:
        logger.info("router.stage1_rule", route=rule_decision.route, reason=rule_decision.reason)
        return rule_decision

    logger.info("router.stage2_llm_classifying", query_preview=query_text[:80])
    llm_decision = await classify_intent_with_llm(query_text, recent_history)
    logger.info("router.stage2_llm_decision", route=llm_decision.route, reason=llm_decision.reason)
    return llm_decision
