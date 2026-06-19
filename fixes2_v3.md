# V3 Questionnaire — Fixes and Enhancements Specification (Part 2)

This document specifies 9 targeted fixes and new features for `questionnaire_v3.js`, `questionnaire.css`, and companion HTML files. Each section is written as an implementable specification; references to function names and approximate line numbers reflect the state of `questionnaire_v3.js` after the fixes_v3.md implementation cycle.

---

## 1. ID field not correctly editable

Editing a question's `id` field — in the editor form or the tabular view — silently breaks because internal tracking references (`editingId`, `data-tabular-id` attributes) still hold the old id after the field value changes.

### Current behaviour

**Editor form:** `bindEditorForm` (line ~2395) captures the question `id` in a closure variable and passes it to `updateQuestionField(id, "id", newValue)`. The function looks up `this.getQuestion(id)` using the old id, sets `question.id = newValue`, then calls `render()`. After render, `renderEditorPanel` calls `this.getQuestion(this.editingId)` — but `this.editingId` still holds the old id, so `getQuestion` returns `null` and the editor panel closes (line ~2207: `this.editingId = null; return;`).

**Tabular view:** Each input has `data-tabular-id` set to the question's id at render time (line ~2579–2586). For text inputs, `deferRender` is `true`, so the DOM is not rebuilt after each keystroke. The first keystroke changes `question.id` to a new value, but the input's `data-tabular-id` still holds the old id. The second keystroke calls `updateQuestionField(oldId, ...)` and `getQuestion(oldId)` returns `null` — the edit is silently lost.

### Desired behaviour

1. When `updateQuestionField` is called with `field === "id"`, after changing `question.id` to the new value, also update `this.editingId` to the new value so the editor panel survives re-render.

2. In the tabular view, when the `id` field changes with `deferRender: true`, update the input's `data-tabular-id` attribute in-place so subsequent keystrokes target the correct question.

3. Cascade `visible_if_id` references: when a question's id changes from `oldId` to `newId`, iterate over all questions and update any `question.visible_if_id === oldId` to `newId`.

4. Validate the new id: must not be empty, must not contain dashes (`-`), and must not duplicate an existing question's id. If validation fails, reject the change silently (do not update `question.id`).

### Implementation

**In `updateQuestionField` (line ~785)**, add a new branch at the top of the field-specific processing:

```js
if (field === "id") {
  value = String(value || "").trim();
  if (!value || value.indexOf("-") !== -1) { return; }
  var duplicate = self.questions.some(function (q) {
    return q !== question && q.id === value;
  });
  if (duplicate) { return; }
  var oldId = question.id;
  question.id = value;
  // Cascade visible_if_id references
  self.questions.forEach(function (q) {
    if (q.visible_if_id === oldId) { q.visible_if_id = value; }
  });
  // Keep editor panel tracking the renamed question
  if (self.editingId === oldId) { self.editingId = value; }
}
```

**In `bindEditorForm` (line ~2395)**, the closure captures `id` as a plain variable. After the `id` field changes, the closure variable is stale. Use a mutable wrapper:

```js
proto.bindEditorForm = function (container, initialId) {
  var self = this;
  var ref = { id: initialId };
  // ... all existing uses of `id` become `ref.id` ...
  panel.querySelectorAll("input[data-editor-field]...").forEach(function (input) {
    // ...
    input.addEventListener(eventType, function () {
      var field = input.getAttribute("data-editor-field");
      var value = input.type === "checkbox" ? input.checked : input.value;
      self.updateQuestionField(ref.id, field, value, { ... });
      if (field === "id") { ref.id = value; }
    });
  });
};
```

**In `bindTabular` (line ~2579)**, after the `updateQuestionField` call for deferred text inputs, update the attribute in-place:

```js
self.updateQuestionField(qid, field, value, { deferRender: !isImmediate });
if (field === "id") {
  input.setAttribute("data-tabular-id", value);
}
```

---

