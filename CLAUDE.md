# CLAUDE.md — Questionnaire V3 Project

## Project overview

Browser-only questionnaire library. No build step, no backend. A single JS file
(`questionnaire_v3.js`) + CSS (`questionnaire.css`) that runs in static HTML.

Specification: `spec_v3.md` (data model, roles, views, templates, API).
Fixes/enhancements spec: `fixes_v3.md`.
Developer guide: `doc.md` (usage examples, API reference, hook patterns).

## Key files

| File | Purpose |
|---|---|
| `questionnaire_v3.js` | The library (single file, no dependencies except Mustache.js) |
| `questionnaire.css` | Default stylesheet |
| `empty-questionnaire-v3.template.html` | Source template — uses external `<script src>` and `<link>` tags |
| `empty-questionnaire-v3.html` | **Built artifact** — self-contained (CSS + JS + Mustache inlined). Has its own embedded copy of the JS. |
| `example-questionnaire-v3.html` | Example with sample questions. Uses external `questionnaire_v3.js` via `<script src>`. |
| `test_visibility.html` | Unit tests — visibility expressions, runs in browser |
| `test_other.mjs` | UI tests — Playwright, tests controls (radio, dropdown, yes_or_text, etc.) |
| `build_questionnaire_v3.py` | Builds `empty-questionnaire-v3.html` from the template |
| `convert_questionnaire_v2_to_v3.py` | Offline migration of v1/v2 files to v3 format |
| `doc.md` | Developer guide with API reference tables |
| `spec_v3.md` | Full specification |
| `fixes_v3.md` | Targeted fixes and enhancements spec |

## File relationships and sync rules

### Three HTML files must stay in sync

The **template** (`empty-questionnaire-v3.template.html`) is the source of truth
for the application shell, `<template>` elements, and initialization script.

`example-questionnaire-v3.html` must have the same shell structure (header,
footer, `<template>` elements, container IDs) as the template file, plus its own
sample question data and onChange hook.

`empty-questionnaire-v3.html` is a **built artifact** that additionally contains
a full embedded copy of `questionnaire_v3.js`, `questionnaire.css`, and
`mustache.min.js`. **When you change the JS or CSS, you must rebuild it** (see
below). Its embedded JS must match `questionnaire_v3.js` exactly.

When modifying the application shell (header markup, `<template>` elements,
`<script id="questionnaire-v3-script">` init code), update **all three HTML files**.

### Template resolution — single source of truth

The library captures initial template content from the DOM before the first
render. Resolution chain:

1. `templateOverrides` (user edits from the template view, or loaded from saved file)
2. `_initialTemplates` (captured from DOM on init: `<template>` elements and header/footer `innerHTML`)
3. `FALLBACK_TEMPLATES` (bootstrap-only, for pages with no DOM content at all)

The HTML file is the source of truth for templates. `FALLBACK_TEMPLATES` in the
JS is a last resort — keep it in sync but don't rely on it. If you add a new
element to the header/footer or `<template>`, add it in the HTML files; the
library reads it from there.

### doc.md must match the implementation

`doc.md` contains the API reference tables and usage examples. When you add,
rename, or remove a public method or config option, update `doc.md` to match.
Check the "API Reference" section and the relevant guide sections.

## Building empty-questionnaire-v3.html

After changing `questionnaire_v3.js`, `questionnaire.css`, or the template:

```bash
python3 build_questionnaire_v3.py empty-questionnaire-v3.template.html empty-questionnaire-v3.html
```

This inlines the CSS, Mustache.js, and the JS library into the output. Always
rebuild after any change to these source files. Verify the result opens correctly
in a browser.

## Testing

### Start the dev server

All browser-based tests require a local HTTP server:

```bash
python3 -m http.server 8765
```

Leave it running in a background terminal.

### Unit tests (visibility expressions)

Open `http://localhost:8765/test_visibility.html` in a browser. Results are
displayed inline — all assertions must show PASS. These test the visibility
expression parser (`visible_if_value` syntax) and boolean normalization.

To run headless:

```bash
node -e "
const { chromium } = require('/home/orest/.nvm/versions/node/v16.20.2/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('console', m => console.log(m.text()));
  await p.goto('http://localhost:8765/test_visibility.html');
  await p.waitForTimeout(1000);
  const failed = await p.evaluate(() => document.querySelectorAll('.fail').length);
  await b.close();
  process.exit(failed > 0 ? 1 : 0);
})();
"
```

### UI tests (Playwright)

```bash
node test_other.mjs
```

Tests radio/dropdown `is_other` companion fields, `yes_or_text`, `no_or_text`
controls. Requires the dev server on port 8765. Uses
`example-questionnaire-v3.html`.

### Manual smoke test checklist

After non-trivial changes, verify in a real browser (not just tests):

1. **example-questionnaire-v3.html** — switch through all 3 roles + all views
2. **empty-questionnaire-v3.html** — same; also test Load CSV → add questions → Save HTML → reopen
3. Visibility checkboxes (Normal / Reviewer) appear in reviewer and editor roles, hidden in interviewed
4. Template view (editor role → Source code) — edit a template, verify live preview updates
5. Save HTML → reopen the saved file — templates, questions, and onChange hook persist
6. Category navigation, Prev/Next buttons
7. Reviewer summary panel in overview view

### Writing new tests

- **Pure logic tests** (parsing, expressions, normalization): add to `test_visibility.html`
  using the existing `assert(description, actual, expected)` pattern.
- **UI interaction tests** (controls, rendering, navigation): add to `test_other.mjs`
  using the existing `check(description, actual, expected)` pattern with Playwright.
- Test files use `example-questionnaire-v3.html` as the test page. If you need
  questions with specific properties, add them to that file's question array.

## Code conventions

- ES5 in `questionnaire_v3.js` — no arrow functions, no `let`/`const`, no template literals,
  no destructuring, no `class`. Use `var`, `function`, `prototype`. The library targets
  maximum browser compatibility without a transpiler.
- Host HTML init scripts (`<script>` blocks in the HTML files) may use modern JS (ES6+).
- CSS uses `.q-` prefix for all library classes. CSS variables for theming are
  defined in `:root` in `questionnaire.css`.
- No external dependencies except Mustache.js (required) and CodeMirror 5 (optional, for
  the template editor; falls back to `<textarea>` when absent).

## Common pitfalls

- **Don't add features to `FALLBACK_TEMPLATES` without adding them to the HTML files.**
  The HTML is the source of truth; the fallbacks are bootstrap-only. This has caused
  bugs before (visibility checkboxes disappeared because they were only in the HTML,
  not in the JS fallback that `renderHeader()` used).
- **`renderHeader()` replaces `innerHTML` on every render.** Don't manually wire
  event listeners on header elements in the host script — use `bindHeader()` which
  re-binds after each render, or rely on the library's built-in bindings.
- **`empty-questionnaire-v3.html` has its own copy of the JS.** Changes to
  `questionnaire_v3.js` do NOT automatically propagate. Rebuild with `build_questionnaire_v3.py`.
- **Question IDs and category values must not contain dashes** (`-`). Dashes are
  the separator in the URL hash anchor format (`#role-view-id`).
