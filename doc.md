# Questionnaire V3 — Developer Guide

## Anatomy of the HTML File

A v3 questionnaire is a single self-contained HTML file. Its structure follows this pattern:

```
index.html
├── <head>
│   ├── questionnaire.css              (library styles)
│   └── codemirror.css                 (CDN, for template editor)
│
├── <body>
│   ├── Application shell              (host-authored header, nav, containers)
│   ├── <template> elements            (Mustache templates, read by the library)
│   ├── CDN <script> tags              (Mustache.js, CodeMirror)
│   ├── questionnaire_v3.js            (library)
│   ├── <script id="questionnaire-v3-data">  (embedded question data, JSON)
│   ├── <script id="questionnaire-v3-templates">  (embedded template overrides, JSON)
│   └── <script>                       (host initialization code)
```

### The Application Shell

The shell is plain HTML you write. The library renders into named container elements you provide:

```html
<div class="q-shell">
  <header class="q-header">
    <h1 id="questionnaire-title"></h1>
    <select id="role-select"></select>
    <select id="view-select"></select>
    <button onclick="app.saveCsvFile('q.csv')">💾 Save CSV</button>
    <button onclick="app.saveHtmlFile('q.html')">💾 Save HTML</button>
    <label>📂 Load CSV <input type="file" id="load-csv" accept=".csv"></label>
  </header>

  <nav id="category-nav"></nav>   <!-- category tabs rendered here -->
  <div id="summary"></div>        <!-- reviewer summary panel rendered here -->
  <main id="questions"></main>    <!-- question cards rendered here -->
  <section id="editor"></section> <!-- tabular/template view rendered here -->
</div>
```

The library does not generate the shell. You own the layout entirely.

### Embedded Data Block

When you click **💾 Save HTML**, the library rewrites two `<script>` blocks in the document:

```html
<!-- Question data — rewritten on Save HTML -->
<script id="questionnaire-v3-data" type="application/json">
{
  "config": { "id": "my-questionnaire", "title": "My Questionnaire", "version": "3.0" },
  "questions": [ ... ]
}
</script>

<!-- Template overrides and onChange hook — rewritten on Save HTML -->
<script id="questionnaire-v3-templates" type="application/json">
{
  "question_card":   "...",
  "reviewer_card":   "...",
  "editor_form":     "...",
  "onchange":        "..."
}
</script>
```

On the next page load, the initialization code reads these blocks and restores state. The file is fully portable: copy it anywhere and it works.

### Initialization Code

```html
<script>
  const data      = JSON.parse(document.getElementById("questionnaire-v3-data").textContent);
  const templates = JSON.parse(document.getElementById("questionnaire-v3-templates").textContent);

  const app = QuestionnaireV3.create({
    config:    data.config,
    questions: data.questions,
    role:      "interviewed",
    roleLabels:   { interviewed: "Applicant", reviewer: "Validator", editor: "Designer" },
    statusLabels: { pending: "?", satisfactory: "OK", partial: "WARN", unsatisfactory: "ERR" },
    ragThresholds: { green: 80, amber: 50 },  // or null to disable RAG
    containers: {
      questions:   document.getElementById("questions"),
      categoryNav: document.getElementById("category-nav"),
      editor:      document.getElementById("editor"),
      summary:     document.getElementById("summary")
    },
    templates: {
      questionCard:         document.getElementById("question-card-template"),
      reviewerQuestionCard: document.getElementById("reviewer-question-card-template"),
      editorForm:           document.getElementById("question-editor-template")
    },
    templateOverrides: templates,  // string templates/hook saved by the template editor
    onChange(event, api) {
      // See "Implementing Hooks" section
    }
  });

  document.getElementById("role-select").addEventListener("change", e => app.setRole(e.target.value));
  document.getElementById("view-select").addEventListener("change", e => app.setView(e.target.value));
  document.getElementById("load-csv").addEventListener("change", e => {
    const reader = new FileReader();
    reader.onload = ev => app.loadCsv(ev.target.result);
    reader.readAsText(e.target.files[0]);
  });
</script>
```