## 2. Compact tabular view (spreadsheet-like)

The tabular view has generous padding, rounded inputs with white backgrounds on coloured cells, and a minimum input width of 90 px. This wastes space and does not resemble a spreadsheet.

### Current CSS

- `.q-tabular-table th, td`: `padding: 6px 8px` (line ~890)
- `.q-tabular-table input, select, textarea`: `min-width: 90px`, `border-radius: 6px`, `padding: 4px 6px`, `background: #ffffff` (lines ~913–924)
- Group background colours are on `td` cells: `.q-tabular-group-question`, `.q-tabular-group-ui`, `.q-tabular-group-optional` (lines ~909–911)
- `.q-tabular`: `margin-top: 18px` (line ~854)

### Desired appearance

A dense, spreadsheet-like table: inputs fill cells edge-to-edge, inputs carry the group background colour (not the cells), and cell/input padding is minimal.

### CSS changes

```css
.q-tabular { margin-top: 6px; }

.q-tabular-table th,
.q-tabular-table td { padding: 1px 2px; }

.q-tabular-table input,
.q-tabular-table select,
.q-tabular-table textarea {
  min-width: 60px;
  border-radius: 2px;
  padding: 1px 3px;
  background: transparent;
}

/* Cells become transparent; inputs carry the group colour */
.q-tabular-group-question,
.q-tabular-group-ui,
.q-tabular-group-optional { background: transparent; }

td.q-tabular-group-question input,
td.q-tabular-group-question select,
td.q-tabular-group-question textarea { background: var(--q-tabular-group-question-bg); }
td.q-tabular-group-ui input,
td.q-tabular-group-ui select,
td.q-tabular-group-ui textarea { background: var(--q-tabular-group-ui-bg); }
td.q-tabular-group-optional input,
td.q-tabular-group-optional select,
td.q-tabular-group-optional textarea { background: var(--q-tabular-group-optional-bg); }

/* Group HEADER row cells keep their background */
.q-tabular-groups th.q-tabular-group-question { background: var(--q-tabular-group-question-bg); }
.q-tabular-groups th.q-tabular-group-ui { background: var(--q-tabular-group-ui-bg); }
.q-tabular-groups th.q-tabular-group-optional { background: var(--q-tabular-group-optional-bg); }

/* Read-only spans also get the group background */
td.q-tabular-group-question .q-tabular-readonly,
td.q-tabular-group-question .q-tabular-preview { background: var(--q-tabular-group-question-bg); }
/* ... same for ui and optional groups */

.q-tabular-controls button { padding: 1px 4px; margin: 0; }
```

---

## 3. Adjust column widths in tabular view

All input columns have the same `min-width: 90px` (now 60 px after Fix 2). Some columns need more space (`question`) while others need less (`rows`, `required`, `weight`).

### Implementation

Use CSS attribute selectors targeting the `data-tabular-field` attribute that each cell input already carries:

```css
/* Wide column */
.q-tabular-table input[data-tabular-field="question"],
.q-tabular-table textarea[data-tabular-field="question"] {
  min-width: 200px;
}

/* Narrow columns */
.q-tabular-table input[data-tabular-field="rows"],
.q-tabular-table input[data-tabular-field="weight"] {
  min-width: 40px;
}

.q-tabular-table input[data-tabular-field="required"] {
  min-width: 24px;   /* checkbox — needs almost no width */
}

.q-tabular-table textarea[data-tabular-field="default"] {
  min-width: 80px;
}
```

The `type` and `review_status` `<select>` elements are naturally sized by their option text; no override needed. Other columns (`id`, `category`, `visible_if_id`, etc.) keep the default 60 px minimum from Fix 2.

---

## 4. New "Review" column group in tabular view

Currently `review_status`, `reviewer_comment`, `weight`, and `weight_score` are in `GROUP_OPTIONAL`. They should form a dedicated `GROUP_REVIEW` between the Question and UI groups.

### Current groups (line ~78–80)

