"""Pure-function unit tests for rag_service.py — the Python equivalent of
the old tests/rag-engine.spec.ts, which tested lib/rag.ts before that logic
moved to this backend.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import rag_service
from app.services.embeddings import normalize_text


def test_normalize_text_cleans_whitespace_and_zero_width_spaces():
    raw = "  Hello   World ​ with   spaces  "
    assert normalize_text(raw) == "Hello World with spaces"


def test_build_source_title_converts_filenames_into_human_titles():
    assert rag_service.build_source_title("Q3_financial_report_v2.pdf") == "Q3 financial report v2"
    assert rag_service.build_source_title("project-architecture-notes.docx") == "project architecture notes"


def test_levenshtein_distance_calculates_correct_edit_distance():
    assert rag_service.levenshtein_distance("cat", "hat") == 1
    assert rag_service.levenshtein_distance("kitten", "sitting") == 3
    assert rag_service.levenshtein_distance("same", "same") == 0


def test_fuzzy_match_token_detects_typo_matches_within_max_distance():
    assert rag_service.fuzzy_match_token("revenue", "Company quarterly revnue summary", 2) is True
    assert rag_service.fuzzy_match_token("budget", "Completely unrelated text", 2) is False
