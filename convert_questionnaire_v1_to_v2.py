#!/usr/bin/env python3
"""Convert a v1 nested questionnaire file to the v2 flat format."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any

import yaml


FIELD_ALIASES = {
    "predefinedText": "predefined_text",
    "visibleIf": "visible_if",
}

OPTION_ALIASES = {
    "isOther": "is_other",
}

CONDITION_ALIASES = {
    "questionId": "question_id",
    "notEquals": "not_equals",
}

PREFERRED_COLUMNS = [
    "id",
    "page_id",
    "order",
    "type",
    "prompt",
    "title",
    "description",
    "help",
    "required",
    "default",
    "allow_freetext",
    "reviewer_question",
    "has_status",
    "multiline",
    "textarea_rows",
    "predefined_text",
    "options",
    "visible_if_question_id",
    "visible_if_operator",
    "visible_if_value",
    "visible_if",
    "rule_on_value",
    "rule_status",
    "answer",
    "review_status",
    "review_status_by_rule",
    "reviewer_comment",
]

JSON_STRING_COLUMNS = {"options", "visible_if", "answer", "default"}


def read_data(path: Path) -> Any:
    text = path.read_text(encoding="utf-8")
    suffix = path.suffix.lower()
    if suffix == ".json":
        return json.loads(text)
    if suffix in {".yaml", ".yml"}:
        return yaml.safe_load(text)
    raise ValueError(f"Unsupported input format: {path.suffix}")


def normalize_keys(value: Any, aliases: dict[str, str]) -> Any:
    if isinstance(value, list):
        return [normalize_keys(item, aliases) for item in value]
    if isinstance(value, dict):
        normalized: dict[str, Any] = {}
        for key, item in value.items():
            normalized_key = aliases.get(key, key)
            normalized[normalized_key] = normalize_keys(item, aliases)
        return normalized
    return value


def normalize_question(question: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in question.items():
        normalized_key = FIELD_ALIASES.get(key, key)
        if normalized_key == "options":
            normalized[normalized_key] = normalize_keys(value, OPTION_ALIASES)
        elif normalized_key == "visible_if":
            normalized[normalized_key] = normalize_keys(value, CONDITION_ALIASES)
        else:
            normalized[normalized_key] = value
    normalized.setdefault("type", "text")
    if normalized["type"] == "editable_predefined_text":
        normalized["type"] = "text"
    normalized.setdefault("prompt", "")
    normalized.setdefault("required", False)
    normalized.setdefault("allow_freetext", False)
    normalized.setdefault("reviewer_question", False)
    normalized.setdefault("has_status", True)
    normalized.setdefault("answer", None)
    normalized.setdefault("review_status", "pending")
    normalized.setdefault("review_status_by_rule", False)
    normalized.setdefault("reviewer_comment", "")
    return normalized


def flatten_visible_if(question: dict[str, Any]) -> None:
    condition = question.get("visible_if")
    if not isinstance(condition, dict):
        return
    question_id = condition.get("question_id")
    if not question_id:
        return
    for operator in ("equals", "not_equals", "contains"):
        if operator in condition:
            question.setdefault("visible_if_question_id", question_id)
            question.setdefault("visible_if_operator", operator)
            question.setdefault("visible_if_value", condition[operator])
            return


def flatten_questionnaire(data: dict[str, Any]) -> dict[str, Any]:
    pages = data.get("pages") or []
    if not isinstance(pages, list):
        raise ValueError("Input questionnaire field 'pages' must be a list.")

    flat_pages: list[dict[str, Any]] = []
    flat_questions: list[dict[str, Any]] = []

    for page_index, page in enumerate(pages, start=1):
        if not isinstance(page, dict):
            raise ValueError("Each page must be an object.")
        page_id = str(page.get("id") or f"page-{page_index}")
        page_title = str(page.get("title") or "")
        page_description = str(page.get("description") or "")
        flat_pages.append(
            {
                "id": page_id,
                "title": page_title,
                "description": page_description,
                "order": page_index,
            }
        )
        questions = page.get("questions") or []
        if not isinstance(questions, list):
            raise ValueError(f"Questions for page {page_id} must be a list.")
        for question_index, question in enumerate(questions, start=1):
            if not isinstance(question, dict):
                raise ValueError("Each question must be an object.")
            flat_question = normalize_question(question)
            flat_question.setdefault("id", f"Q{len(flat_questions) + 1}")
            flat_question["page_id"] = page_id
            flat_question["order"] = question_index
            flatten_visible_if(flat_question)
            flat_questions.append(flat_question)

    return {
        "config": {
            "id": data.get("id", ""),
            "title": data.get("title", ""),
            "version": data.get("version", ""),
        },
        "pages": flat_pages,
        "questions": flat_questions,
    }


def csv_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def write_csv(output_path: Path, questions: list[dict[str, Any]]) -> None:
    columns = list(PREFERRED_COLUMNS)
    seen = set(columns)
    for question in questions:
        for key in question:
            if key not in seen:
                columns.append(key)
                seen.add(key)

    with output_path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        for question in questions:
            row = {}
            for column in columns:
                value = question.get(column, "")
                if column in JSON_STRING_COLUMNS and isinstance(value, (dict, list)):
                    row[column] = json.dumps(value, ensure_ascii=False)
                else:
                    row[column] = csv_value(value)
            writer.writerow(row)


def write_output(output_path: Path, converted: dict[str, Any]) -> None:
    suffix = output_path.suffix.lower()
    if suffix == ".csv":
        write_csv(output_path, converted["questions"])
        return
    if suffix == ".json":
        output_path.write_text(json.dumps(converted, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return
    if suffix in {".yaml", ".yml"}:
        output_path.write_text(yaml.safe_dump(converted, sort_keys=False, allow_unicode=True), encoding="utf-8")
        return
    raise ValueError(f"Unsupported output format: {output_path.suffix}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert v1 nested questionnaire JSON/YAML to v2 flat CSV/JSON/YAML.")
    parser.add_argument("input", type=Path, help="Input v1 questionnaire .yaml, .yml, or .json file.")
    parser.add_argument("output", type=Path, help="Output v2 .csv, .json, .yaml, or .yml file.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    data = read_data(args.input)
    if not isinstance(data, dict):
        raise ValueError("Input questionnaire must contain a top-level object.")
    converted = flatten_questionnaire(data)
    write_output(args.output, converted)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