```js
var GROUP_QUESTION = ["id", "category", "subcategory", "question", "default", "help", "answer"];
var GROUP_UI = ["type", "options", "rows", "visible_if_id", "visible_if_value", "required"];
var GROUP_OPTIONAL = ["review_status", "reviewer_comment", "weight", "weight_score", "analysis"];
```

### New groups

```js
var GROUP_QUESTION = ["id", "category", "subcategory", "question", "default", "help", "answer"];
var GROUP_REVIEW = ["review_status", "reviewer_comment", "weight", "weight_score"];
var GROUP_UI = ["type", "options", "rows", "visible_if_id", "visible_if_value", "required"];
var GROUP_OPTIONAL = ["analysis"];   // plus any extra (unknown) fields
```

Column order: Controls | Question | Review | UI | Optional (+ extra fields)

### Changes to `tabularColumns()` (line ~2420)

Return a four-group object:

```js
return {
  question: GROUP_QUESTION.slice(),
  review: GROUP_REVIEW.slice(),
  ui: GROUP_UI.slice(),
  optional: GROUP_OPTIONAL.concat(extra)
};
```

### Changes to `renderTabular()` (line ~2450)

Update `allColumns` concatenation:

```js
var allColumns = groups.question.concat(groups.review, groups.ui, groups.optional);
```

Update the group header row to include Review:

```html
<th class="q-tabular-group-question" colspan="...">Question</th>
<th class="q-tabular-group-review" colspan="...">Review</th>
<th class="q-tabular-group-ui" colspan="...">UI</th>
<th class="q-tabular-group-optional" colspan="...">Optional</th>
```

### Changes to `renderTabularRow()` (line ~2494)

Update the group class lookup to include `review`:

```js
var groupClass = groups.question.indexOf(col) !== -1 ? "q-tabular-group-question"
  : groups.review.indexOf(col) !== -1 ? "q-tabular-group-review"
  : groups.ui.indexOf(col) !== -1 ? "q-tabular-group-ui"
  : "q-tabular-group-optional";
```

Apply the same change in the column header generation in `renderTabular`.

### New CSS variable and classes

```css
:root {
  --q-tabular-group-review-bg: #f3eef8;   /* light purple — reviewer tone */
}

.q-tabular-groups th.q-tabular-group-review { background: var(--q-tabular-group-review-bg); }

td.q-tabular-group-review input,
td.q-tabular-group-review select,
td.q-tabular-group-review textarea { background: var(--q-tabular-group-review-bg); }
```

---

## 5. "Show hidden" visibility checkbox

Add a third visibility checkbox that allows reviewers and editors to see all questions, including those hidden by a failed `visible_if` expression or `type === "ignore"`. The primary use case is reviewing the full questionnaire structure without having to fill in controlling answers first.

### State

New property: `this.showHidden = false;` (initialised in constructor, line ~650). The checkbox is **unchecked by default** — hidden questions remain hidden until the user explicitly opts in. Unlike `showNormalQuestions`/`showReviewerQuestions`, it does **not** reset when the view changes — it is a global toggle.

### Checkbox placement

The checkbox appears alongside "Normal" and "Reviewer", visible in reviewer and editor roles only. Add to:

- `FALLBACK_TEMPLATES.header` — after the Reviewer checkbox:
  ```html
  <label class="q-toolbar-checkbox" data-roles="reviewer editor">
    <input type="checkbox" id="show-hidden-checkbox"><span>Hidden</span>
  </label>
  ```
- All three HTML files (`empty-questionnaire-v3.template.html`, `empty-questionnaire-v3.html`, `example-questionnaire-v3.html`) — add the same label element after the Reviewer checkbox.

Note: in Fix 7 (menu bar) these checkboxes move into the View dropdown. The `id` and `data-roles` attributes remain the same; only the container changes.

### Binding

In `syncSelects` (line ~1456), after the reviewer checkbox block:

```js
var hiddenCb = doc.getElementById("show-hidden-checkbox");
if (hiddenCb) {
  hiddenCb.checked = this.showHidden;
  if (!hiddenCb._qBound) {
    hiddenCb._qBound = true;
    hiddenCb.addEventListener("change", function () {
      self.showHidden = hiddenCb.checked;
      self.render();
    });
  }
}
```

### Visibility logic changes

**`passesRoleView(question)` (line ~1317):**

```js
if (question.type === "ignore") {
  return this.showHidden;     // was: return false;
}
```

**`isQuestionVisible(question)` (line ~1355):**

```js
proto.isQuestionVisible = function (question) {
  if (!this.passesRoleView(question)) { return false; }
  if (!this.isExpressionVisible(question, [])) {
    return this.showHidden;   // was: implicit false
  }
  return true;
};
```

### Visual treatment

Add `_hidden_revealed` to `questionContext` (line ~1731):

```js
var wouldBeHidden = question.type === "ignore" || !this.isExpressionVisible(question, []);
context._hidden_revealed = wouldBeHidden && this.showHidden;
```

**Normal/overview views:** When rendering a question card, if `context._hidden_revealed` is true, add class `.q-hidden-revealed` to the rendered card element.

**Display view (`renderDisplay`):** Wrap hidden-revealed cards in `<div class="q-display-hidden">`.

**Tabular view:** Already shows all questions. Optionally add `.q-hidden-revealed` to the `<tr>` for subtle styling.

### New CSS

```css
.q-hidden-revealed {
  opacity: 0.55;
  background: #f0f0f0 !important;
  border-left: 3px solid #999;
}

.q-display-hidden {
  color: #999;
}

tr.q-hidden-revealed td { opacity: 0.6; }
```

### Search interaction

"Show hidden" does NOT override search filtering. A question revealed by `showHidden` is still subject to the global search filter (Fix 8). Precedence: `passesRoleView` → `isQuestionVisible` (includes `showHidden`) → search filter.

---

## 6. Library version as timestamp

### Current state

There is no library version constant. Only `this.config.version` which is questionnaire metadata.

### Implementation

Add near the top of `questionnaire_v3.js`, after the `QUESTION_TYPES` constant (line ~39):

```js
var LIB_VERSION = "2026-06-19 14:30";
```

The value is a `YYYY-MM-DD HH:MM` timestamp in local time, updated on each release.

Expose on the public API object (line ~3080):

```js
QuestionnaireV3.VERSION = LIB_VERSION;
```

Add `_lib_version` to template render contexts — both `questionContext` (line ~1731) and `renderHeader`/`renderFooter` contexts (line ~1599):

```js
ctx._lib_version = LIB_VERSION;
```

This makes `{{_lib_version}}` available in all Mustache templates, used by the About dialog (Fix 7).

---

## 7. Menu bar UI replacing toolbar buttons

The current header is a blue card with a title section on the left and a flat toolbar row on the right. Replace the toolbar with a desktop-application-style menu bar **above** the title card.

### New header template structure

The header template becomes two parts:

1. **`<nav class="q-menubar">`** — a horizontal menu bar strip at the top.
2. **The existing title/version card** — unchanged below the menu bar.

Both parts live inside the `<header class="q-header">` container, which changes from a horizontal flex row to a vertical flex column.

### Menu bar layout

**Left side — menu items (click to open dropdown):**

- **File** (`data-roles="reviewer editor"`): Load CSV, Save CSV, Save JSON, Save HTML
- **View** (visible to all roles): View mode buttons (dynamically populated) + separator + visibility checkboxes (`data-roles="reviewer editor"`)
- **Help** (visible to all roles): Description, About

**Right side — always-visible controls:**

- Global search input (`data-global-search`) — visible to all roles
- Role `<select id="role-select">` — visible to all roles
- Save button (`id="save-html-shortcut"`) — visible to all roles (convenience shortcut for Save HTML)

### Role-dependent visibility