---

## Templates

Templates use [Mustache.js](https://github.com/janl/mustache.js) syntax. Three templates exist; all are optional — the library has built-in fallbacks.

### Question Card Template (`question_card`)

Renders one question in normal and overview views. The library injects interactive controls into placeholder elements marked with `data-*` attributes.

```html
<template id="question-card-template">
  <section class="q-card" data-question-id="{{id}}">
    <div class="q-card-head">
      <h3 class="q-prompt">{{question}}</h3>
      {{#required}}<span class="q-required">*</span>{{/required}}
      {{#subcategory}}<span class="q-subcategory">{{subcategory}}</span>{{/subcategory}}
      {{#_editor}}<button type="button" class="q-edit-btn" data-edit-question="{{id}}">✏️ Edit</button>{{/_editor}}
    </div>
    {{#help}}<p class="q-help">{{help}}</p>{{/help}}

    <!-- Analysis: shown to reviewers and editors -->
    {{#_analysis_visible}}<p class="q-analysis">{{analysis}}</p>{{/_analysis_visible}}

    <!-- Library injects the answer control here -->
    <div class="q-answer-block" data-question-control></div>

    <!-- Reviewer comment shown read-only (blue) to interviewed users -->
    {{#_comment_readonly}}<div class="q-reviewer-comment">{{reviewer_comment}}</div>{{/_comment_readonly}}

    <!-- Library injects the review status control (review-type, reviewer/editor) -->
    <div data-review-control></div>
    <!-- Library injects the editable reviewer comment (reviewer/editor) -->
    <div data-reviewer-comment-control></div>

    {{#_errors}}
      <p class="q-error">{{.}}</p>
    {{/_errors}}
  </section>
</template>
```

**Available context variables:**

| Variable | Type | Description |
| --- | --- | --- |
| All question fields | — | `id`, `category`, `question`, `help`, `answer`, `review_status`, `reviewer_comment`, `weight`, `analysis`, etc. |
| `_role` | string | Current role (`interviewed`, `reviewer`, `editor`) |
| `_view` | string | Current view (`normal`, `tabular`, `overview`, `template`) |
| `_editor` | boolean | `true` when the role is `editor` |
| `_visible` | boolean | Whether the question passes its visibility condition |
| `_is_review` | boolean | `true` if `type === "review"` |
| `_category_title` | string | Display title of the question's category |
| `_status_label` | string | Configured label for the current `review_status` |
| `_analysis_visible` | boolean | `true` when `analysis` exists and role is `reviewer`/`editor` |
| `_comment_readonly` | boolean | `true` when role is `interviewed` and a `reviewer_comment` exists |
| `_errors` | string[] | Validation error messages for this question |

The library fills three control slots regardless of the template: `data-question-control` (answer), `data-review-control` (review status), and `data-reviewer-comment-control` (editable comment). The latter two are left empty when not applicable to the current role and question type.

Mustache sections work naturally for conditional rendering:
- `{{#required}}...{{/required}}` — renders only if `required` is truthy
- `{{^_is_review}}...{{/_is_review}}` — renders only for non-review questions
- `{{#_errors}}{{.}}{{/_errors}}` — iterates over validation errors

### Reviewer Question Card Template (`reviewer_card`)

Shown for `review`-type questions when they are visible: in the reviewer `overview` view and in the editor role. (Reviewer `normal` shows only non-review questions; reviewer `overview` shows only review questions.) Falls back to the normal question card if not provided. The `.q-reviewer-card` class highlights these cards.

```html
<template id="reviewer-question-card-template">
  <section class="q-card q-reviewer-card" data-question-id="{{id}}">
    <div class="q-card-head">
      <h3 class="q-prompt">{{question}}</h3>
      <span class="q-meta-pill q-status-{{review_status}}">{{_status_label}}</span>
    </div>
    {{#analysis}}<p class="q-analysis">{{analysis}}</p>{{/analysis}}
    {{#help}}<p class="q-help">{{help}}</p>{{/help}}
    <div class="q-answer-block" data-question-control></div>
    <div data-review-control></div>
    <div data-reviewer-comment-control></div>
  </section>
</template>
```

### Editor Form Template (`editor_form`)

Controls the layout of the single-question editor panel. Use `data-editor-field="<fieldname>"` to place field editors:

```html
<template id="question-editor-template">
  <form class="q-editor-form" data-question-editor>
    <fieldset class="q-editor-section">
      <legend>Identity</legend>
      <div data-editor-field="id"></div>
      <div data-editor-field="category"></div>
      <div data-editor-field="type"></div>
    </fieldset>
    <fieldset class="q-editor-section">
      <legend>Content</legend>
      <div data-editor-field="question"></div>
      <div data-editor-field="help"></div>
    </fieldset>
    <fieldset class="q-editor-section">
      <legend>Behavior</legend>
      <div data-editor-field="required"></div>
      <div data-editor-field="options"></div>
      <div data-editor-field="rows"></div>
    </fieldset>
    <fieldset class="q-editor-section">
      <legend>Visibility</legend>
      <div data-editor-field="visible_if_id"></div>
      <div data-editor-field="visible_if_value"></div>
    </fieldset>
    <fieldset class="q-editor-section">
      <legend>Review</legend>
      <div data-editor-field="weight"></div>
      <div data-editor-field="analysis"></div>
    </fieldset>
    <fieldset class="q-editor-section">
      <legend>State</legend>
      <div data-editor-field="answer"></div>
      <div data-editor-field="review_status"></div>
      <div data-editor-field="reviewer_comment"></div>
    </fieldset>
  </form>
</template>
```

Each `data-editor-field="<fieldname>"` slot is replaced with that field's editor control. Group the fields into `<fieldset>` sections however you like; the layout is entirely host-controlled.

---

## Implementing Hooks

The `onChange` hook is called after every user interaction. Use it to implement rules, derived values, and dynamic content.

### Hook Signature

```js
onChange(event, api)
```

**`event` fields:**

| Field | Description |
| --- | --- |
| `event.type` | Event type: `"answer"`, `"review_status"`, `"reviewer_comment"`, `"role"`, `"view"` |
| `event.question_id` | ID of the changed question (if applicable) |
| `event.field` | Changed field name |
| `event.value` | New value |
| `event.previous_value` | Previous value |
| `event.role` | Current role at time of event |
| `event.view` | Current view at time of event |

**`api` methods available inside the hook:**

```js
api.getAnswer(id)
api.setAnswer(id, value, { silent: true })
api.getQuestion(id)
api.getQuestions()
api.getReviewStatus(id)
api.setReviewStatus(id, status, { silent: true })
api.getReviewerComment(id)
api.setReviewerComment(id, comment, { silent: true })
```

Always pass `{ silent: true }` for calls inside `onChange` to prevent infinite loops.

### Example: Calculate a Derived Value

```js
onChange(event, api) {
  const income   = Number(api.getAnswer("q_income")   || 0);
  const expenses = Number(api.getAnswer("q_expenses") || 0);
  const balance  = income - expenses;

  // Update an info-type question with the calculated balance
  api.setAnswer("q_balance_info",
    `Balance: ${balance.toLocaleString()}`,
    { silent: true }
  );
}
```

### Example: Set Reviewer Status Based on Another Question's Answer

This is the core rule pattern: a `review`-type question's status is automatically set based on what the user answered in a regular question.

```js
onChange(event, api) {
  // Only act on answer changes to the relevant question
  if (event.question_id !== "q_has_conflicts" || event.type !== "answer") return;

  // yes_or_no answers are stored as booleans
  const hasConflicts = api.getAnswer("q_has_conflicts");

  // "q_review_conflicts" is a review-type question with weight 2
  if (hasConflicts === true) {
    api.setReviewStatus("q_review_conflicts", "unsatisfactory", { silent: true });
  } else if (hasConflicts === false) {
    api.setReviewStatus("q_review_conflicts", "satisfactory", { silent: true });
  } else {
    // Not yet answered — leave as pending
    api.setReviewStatus("q_review_conflicts", "pending", { silent: true });
  }
}
```

The corresponding question data:

```json
[
  {
    "id": "q_has_conflicts",
    "category": "governance",
    "question": "Does the project have any conflicts of interest?",
    "type": "yes_or_no"
  },
  {
    "id": "q_review_conflicts",
    "category": "governance",
    "question": "Conflicts of interest assessment",
    "type": "review",
    "weight": 2,
    "analysis": "Auto-set from q_has_conflicts answer"
  }
]
```

### Example: Multi-Condition Rule

```js
onChange(event, api) {
  const affected   = ["q_income", "q_expenses", "q_debt"];
  if (!affected.includes(event.question_id)) return;

  const income   = Number(api.getAnswer("q_income")   || 0);
  const expenses = Number(api.getAnswer("q_expenses") || 0);
  const debt     = Number(api.getAnswer("q_debt")     || 0);
  const ratio    = income > 0 ? (expenses + debt) / income : Infinity;

  let status;
  if (ratio < 0.5)        status = "satisfactory";
  else if (ratio < 0.8)   status = "partial";
  else                    status = "unsatisfactory";

  api.setReviewStatus("q_review_financial", status, { silent: true });

  // Also update an info display for the interviewed user
  api.setAnswer("q_financial_summary",
    `Expense/debt ratio: ${(ratio * 100).toFixed(1)}%`,
    { silent: true }
  );
}
```

### Editing the Hook in the Browser

Switch to editor role → template view → select **onChange** from the template selector. The hook body (the function body, without the outer `function(event, api) {…}` wrapper) is editable with JavaScript syntax highlighting. Changes apply live and are saved when you click **💾 Save HTML**.

---

## Navigation and Deep Linking

The URL hash reflects the current state as `#role-view` or `#role-view-id`:

| Hash | Meaning |
| --- | --- |
| `#interviewed-normal` | Interviewed role, normal view |
| `#reviewer-overview` | Reviewer role, overview (summary panel visible) |
| `#reviewer-normal-governance` | Reviewer, normal view, "governance" category |
| `#reviewer-normal-q_has_conflicts` | Reviewer, normal view, scrolled to that question |
| `#editor-tabular` | Editor, tabular view |
| `#editor-template-onchange` | Editor, template view, onChange tab open |

Share a URL with a specific hash to deep-link reviewers directly to a category or question.

---

## Python Migration Script

To convert old v1 or v2 files to v3 format:

```bash
python convert_questionnaire_v2_to_v3.py input.yaml output.csv
python convert_questionnaire_v2_to_v3.py input.json output.json
python convert_questionnaire_v2_to_v3.py input_flat.csv output.json
```

The script renames `prompt`→`question`, `page_id`→`category`, `textarea_rows`→`rows`, `visible_if_question_id`→`visible_if_id`, converts `reviewer_question: true` to `type: review`, merges `visible_if_operator` into `visible_if_value`, drops removed fields, and appends unknown fields after the known v3 fields.

---

## Building a Self-Contained HTML File

`build_questionnaire_v3.py` inlines the CSS, Mustache.js (vendored as `mustache.min.js`), and the `questionnaire_v3.js` library into a single page that works offline with no external requests. CodeMirror is intentionally **not** embedded — the template editor falls back to a plain `<textarea>` without it — so any CodeMirror `<link>`/`<script>` tags in the input are stripped.

```bash
# Empty, self-contained questionnaire from the bundled template
python build_questionnaire_v3.py empty-questionnaire-v3.template.html empty-questionnaire-v3.html

# Self-contained build with question data embedded from CSV/JSON/YAML
python build_questionnaire_v3.py empty-questionnaire-v3.template.html out.html --data questions.csv
```

Options: `--css`, `--mustache`, `--library` override the asset paths; `--data` embeds question data into the `#questionnaire-v3-data` block. The input is any v3 HTML page that references `questionnaire.css`, a Mustache `<script src>`, and `questionnaire_v3.js` (the `empty-questionnaire-v3.template.html` and `example-questionnaire-v3.html` files both qualify).
