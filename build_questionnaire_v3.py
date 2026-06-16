#!/usr/bin/env python3
"""Build a single self-contained v3 questionnaire HTML file.

Inlines the CSS, Mustache.js and the questionnaire_v3.js library directly into
the page so the result works offline with no external requests. CodeMirror is
NOT embedded; the template editor falls back to a plain textarea without it, so
any CodeMirror <link>/<script> references are stripped out.

Examples:
    # Build an empty, self-contained questionnaire from the template
    python build_questionnaire_v3.py empty-questionnaire-v3.template.html empty-questionnaire-v3.html

    # Build from any v3 page and embed question data from a CSV/JSON/YAML file
    python build_questionnaire_v3.py example-questionnaire-v3.html out.html --data questions.csv
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def escape_for_script(text: str) -> str:
    """Make text safe to embed inside <script>/<style> elements."""
    text = re.sub(r"</(script)", r"<\\/\1", text, flags=re.IGNORECASE)
    text = re.sub(r"</(style)", r"<\\/\1", text, flags=re.IGNORECASE)
    return text


def inline_css(html: str, css: str) -> str:
    style = "<style>\n" + escape_for_script(css) + "\n</style>"
    new_html, count = re.subn(
        r'<link\b[^>]*href="(?:[^"]*/)?questionnaire\.css"[^>]*>',
        lambda _m: style,
        html,
        count=1,
    )
    if count == 0:
        raise ValueError('Could not find <link ... href="questionnaire.css"> to inline.')
    return new_html


def inline_script(html: str, src_pattern: str, code: str, label: str) -> str:
    block = "<script>\n" + escape_for_script(code) + "\n</script>"
    new_html, count = re.subn(
        r'<script\b[^>]*src="' + src_pattern + r'"[^>]*>\s*</script>',
        lambda _m: block,
        html,
        count=1,
    )
    if count == 0:
        raise ValueError(f"Could not find the {label} <script src> tag to inline.")
    return new_html


def strip_codemirror(html: str) -> str:
    html = re.sub(r'\s*<link\b[^>]*codemirror[^>]*>', "", html, flags=re.IGNORECASE)
    html = re.sub(
        r'\s*<script\b[^>]*src="[^"]*codemirror[^"]*"[^>]*>\s*</script>',
        "",
        html,
        flags=re.IGNORECASE,
    )
    return html


def load_data(path: Path) -> dict:
    """Load question data from CSV / JSON / YAML into a {config, questions} dict."""
    suffix = path.suffix.lower()
    text = read_text(path)
    if suffix == ".json":
        data = json.loads(text)
        if isinstance(data, list):
            return {"config": {}, "questions": data}
        return data
    if suffix in {".yaml", ".yml"}:
        import yaml

        data = yaml.safe_load(text)
        if isinstance(data, list):
            return {"config": {}, "questions": data}
        return data
    if suffix == ".csv":
        import csv

        rows = list(csv.DictReader(text.splitlines()))
        return {"config": {}, "questions": rows}
    raise ValueError(f"Unsupported data format: {path.suffix}")


def embed_data(html: str, data: dict) -> str:
    payload = escape_for_script(json.dumps(data, indent=2, ensure_ascii=False))
    block = (
        '<script id="questionnaire-v3-data" type="application/json">\n'
        + payload
        + "\n</script>"
    )
    new_html, count = re.subn(
        r'<script\b[^>]*id="questionnaire-v3-data"[^>]*>.*?</script>',
        lambda _m: block,
        html,
        count=1,
        flags=re.DOTALL,
    )
    if count == 0:
        raise ValueError('Could not find the #questionnaire-v3-data script block.')
    return new_html


def build(
    template_path: Path,
    output_path: Path,
    css_path: Path,
    mustache_path: Path,
    library_path: Path,
    data_path: Path | None,
) -> None:
    html = read_text(template_path)
    html = inline_css(html, read_text(css_path))
    html = inline_script(html, r"[^\"]*mustache[^\"]*", read_text(mustache_path), "Mustache.js")
    html = inline_script(html, r"(?:[^\"]*/)?questionnaire_v3\.js", read_text(library_path), "questionnaire_v3.js")
    html = strip_codemirror(html)
    if data_path is not None:
        html = embed_data(html, load_data(data_path))
    output_path.write_text(html, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a self-contained v3 questionnaire HTML file.")
    parser.add_argument("template", type=Path, help="Input v3 HTML template (uses external CSS/JS references).")
    parser.add_argument("output", type=Path, help="Output standalone HTML file.")
    parser.add_argument("--css", type=Path, default=Path("questionnaire.css"))
    parser.add_argument("--mustache", type=Path, default=Path("mustache.min.js"))
    parser.add_argument("--library", type=Path, default=Path("questionnaire_v3.js"))
    parser.add_argument("--data", type=Path, default=None, help="Optional CSV/JSON/YAML question data to embed.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    build(
        template_path=args.template,
        output_path=args.output,
        css_path=args.css,
        mustache_path=args.mustache,
        library_path=args.library,
        data_path=args.data,
    )
    size_kb = args.output.stat().st_size / 1024
    print(f"Built {args.output} ({size_kb:.0f} KB, self-contained)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