The existing `data-roles` / `syncHeaderControls` system is preserved and applies within the menu bar:

- **Interviewed role:** The File menu is visible and contains only Load CSV, Save CSV, and Save HTML (the Save JSON item gets `data-roles="reviewer editor"`). The View menu is **hidden entirely** (`data-roles="reviewer editor"`). The Help menu is visible.
- **Reviewer / editor roles:** The File menu shows all items (Load CSV, Save CSV, Save JSON, Save HTML). The View menu is visible with view mode buttons and visibility checkboxes. The Help menu is visible.
- The right-side Save shortcut, search input, and role select are visible to all roles.

### FALLBACK_TEMPLATES.header replacement

```html
<nav class="q-menubar">
  <div class="q-menu" data-menu="file">
    <button type="button" class="q-menu-trigger">File</button>
    <div class="q-menu-dropdown">
      <label class="q-menu-item q-load-button">📂 Load CSV
        <input type="file" id="load-csv" accept=".csv,text/csv">
      </label>
      <button type="button" class="q-menu-item" id="save-csv">💾 Save CSV</button>
      <button type="button" class="q-menu-item" id="save-json" data-roles="reviewer editor">💾 Save JSON</button>
      <button type="button" class="q-menu-item" id="save-html">💾 Save HTML</button>
    </div>
  </div>
  <div class="q-menu" data-menu="view" data-roles="reviewer editor">
    <button type="button" class="q-menu-trigger">View</button>
    <div class="q-menu-dropdown">
      <div class="q-menu-section" id="view-menu-modes"></div>
      <hr class="q-menu-separator" data-roles="reviewer editor">
      <label class="q-menu-item q-menu-checkbox" data-roles="reviewer editor">
        <input type="checkbox" id="show-normal-checkbox" checked> Normal questions
      </label>
      <label class="q-menu-item q-menu-checkbox" data-roles="reviewer editor">
        <input type="checkbox" id="show-reviewer-checkbox" checked> Reviewer questions
      </label>
      <label class="q-menu-item q-menu-checkbox" data-roles="reviewer editor">
        <input type="checkbox" id="show-hidden-checkbox"> Show hidden
      </label>
    </div>
  </div>
  <div class="q-menu" data-menu="help">
    <button type="button" class="q-menu-trigger">Help</button>
    <div class="q-menu-dropdown">
      <button type="button" class="q-menu-item" data-help-description>📖 Description</button>
      <button type="button" class="q-menu-item" data-help-about>ℹ️ About</button>
    </div>
  </div>
  <div class="q-menubar-right">
    <input type="search" id="global-search" class="q-global-search"
           placeholder="Search…" data-global-search>
    <select id="role-select"></select>
    <button type="button" class="q-menubar-save" id="save-html-shortcut">💾 Save</button>
  </div>
</nav>
<div class="q-title-card">
  <p class="q-kicker">Questionnaire</p>
  <h1 id="questionnaire-title">{{title}}</h1>
  {{#version}}<p id="questionnaire-version" class="q-subtitle">{{version}}</p>{{/version}}
</div>
```

### View menu mode buttons

The `#view-menu-modes` container is populated dynamically by `syncSelects` (replacing the old `<select id="view-select">`):

```js
var viewModes = doc.getElementById("view-menu-modes");
if (viewModes) {
  viewModes.innerHTML = self.getAvailableViews().map(function (view) {
    var active = view === self.view ? " is-active" : "";
    return '<button type="button" class="q-menu-item q-view-mode-btn' + active +
      '" data-view-mode="' + escapeHtml(view) + '">' +
      escapeHtml(self.viewLabels[view]) + '</button>';
  }).join("");
}
```

The old `<select id="view-select">` is removed from the template. If a host template still uses it, `bindHeader` and `syncSelects` still look for it as a fallback.

### bindHeader changes

Add to `bindHeader` (line ~1630):

**Menu open/close:**

