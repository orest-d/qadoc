#!/usr/bin/env python3
"""Convert CSV or XLSX tabular question data into questionnaire YAML."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import pandas as pd
import yaml

from questionnaire_utils import normalize_questionnaire, read_text


def load_config(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(read_text(path)) or {}
    if not isinstance(data, dict):
        raise ValueError("Config file must contain a YAML object.")
    columns = data.get("columns") or {}
    if not isinstance(columns, dict):
        raise ValueError("Config field 'columns' must be an object.")
    if "prompt" not in columns:
        raise ValueError("Config must specify at least columns.prompt.")
    return data


def load_rows(path: Path, sheet_name: str | None = None) -> list[dict[str, Any]]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        dataframe = pd.read_csv(path, keep_default_na=False)
        return dataframe.to_dict(orient="records")
    if suffix == ".xlsx":
        dataframe = pd.read_excel(path, sheet_name=sheet_name or 0, keep_default_na=False)
        return dataframe.to_dict(orient="records")
    raise ValueError(f"Unsupported input format: {path.suffix}")


def cell_to_text(value: Any) -> str:
    if value is None:
        return ""
    if pd.isna(value):
        return ""
    return str(value).strip()


def cell_to_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if pd.isna(value):
        return default
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y", "on"}:
        return True
    if text in {"0", "false", "no", "n", "off"}:
        return False
    return default


def parse_options(text: str, delimiter: str) -> list[dict[str, Any]]:
    if not text:
        return []
    options: list[dict[str, Any]] = []
    for chunk in text.split(delimiter):
        item = chunk.strip()
        if not item:
            continue
        if "=" in item:
            value, label = item.split("=", 1)
            option_value = value.strip()
            option_label = label.strip()
        else:
            option_value = item
            option_label = item
        option: dict[str, Any] = {"value": option_value, "label": option_label}
        if option_value.lower() == "other" or option_label.lower() == "other":
            option["isOther"] = True
        options.append(option)
    return options


def build_question_from_row(
    row: dict[str, Any],
    columns: dict[str, str],
    option_delimiter: str,
) -> dict[str, Any]:
    prompt = cell_to_text(row.get(columns["prompt"]))
    question_type = cell_to_text(row.get(columns.get("type", ""))) or "text"

    question: dict[str, Any] = {
        "type": question_type,
        "prompt": prompt,
        "title": cell_to_text(row.get(columns.get("title", ""))),
        "description": cell_to_text(row.get(columns.get("description", ""))),
        "help": cell_to_text(row.get(columns.get("help", ""))),
        "required": cell_to_bool(row.get(columns.get("required", "")), default=False),
        "default": cell_to_text(row.get(columns.get("default", ""))),
        "allow_freetext": cell_to_bool(row.get(columns.get("allow_freetext", "")), default=False),
        "answer": None,
        "review_status": "pending",
        "reviewer_comment": "",
    }

    question_id_column = columns.get("id")
    if question_id_column:
        question_id = cell_to_text(row.get(question_id_column))
        if question_id:
            question["id"] = question_id

    if question_type == "checkbox" and question["default"] == "":
        question["default"] = False
    elif question_type != "checkbox" and question["default"] == "":
        question["default"] = ""

    multiline_column = columns.get("multiline")
    if multiline_column:
        question["multiline"] = cell_to_bool(row.get(multiline_column), default=False)

    predefined_text_column = columns.get("predefinedText")
    if predefined_text_column:
        predefined_text = cell_to_text(row.get(predefined_text_column))
        if predefined_text:
            question["predefinedText"] = predefined_text

    options_column = columns.get("options")
    if options_column and question_type in {"radio", "dropdown"}:
        question["options"] = parse_options(cell_to_text(row.get(options_column)), option_delimiter)

    return question


def page_key_for_row(row: dict[str, Any], columns: dict[str, str], page_key: str) -> tuple[str, str, str]:
    page_id = "page-1"
    page_title = ""
    page_description = ""

    page_id_column = columns.get("page_id")
    page_title_column = columns.get("page_title")
    page_description_column = columns.get("page_description")

    if page_key == "id" and page_id_column:
        page_id = cell_to_text(row.get(page_id_column)) or page_id
    elif page_key == "title" and page_title_column:
        title = cell_to_text(row.get(page_title_column))
        page_title = title
        page_id = title or page_id

    if page_title_column:
        page_title = cell_to_text(row.get(page_title_column))
    if page_id_column:
        page_id = cell_to_text(row.get(page_id_column)) or page_id
    if page_description_column:
        page_description = cell_to_text(row.get(page_description_column))

    return page_id, page_title, page_description


def build_questionnaire(rows: list[dict[str, Any]], config: dict[str, Any]) -> dict[str, Any]:
    columns = config["columns"]
    option_delimiter = str(config.get("option_delimiter", "|"))
    page_key = str(config.get("page_group_by", "single")).lower()

    questionnaire: dict[str, Any] = {
        "id": str(config.get("questionnaire", {}).get("id", "")),
        "title": str(config.get("questionnaire", {}).get("title", "")),
        "version": str(config.get("questionnaire", {}).get("version", "")),
        "pages": [],
    }

    page_index: dict[str, dict[str, Any]] = {}
    ordered_pages: list[dict[str, Any]] = []

    for row in rows:
        prompt = cell_to_text(row.get(columns["prompt"]))
        if not prompt:
            continue

        page_id, page_title, page_description = page_key_for_row(row, columns, page_key)
        key = page_id if page_key == "id" else (page_title or page_id if page_key == "title" else "page-1")

        if key not in page_index:
            page = {
                "id": page_id if page_key == "id" else ("page-" + str(len(ordered_pages) + 1) if page_key == "single" else page_id),
                "title": page_title,
                "description": page_description,
                "questions": [],
            }
            page_index[key] = page
            ordered_pages.append(page)

        page_index[key]["questions"].append(build_question_from_row(row, columns, option_delimiter))

    if not ordered_pages:
        ordered_pages.append({"id": "page-1", "title": "", "description": "", "questions": []})

    questionnaire["pages"] = ordered_pages
    return normalize_questionnaire(questionnaire)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert CSV or XLSX question rows into questionnaire YAML.")
    parser.add_argument("input", type=Path, help="Input .csv or .xlsx file.")
    parser.add_argument("output", type=Path, help="Output questionnaire .yaml file.")
    parser.add_argument("--config", type=Path, required=True, help="YAML config mapping questionnaire fields to columns.")
    parser.add_argument("--sheet", help="Worksheet name for XLSX input. Defaults to the active sheet.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config(args.config)
    rows = load_rows(args.input, sheet_name=args.sheet)
    questionnaire = build_questionnaire(rows, config)
    args.output.write_text(yaml.safe_dump(questionnaire, sort_keys=False, allow_unicode=True), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
