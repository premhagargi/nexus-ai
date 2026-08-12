"""Pure-function unit tests for router_service.py's Stage-1 rule matcher —
the Python equivalent of the old tests/router.spec.ts, which tested
lib/router.ts before that logic moved to this backend.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.router_service import match_rule_based_route


def test_routes_casual_greetings_to_chat():
    assert match_rule_based_route("hi").route == "CHAT"
    assert match_rule_based_route("hello there!").route == "CHAT"
    assert match_rule_based_route("thanks so much").route == "CHAT"


def test_routes_general_coding_questions_to_chat():
    assert match_rule_based_route("Give me a Python function to reverse a string").route == "CHAT"
    assert match_rule_based_route("how to center a div in CSS").route == "CHAT"


def test_routes_mathematical_expressions_to_chat():
    assert match_rule_based_route("calculate 150 * 12").route == "CHAT"


def test_routes_task_actions_and_workspace_summarization_to_tool():
    assert match_rule_based_route("create a task to review Q3 budget").route == "TOOL"
    assert match_rule_based_route("summarize workspace documents").route == "TOOL"


def test_routes_explicit_document_questions_to_rag():
    decision = match_rule_based_route("According to the uploaded contract, what is the termination clause?")
    assert decision.route == "RAG"


def test_returns_none_for_ambiguous_queries_to_pass_to_stage_2_llm_classifier():
    assert match_rule_based_route("What is the standard procedure for setting up local dev environments?") is None