```js
container.querySelectorAll(".q-menu-trigger").forEach(function (trigger) {
  trigger.addEventListener("click", function (e) {
    var menu = trigger.closest(".q-menu");
    var wasOpen = menu.classList.contains("is-open");
    container.querySelectorAll(".q-menu.is-open").forEach(function (m) {
      m.classList.remove("is-open");
    });
    if (!wasOpen) { menu.classList.add("is-open"); }
    e.stopPropagation();
  });
});
doc.addEventListener("click", function () {
  container.querySelectorAll(".q-menu.is-open").forEach(function (m) {
    m.classList.remove("is-open");
  });
});
```

**View mode buttons:**

```js
container.querySelectorAll("[data-view-mode]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    self.setView(btn.getAttribute("data-view-mode"));
  });
});
```

**Save shortcut:**

```js
var saveShortcut = container.querySelector("#save-html-shortcut");
if (saveShortcut && !saveShortcut._qBound) {
  saveShortcut._qBound = true;
  saveShortcut.addEventListener("click", function () { self.saveHtmlFile(); });
}
```

**Help → Description and About:**

```js
var descBtn = container.querySelector("[data-help-description]");
if (descBtn) {
  descBtn.addEventListener("click", function () { self.showDescriptionDialog(); });
}
var aboutBtn = container.querySelector("[data-help-about]");
if (aboutBtn) {
  aboutBtn.addEventListener("click", function () { self.showAboutDialog(); });
}
```

### New methods

**`proto.showDescriptionDialog()`** — renders the `description` template into a modal:

```js
proto.showDescriptionDialog = function () {
  var body = this.getTemplateBody("description");
  var html = W.Mustache ? W.Mustache.render(body, {
    title: this.config.title || "",
    version: this.config.version || "",
    _lib_version: LIB_VERSION
  }) : body;
  this._showModal("Description", html);
};
```

**`proto.showAboutDialog()`** — shows title, questionnaire version, and library version:

```js
proto.showAboutDialog = function () {
  var html = '<div class="q-about">' +
    '<p><strong>' + escapeHtml(this.config.title || "Questionnaire") + '</strong></p>' +
    (this.config.version ? '<p>Version: ' + escapeHtml(this.config.version) + '</p>' : '') +
    '<p>Library: ' + escapeHtml(LIB_VERSION) + '</p>' +
    '</div>';
  this._showModal("About", html);
};
```

**`proto._showModal(title, contentHtml)`** — generic modal overlay:

```js
proto._showModal = function (title, contentHtml) {
  var doc = W.document;
  var existing = doc.querySelector(".q-modal-overlay");
  if (existing) { existing.remove(); }
  var overlay = doc.createElement("div");
  overlay.className = "q-modal-overlay";
  overlay.innerHTML =
    '<div class="q-modal">' +
    '<div class="q-modal-head"><h2>' + escapeHtml(title) +
    '</h2><button type="button" class="q-modal-close">&times;</button></div>' +
    '<div class="q-modal-body">' + contentHtml + '</div></div>';
  doc.body.appendChild(overlay);
  overlay.querySelector(".q-modal-close").addEventListener("click", function () {
    overlay.remove();
  });
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) { overlay.remove(); }
  });
};
```

### New template: `description`

Add `"description"` to `TEMPLATE_IDS` (line ~41):

```js
var TEMPLATE_IDS = [
  "question_card", "reviewer_card", "editor_form",
  "display_card", "display_reviewer_card", "header", "footer",
  "description",
  "css", "onchange", "script", "data"
];
```

Add to `TEMPLATE_LABELS`:

```js
description: "Description"
```

Add to `TEMPLATE_FORMAT` (if it exists — used for CodeMirror mode selection):

```js
description: "html"
```

Add default content to `FALLBACK_TEMPLATES`:

```js
description:
  '<div class="q-description">\n' +
  '  <p>Fill in the questionnaire and click <strong>Save</strong> to download\n' +
  '  your answers as an HTML file in your Downloads folder.</p>\n' +
  '  <p>Your answers are stored only in the downloaded file — nothing is sent\n' +
  '  to a server.</p>\n' +
  '</div>'
```

