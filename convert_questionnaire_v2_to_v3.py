#!/usr/bin/env python3
"""Convert v1 (nested) or v2 (flat) questionnaire files to the v3 format.

Input formats:
    - YAML  (.yaml / .yml)   v1 nested or v2 flat
    - JSON  (.json)          v1 nested or v2 flat
    - CSV   (.csv)           v2 flat

Output formats (selected by the output file extension):
    - .csv          flat v3 question table
    - .json         full v3 object: { "config": {...}, "questions": [...] }
    - .yaml / .yml  same structure as JSON, in YAML

The v3 known fields are written first, in a stable order; any unknown extra
fields are preserved and appended after the known fields.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any

# Field renames from v1/v2 -> v3.
RENAMES = {
    "prompt": "question",
    "page_id": "category",
    "textarea_rows": "rows",
    "visible_if_question_id": "visible_if_id",
    "visibleIf": "visible_if_value",
    "predefinedText": "predefined_text",
    "isOther": "is_other",
}

# Fields that are dropped during conversion.
DROPPED = {
    "title",
    "description",
    "predefined_text",
    "checkbox_label",
    "allow_freetext",
    "order",
    "page_title",
    "has_status",
    "multiline",
    "visible_if_operator",
    "visible_if",
    "rule_on_value",
    "rule_status",
    "review_status_by_rule",
    "reviewer_question",
    "weight_score",
}

# Known v3 fields, in export order.
KNOWN_FIELDS = [
    "id",
    "category",
    "subcategory",
    "question",
    "help",
    "required",
    "default",
    "type",
    "rows",
    "options",
    "visible_if_id",
    "visible_if_value",
    "answer",
    "review_status",
    "reviewer_comment",
    "weight",
    "analysis",
]

JSON_STRING_COLUMNS = {"options", "answer", "default"}


def read_data(path: Path) -> Any:
    text = path.read_text(encoding="utf-8")
    suffix = path.suffix.lower()
    if suffix == ".json":
        return json.loads(text)
    if suffix in {".yaml", ".yml"}:
        import yaml  # imported lazily so JSON/CSV use needs no PyYAML

        return yaml.safe_load(text)
    if suffix == ".csv":
        return list(csv.DictReader(text.splitlines()))
    raise ValueError(f"Unsupported input format: {path.suffix}")


def coerce_bool(value: Any) -> Any:
    if isinstance(value, bool):
        return value
    if value is None:
        return value
    text = str(value).strip().lower()
    if text in {"true", "t", "yes", "y", "1"}:
        return True
    if text in {"false", "f", "no", "n", "0"}:
        return False
    return value


def maybe_json(value: Any) -> Any:
    """Parse a JSON string into a list/dict when possible (CSV cells)."""
    if isinstance(value, str):
        text = value.strip()
        if text and text[0] in "[{":
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return value
    return value


def normalize_options(value: Any) -> Any:
    parsed = maybe_json(value)
    if isinstance(parsed, list):
        result = []
        for option in parsed:
            if isinstance(option, dict):
                result.append({("is_other" if k == "isOther" else k): v for k, v in option.items()})
            else:
                result.append(option)
        return result
    return parsed


def merge_visible_if(question: dict[str, Any], operator: Any) -> None:
    """Fold visible_if_operator + value into the v3 expression syntax."""
    value = question.get("visible_if_value")
    if value is None or value == "":
        return
    value = str(value)
    if operator in (None, "", "equals"):
        question["visible_if_value"] = value
    elif operator == "not_equals":
        question["visible_if_value"] = "!" + value
    else:
        # 'contains' has no direct v3 equivalent; keep the bare value as a
        # best-effort equality match.
        question["visible_if_value"] = value


def convert_question(raw: dict[str, Any], index: int) -> dict[str, Any]:
    converted: dict[str, Any] = {}

    # Apply renames first, dropping retired fields.
    for key, value in raw.items():
        name = RENAMES.get(key, key)
        if name in DROPPED:
            continue
        converted[name] = value

    # reviewer_question: true  ->  type: review
    if coerce_bool(raw.get("reviewer_question")) is True:
        converted["type"] = "review"

    # multiline: true (and no explicit rows) -> rows: 2
    if coerce_bool(raw.get("multiline")) is True and not raw.get("textarea_rows"):
        converted.setdefault("rows", 2)

    converted.setdefault("id", f"q_{index + 1}")
    converted["id"] = str(converted["id"])
    converted.setdefault("type", "text")
    if converted["type"] == "editable_predefined_text":
        converted["type"] = "text"

    # Category: default + dash sanitisation.
    category = str(converted.get("category") or "default")
    if "-" in category:
        category = category.replace("-", "_")
    converted["category"] = category

    # Normalise a few value types.
    if "required" in converted:
        converted["required"] = coerce_bool(converted["required"])
    if "options" in converted:
        converted["options"] = normalize_options(converted["options"])
    if "answer" in converted:
        converted["answer"] = maybe_json(converted["answer"])
    if "rows" in converted and converted["rows"] not in (None, ""):
        try:
            converted["rows"] = int(converted["rows"])
        except (TypeError, ValueError):
            converted.pop("rows")
    if "weight" in converted and converted["weight"] not in (None, ""):
        try:
            converted["weight"] = float(converted["weight"])
            if converted["weight"].is_integer():
                converted["weight"] = int(converted["weight"])
        except (TypeError, ValueError):
            converted.pop("weight")

    merge_visible_if(converted, raw.get("visible_if_operator"))

    return converted


def iter_source_questions(data: Any) -> list[dict[str, Any]]:
    """Return a flat list of raw question dicts from v1 or v2 structures."""
    if isinstance(data, list):
        return [q for q in data if isinstance(q, dict)]
    if isinstance(data, dict):
        if isinstance(data.get("questions"), list):
            return [q for q in data["questions"] if isinstance(q, dict)]
        if isinstance(data.get("pages"), list):
            flat: list[dict[str, Any]] = []
            for page in data["pages"]:
                if not isinstance(page, dict):
                    continue
                page_id = str(page.get("id") or "default")
                for question in page.get("questions") or []:
                    if isinstance(question, dict):
                        merged = dict(question)
                        merged.setdefault("page_id", page_id)
                        flat.append(merged)
            return flat
    raise ValueError("Could not find questions in the input file.")


def source_config(data: Any) -> dict[str, Any]:
    if isinstance(data, dict):
        if isinstance(data.get("config"), dict):
            return {**data["config"], "version": "3.0"}
        return {
            "id": data.get("id", ""),
            "title": data.get("title", ""),
            "version": "3.0",
        }
    return {"id": "", "title": "", "version": "3.0"}


def ordered_columns(questions: list[dict[str, Any]]) -> list[str]:
    columns = list(KNOWN_FIELDS)
    seen = set(columns)
    for question in questions:
        for key in question:
            if key not in seen:
                seen.add(key)
                columns.append(key)
    return columns


def ordered_question(question: dict[str, Any]) -> dict[str, Any]:
    """Return the question with known fields first, then unknown extras."""
    ordered: dict[str, Any] = {}
    for field in KNOWN_FIELDS:
        if field in question:
            ordered[field] = question[field]
    for key, value in question.items():
        if key not in ordered:
            ordered[key] = value
    return ordered


def csv_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def write_csv(output_path: Path, questions: list[dict[str, Any]]) -> None:
    columns = ordered_columns(questions)
    with output_path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        for question in questions:
            row = {column: csv_value(question.get(column, "")) for column in columns}
            writer.writerow(row)


def write_output(output_path: Path, config: dict[str, Any], questions: list[dict[str, Any]]) -> None:
    ordered = [ordered_question(q) for q in questions]
    suffix = output_path.suffix.lower()
    if suffix == ".csv":
        write_csv(output_path, ordered)
        return
    payload = {"config": config, "questions": ordered}
    if suffix == ".json":
        output_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        return
    if suffix in {".yaml", ".yml"}:
        import yaml

        output_path.write_text(
            yaml.safe_dump(payload, sort_keys=False, allow_unicode=True), encoding="utf-8"
        )
        return
    raise ValueError(f"Unsupported output format: {output_path.suffix}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert v1/v2 questionnaire files to the v3 format."
    )
    parser.add_argument("input", type=Path, help="Input .yaml, .yml, .json, or .csv file.")
    parser.add_argument("output", type=Path, help="Output .csv, .json, .yaml, or .yml file.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    data = read_data(args.input)
    raw_questions = iter_source_questions(data)
    config = source_config(data)
    questions = [convert_question(raw, index) for index, raw in enumerate(raw_questions)]
    write_output(args.output, config, questions)
    print(f"Converted {len(questions)} question(s) -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
