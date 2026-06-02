"""Shared helpers for questionnaire loading and normalization."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_questionnaire(path: Path) -> dict[str, Any]:
    raw = read_text(path)
    suffix = path.suffix.lower()
    if suffix == ".json":
        data = json.loads(raw)
    elif suffix in {".yaml", ".yml"}:
        data = yaml.safe_load(raw)
    else:
        raise ValueError(f"Unsupported questionnaire format: {path.suffix}")
    if not isinstance(data, dict):
        raise ValueError("Questionnaire file must contain a top-level object.")
    return data


def normalize_questionnaire(data: dict[str, Any]) -> dict[str, Any]:
    data.setdefault("id", "")
    data.setdefault("title", "")
    data.setdefault("version", "")
    pages = data.get("pages")
    if pages is None:
        data["pages"] = []
        pages = data["pages"]
    if not isinstance(pages, list):
        raise ValueError("Questionnaire field 'pages' must be a list.")

    question_counter = 0
    seen_ids: set[str] = set()

    for page_index, page in enumerate(pages, start=1):
        if not isinstance(page, dict):
            raise ValueError("Each page must be an object.")
        page.setdefault("id", f"page-{page_index}")
        page.setdefault("title", "")
        page.setdefault("description", "")
        questions = page.get("questions")
        if questions is None:
            page["questions"] = []
            questions = page["questions"]
        if not isinstance(questions, list):
            raise ValueError(f"Questions for page {page.get('id', page_index)} must be a list.")
        for question in questions:
            if not isinstance(question, dict):
                raise ValueError("Each question must be an object.")
            question_counter += 1
            question.setdefault("id", f"Q{question_counter}")
            if question["id"] in seen_ids:
                raise ValueError(f"Duplicate question id: {question['id']}")
            seen_ids.add(question["id"])
            question.setdefault("type", "text")
            question.setdefault("prompt", "")
            question.setdefault("title", "")
            question.setdefault("description", "")
            question.setdefault("help", "")
            question.setdefault("required", False)
            question.setdefault("allow_freetext", False)
            question.setdefault("answer", None)
            question.setdefault("review_status", "pending")
            question.setdefault("review_status_by_rule", False)
            question.setdefault("reviewer_comment", "")
            if "textarea_rows" in question:
                try:
                    question["textarea_rows"] = max(1, min(int(question["textarea_rows"]), 30))
                except (TypeError, ValueError):
                    question["textarea_rows"] = 4
            if "default" not in question:
                question["default"] = False if question.get("type") == "checkbox" else ""
            if question.get("type") in {"radio", "dropdown"} and "options" not in question:
                question["options"] = []
    return data