The description template is editable in the Source code view (template editor) alongside other templates.

### CSS: header layout change

```css
.q-header {
  /* Change from horizontal to vertical layout */
  flex-direction: column;
  padding: 0;          /* menu bar handles its own padding */
  gap: 0;
  border-radius: 18px;
  overflow: hidden;    /* clip the menu bar's square corners at the top */
}

.q-title-card {
  padding: 20px 28px;
  background: var(--q-header-bg);
  color: var(--q-header-text);
}

.q-title-card h1, .q-title-card p { margin: 0; }
```

### CSS: menu bar

```css
.q-menubar {
  display: flex;
  align-items: center;
  gap: 0;
  flex-wrap: wrap;
  background: var(--q-header-bg);
  color: var(--q-header-text);
  padding: 0 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 0.85rem;
  line-height: 1;                 /* keep the bar thin */
}

.q-menu { position: relative; }

.q-menu-trigger {
  background: transparent;
  border: none;
  color: inherit;
  padding: 3px 10px;             /* compact trigger buttons */
  cursor: pointer;
  font-size: 0.85rem;
  border-radius: 3px;
}

.q-menu-trigger:hover { background: rgba(255, 255, 255, 0.15); }

.q-menu-dropdown {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 200px;
  background: #ffffff;
  color: var(--q-ink);
  border: 1px solid var(--q-border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 100;
  padding: 4px 0;
}

.q-menu.is-open .q-menu-dropdown { display: block; }

.q-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.88rem;
  color: var(--q-ink);
}

.q-menu-item:hover { background: var(--q-accent-soft); }

.q-menu-checkbox { cursor: pointer; }
.q-menu-checkbox input[type="checkbox"] { margin-right: 8px; }

.q-menu-separator {
  border: none;
  border-top: 1px solid var(--q-border);
  margin: 4px 0;
}

.q-view-mode-btn.is-active {
  font-weight: 600;
  background: var(--q-accent-soft);
}

.q-menubar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}

.q-global-search {
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 4px 8px;
  font-size: 0.85rem;
  background: rgba(255, 255, 255, 0.15);
  color: inherit;
  width: 160px;
}

.q-global-search::placeholder { color: rgba(255, 255, 255, 0.6); }

.q-menubar-save {
  background: rgba(255, 255, 255, 0.9);
  color: var(--q-ink);
  border: none;
  border-radius: 4px;
  padding: 2px 10px;
  cursor: pointer;
  font-size: 0.82rem;
}

/* modal */
.q-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.q-modal {
  background: #ffffff;
  color: var(--q-ink);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  max-width: 540px;
  width: 90%;
  max-height: 80vh;
  overflow: auto;
}

.q-modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--q-border);
}

.q-modal-head h2 { margin: 0; font-size: 1.1rem; }

.q-modal-close {
  background: transparent;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  color: var(--q-ink);
}

.q-modal-body { padding: 16px 20px; }
```

### Old toolbar CSS

The `.q-toolbar` class and children (`.q-toolbar-actions`, `.q-toolbar-action`, `.q-toolbar-checkbox`) become unused by the default template. Keep them in `questionnaire.css` for backwards compatibility with custom header templates that still use the old layout.

### HTML file changes

All three HTML files must be updated:

1. Replace the `<div class="q-toolbar">...</div>` block inside `<header class="q-header">` with the new `<nav class="q-menubar">...</nav>` + `<div class="q-title-card">...</div>` structure.
2. The `<script id="questionnaire-v3-script">` event-listener wiring for role-select, view-select, save buttons, load-csv is handled by `bindHeader()`. Remove manual event listener code that duplicates this.
3. The `updateSaveLabel()` function should target `#save-html-shortcut` instead of `#save-html`.

---

## 8. Global search field

The search input moves from the tabular toolbar to the menu bar (right side) and applies across all views where it makes sense.

