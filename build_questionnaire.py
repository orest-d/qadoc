#!/usr/bin/env python3
"""Build a single self-contained questionnaire HTML file."""

from __future__ import annotations

import argparse
import html
import json
from pathlib import Path

from questionnaire_utils import load_questionnaire, normalize_questionnaire, read_text


def replace_script_endings(text: str) -> str:
    return text.replace("</script>", "<\\/script>").replace("</style>", "<\\/style>")


def render_mustache(template: str, context: dict[str, str]) -> str:
    rendered = template
    for key, value in context.items():
        rendered = rendered.replace("{{" + key + "}}", value)
    return rendered


def build_html(
    questionnaire_path: Path,
    template_path: Path,
    javascript_path: Path,
    css_path: Path,
    output_path: Path,
    role: str,
) -> None:
    questionnaire = load_questionnaire(questionnaire_path)
    questionnaire = normalize_questionnaire(questionnaire)
    template = read_text(template_path)
    javascript = replace_script_endings(read_text(javascript_path))
    css = replace_script_endings(read_text(css_path))
    questionnaire_json = replace_script_endings(json.dumps(questionnaire, indent=2, ensure_ascii=False))
    title = html.escape(str(questionnaire.get("title", "Questionnaire")))

    output = render_mustache(
        template,
        {
            "title": title,
            "css": css,
            "javascript": javascript,
            "questionnaire_json": questionnaire_json,
            "role": html.escape(role),
        },
    )
    output_path.write_text(output, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a self-contained questionnaire HTML file.")
    parser.add_argument("questionnaire", type=Path, help="Input questionnaire JSON or YAML file.")
    parser.add_argument("output", type=Path, help="Output standalone HTML file.")
    parser.add_argument("--template", type=Path, default=Path("questionnaire.mustache.html"))
    parser.add_argument("--javascript", type=Path, default=Path("questionnaire.js"))
    parser.add_argument("--css", type=Path, default=Path("questionnaire.css"))
    parser.add_argument("--role", choices=["interviewed", "reviewer"], default="interviewed")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    build_html(
        questionnaire_path=args.questionnaire,
        template_path=args.template,
        javascript_path=args.javascript,
        css_path=args.css,
        output_path=args.output,
        role=args.role,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