### Current state

`this.editorSearch` (line ~643) is set only in the tabular view's search input handler (line ~2560). `editorQuestionMatchesSearch` (line ~2440) checks `id`, `question`, `answer`. Only `renderTabular` filters through the search.

### Changes

**Add `reviewer_comment` to search fields.** In `editorQuestionMatchesSearch` (line ~2440):

```js
proto.editorQuestionMatchesSearch = function (question, search) {
  var needle = String(search || "").trim().toLowerCase();
  if (!needle) { return true; }
  return [question.id, question.question, question.answer, question.reviewer_comment]
    .some(function (value) {
      return displayValue(value).toLowerCase().indexOf(needle) !== -1;
    });
};
```

**Bind the global search input in `bindHeader`** (see Fix 7 for the `data-global-search` element):

```js
var globalSearch = container.querySelector("[data-global-search]");
if (globalSearch) {
  globalSearch.value = self.editorSearch || "";
  if (!globalSearch._qBound) {
    globalSearch._qBound = true;
    globalSearch.addEventListener("input", function () {
      self.editorSearch = globalSearch.value;
      self.render();
    });
  }
}
```

Since `renderHeader()` is called inside `render()` and replaces `innerHTML`, the search input loses focus. After render, restore it:

In `renderHeader()`, after `container.innerHTML = ...` and `this.bindHeader(container)`:

```js
var searchEl = container.querySelector("[data-global-search]");
if (searchEl) {
  searchEl.value = this.editorSearch || "";
  if (doc.activeElement && doc.activeElement.getAttribute &&
      doc.activeElement.getAttribute("data-global-search") !== null) {
    searchEl.focus();
  }
}
```

Alternatively, `renderHeader` can detect that nothing changed and skip the innerHTML replacement, but the above approach is simpler.

**Apply search in `renderQuestions`** (line ~1696):

```js
var visible = this.currentQuestions().filter(function (question) {
  return self.isQuestionVisible(question) &&
         self.editorQuestionMatchesSearch(question, self.editorSearch);
});
```

**Apply search in `renderDisplay`** (line ~1571):

After the `isQuestionVisible` check, add:

```js
if (!self.editorQuestionMatchesSearch(question, self.editorSearch)) { return; }
```

**Remove the tabular search input:** In `renderTabular` (line ~2483), remove the `<label class="q-editor-search">` element from the toolbar HTML. Remove the `searchInput` binding in `bindTabular` (lines ~2560–2570). The tabular view continues to filter through `editorQuestionMatchesSearch` using the global `this.editorSearch` property — it just no longer has its own input.

**Source code view:** The search does NOT apply to the template editor. No change needed.

**Reviewer summary panel:** The summary scores in overview view should NOT be affected by the search filter — they always reflect the full dataset. Only the displayed question cards are filtered.

### Search interaction with visibility

Search filtering is applied after visibility filtering. A question that is revealed by "Show hidden" (Fix 5) is still subject to the search. The search cannot reveal questions that are hidden by role/view rules.

Precedence: `passesRoleView` → `isQuestionVisible` (includes `showHidden`) → search filter.

---

## 9. Wider question editor panel

The slide-in editor panel (opened by the Edit button in normal or tabular view) is currently capped at 540 px. On modern screens this leaves most fields cramped, especially `options` and multi-line fields like `question` and `help`.

### Current CSS (questionnaire.css, line ~965)

```css
.q-editor-panel {
  width: min(540px, 100%);
}
```

### Desired behaviour

Widen the panel to approximately 40% of the viewport, with a reasonable minimum so it does not become too narrow on smaller screens:

```css
.q-editor-panel {
  width: min(40vw, 100%);
  min-width: 400px;
}
```

On a 1920 px-wide display this gives ~768 px; on a 1440 px display ~576 px. The `min-width: 400px` prevents the panel from shrinking below usable size; the `100%` cap ensures it never exceeds the viewport on mobile.
