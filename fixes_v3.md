# V3 Questionnaire — Fixes and Enhancements Specification

This document specifies 17 targeted fixes and new features for `questionnaire_v3.js` and its companion files. Each section is written as an implementable specification; references to function names and approximate line numbers reflect the state of `questionnaire_v3.js` at v3 as shipped.

---

## 1. Tabular view: link to normal view per question

Each row in the tabular view includes a **"View"** link/button in the controls column (alongside Edit and Delete). Clicking it navigates the app to the normal view for the question's category and scrolls to that question card.

Implementation:
- Render an `<a>` or `<button>` with `data-tabular-view="<id>"` in the controls cell produced by `renderTabularRow`.
- The handler calls `app.navigateTo({ role: app.getRole(), view: "normal", category: question.category })` and then sets `app._pendingScrollId = question.id`, which the existing `resolveAnchorId` / `_pendingScrollId` mechanism in the rendering cycle picks up to scroll the card into view.
- This reuses the existing anchor-navigation path already used by deep-link URLs (`#editor-normal-<id>`).

---

## 2. `is_other` free-text companion for radio/dropdown

When a `radio` or `dropdown` question has an option with `is_other: true` and the user selects that option, a companion free-text field appears immediately below the radio/select control. When any other option is selected, the field is hidden.

**Answer semantics:** while the `is_other` option is selected, the answer stored is the text the user typed (not the option's `value`). When a non-`is_other` option is selected, the answer is that option's `value` as usual.

**Companion field sizing:** follows the same `rows` rule as `yes_or_text`/`no_or_text`:
- `rows` is absent, `null`, or `<= 1` → `<input type="text">`
- `rows > 1` → `<textarea rows="N">`

Implementation:
- In `renderRadio` and `renderDropdown`, after the main control, append a companion element (hidden by default) with class `q-other-input` and attribute `data-other-input`.
- When rendering, if the current answer is a string that does not match any non-other option value, the `is_other` option is pre-selected and the companion field is shown and pre-filled with the answer.
- Add `handleOtherChange(event, question)` (analogous to `handleYesNoChange`): on change of the radio/select, show the companion if the selected option has `is_other: true`, hide it otherwise. On input in the companion field, call `updateAnswer(question.id, event.target.value)`.
- Wire `handleOtherChange` in `bindQuestionControls` for `radio` and `dropdown` types.

**Initial state when "Other" is first selected:** store `null` as the answer (not the option's `value`, not `""`). The companion field is shown but empty. This is consistent with `yes_or_text` behaviour when the text field first appears.

---

## 3. Default value: textarea in editor and tabular view

The `default` field editor must use a multiline textarea everywhere it appears.

Changes:
- In `DEFAULT_EDITOR_FIELDS` (line ~63), change the `default` entry from `ui: "text"` to `ui: "textarea"`.
- In `renderTabularCell`, the `default` column currently falls through to an `<input type="text">`. Change that branch to `<textarea rows="1" ...>` matching the existing `answer` and `question` column rendering.

---

## 4. New question type: `date`

Add `"date"` to `QUESTION_TYPES`.

Rendering in `renderQuestionControl` (new branch for `type === "date"`):

```html
<div class="q-date-block">
  <input type="date" data-answer value="{{answer}}">
  <button type="button" data-date-today>Today</button>
</div>
```

- The `data-date-today` button click handler sets the answer to today's date in the **user's local timezone** (not UTC) and calls `updateAnswer`. Use local components: `var d = new Date(); var iso = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");`. Do not use `toISOString()` which returns UTC and may return the previous calendar day for users east of UTC.
- In read-only contexts (interviewed normal view with no editing), render the date as plain text (formatted or ISO, implementation choice).
- Answer stored as ISO date string (scalar); CSV/JSON import/export works unchanged.
- Tabular cell for `date` renders `<input type="date" data-tabular-answer ...>` matching the existing tabular answer cell pattern.

---

## 5. Visibility filter checkboxes (reviewer & editor)

In reviewer and editor roles, two checkboxes control which question types are rendered:

- **"Show normal questions"** (`id="show-normal-checkbox"`) — default checked (`true`)
- **"Show reviewer questions"** (`id="show-reviewer-checkbox"`) — default checked (`true`)


State is stored on the app instance as `this.showNormalQuestions` and `this.showReviewerQuestions` (both initialised to `true`).

`passesRoleView(question)` is updated: a non-`review` question is filtered out when `this.showNormalQuestions === false`; a `review`-type question is filtered out when `this.showReviewerQuestions === false`.

**Visibility of checkboxes**
The checkboxes should only be shown in reviewer and editor modes.

**Default values**
The checkboxes should have (view-dependent) default values adhering to the current behaviour: in normal view the showNormalQuestions=true, showReviewerQuestions=false,
in overview mode the showNormalQuestions=false, showReviewerQuestions=true. In tabular view: showNormalQuestions=true, showReviewerQuestions=true (all questions visible). It is acceptable to set these defaults when the view is changed.

**Highlighting rule:** The `.q-reviewer-card` highlight class is applied to reviewer question cards **only when both types are visible simultaneously**. When only reviewer questions are shown (normal hidden), reviewer cards render without `.q-reviewer-card` (they need no visual distinction when they are the only type displayed).

The checkboxes are wired up in `syncSelects` (or a new `syncVisibilityToggles` called from `syncSelects`): if elements with those IDs exist in the document, their `change` event sets the corresponding flag and calls `render()`. The host HTML in `example-questionnaire-v3.html` and `empty-questionnaire-v3.html` should add these checkboxes to the toolbar, visible only for `reviewer` and `editor` roles via `data-roles="reviewer editor"`.

---

## 6. Reviewer comments as right-margin annotations (Word-style)

Reviewer comments move from their current inline-below position to a right-margin balloon, similar to comments in Microsoft Word.

**Interviewed role (read-only comment):**
- If `reviewer_comment` is non-empty, render a `.q-comment-balloon` element absolutely positioned to the right of the question card.
- The balloon has a left connector line, blue border, rounded corners, and a small header (e.g. "Reviewer note").
- The question card gets `position: relative` so the balloon is positioned relative to it.

**Reviewer / editor roles (editable comment):**
- The comment textarea (`data-reviewer-comment-control`) is rendered inside the same `.q-comment-balloon` container at the right margin rather than below the answer.
- The balloon is always visible for reviewer/editor (even when empty, showing a placeholder).

**Responsive fallback:** when viewport width < 900 px (CSS `@media (max-width: 900px)`), `.q-comment-balloon` reverts to `position: static; margin-top: 8px` — the current inline layout.

**Template context:** add `_has_comment` boolean (`!!reviewer_comment`) to the Mustache render context for use in the default card templates.

CSS additions in `questionnaire.css`:
```css
.q-comment-balloon {
  position: absolute;
  right: -220px;
  top: 0;
  width: 200px;
  border: 1px solid var(--q-accent-soft);
  border-left: 3px solid var(--q-accent);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 0.85em;
  background: #f0f6ff;
}
@media (max-width: 900px) {
  .q-comment-balloon { position: static; width: auto; margin-top: 8px; }
}
```

---

## 7. Summary: total reviewer question count

`renderSummaryBlock` currently shows per-status counts and a weighted RAG score. The total reviewer question count is already appended inline to the score line as `"(N review)"` (line 1385). That display is too subtle.

Changes:
- `computeScore` already returns `summary.total` (confirmed: `reviewCount` in `computeScore`). No new computation needed.
- Replace the current inline `" (" + summary.total + " review)"` suffix with a dedicated second line in the score div, and also add a standalone count element:
  ```html
  <div class="q-summary-score">{{scoreText}}</div>
  <div class="q-summary-total"><strong>{{total}}</strong> review question(s)</div>
  ```
- The count is shown in both the category-level summary block and the overall summary block.

---

## 8. Reviewer questions: answer editor hidden by default

For `review`-type question cards, the answer control block (`.q-answer-block`) should not be rendered by default. In the default template the rendering should be blocked by a html comment <!-- -->.

---

## 9. Reviewer questions: compact layout

The review status select/pill sits on the same line as the question heading when horizontal space allows; it wraps below-right on narrow cards.

**Template change required (JS):** In `DEFAULT_REVIEWER_CARD`, move `<div data-review-control></div>` **inside** `<div class="q-card-head">`, immediately after the `<span class="q-meta-pill">`. Currently `data-review-control` sits outside `.q-card-head`, so the injected status select cannot be positioned by the head's flex layout.

Updated `DEFAULT_REVIEWER_CARD` structure:
```html
<div class="q-card-head">
  <h3 class="q-prompt">{{question}}</h3>
  <span class="q-meta-pill q-status-{{review_status}}">{{_status_label}}</span>
  <div data-review-control></div>          <!-- moved inside -->
  {{#_editor}}…edit button…{{/_editor}}
</div>
```

CSS change for `.q-reviewer-card .q-card-head`:
```css
.q-reviewer-card .q-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.q-reviewer-card .q-card-head .q-review-status,
.q-reviewer-card .q-card-head .q-meta-pill {
  margin-left: auto;
}
```

The flex layout places the status right-aligned on the same line as the `<h3>` heading; when the heading is long it wraps to the next line aligned to the right. The `.q-meta-pill` is shown when role is `interviewed`; `.q-review-status` (the select rendered by `renderReviewControl`) is shown in reviewer/editor — both get `margin-left: auto`.

The `question-editor-template` HTML in `example-questionnaire-v3.html` / `empty-questionnaire-v3.html` is a user-customisable `<template>`, not `DEFAULT_REVIEWER_CARD`, so users who have already customised the reviewer card template must move `data-review-control` inside their template's `.q-card-head` manually.

---

## 10. `visible_if_id`: datalist autocomplete input

Change `visible_if_id` in the editor from a plain `<select>` (current `ui: "question_select"`) to a text input with `<datalist>`, allowing both free typing and picking from the list of question IDs.

New `ui` type: `"question_datalist"`.

Rendering in `renderEditorField`:
```html
<input type="text"
       list="qlist-visible-{{editingQuestionId}}"
       data-editor-field="visible_if_id"
       value="{{visible_if_id}}">
<datalist id="qlist-visible-{{editingQuestionId}}">
  {{#questions}}<option value="{{id}}">{{/questions}}
</datalist>
```

- The datalist `id` must be unique per editing question to avoid collisions when multiple editors are open (use the currently-edited question's `id` as suffix).
- The datalist is populated from `this.questions.map(q => q.id)` at render time.
- `updateQuestionField` already handles `visible_if_id` as a plain string — no backend change needed.
- In `DEFAULT_EDITOR_FIELDS`, update the `visible_if_id` entry: `{ name: "visible_if_id", ..., ui: "question_datalist" }`.

---

## 11. `visible_if_value`: datalist from target question's options

`visible_if_value` becomes a free-text input with a smart datalist populated from the target question's options.

New `ui` type: `"visibility_value_datalist"`.

Datalist options (populated at render time, based on the current `visible_if_id` value):
- Always include: `true`, `false`, `other`, `!true`, `!false`
- If `visible_if_id` resolves to a known question with `options`, include each `option.value` and its negated form `!<value>`
- If the target question has no options, only the keyword list is shown

Rendering:
```html
<input type="text"
       list="qval-visible-{{editingQuestionId}}"
       data-editor-field="visible_if_value"
       value="{{visible_if_value}}">
<datalist id="qval-visible-{{editingQuestionId}}">
  <option value="true">
  <option value="false">
  <option value="other">
  ...target question option values...
</datalist>
```

The datalist is regenerated on each editor re-render. Since editing `visible_if_id` calls `updateQuestionField` which triggers a re-render of the editor panel, the datalist automatically updates when the user changes the target question ID.

In `DEFAULT_EDITOR_FIELDS`, update the `visible_if_value` entry: `{ name: "visible_if_value", ..., ui: "visibility_value_datalist" }`.

---

## 12. CodeMirror: fix `empty-questionnaire-v3.html`

`empty-questionnaire-v3.html` currently omits CodeMirror CDN tags entirely. `example-questionnaire-v3.html` loads them correctly. There is also a `file://` URL security error caused by `history.pushState` on `file://` pages in Chrome.

**Fix 1 — add CDN tags to `empty-questionnaire-v3.html`:**

Add before the closing `</head>`:
```html
<link rel="stylesheet" href="https://unpkg.com/codemirror@5/lib/codemirror.css">
```

Add before `</body>` (after `questionnaire_v3.js`):
```html
<script src="https://unpkg.com/codemirror@5/lib/codemirror.js"></script>
<script src="https://unpkg.com/codemirror@5/mode/htmlmixed/htmlmixed.js"></script>
<script src="https://unpkg.com/codemirror@5/mode/xml/xml.js"></script>
<script src="https://unpkg.com/codemirror@5/mode/javascript/javascript.js"></script>
<script src="https://unpkg.com/codemirror@5/mode/css/css.js"></script>
```

Mustache.js stays **inlined** in `empty-questionnaire-v3.html` (the file is designed to work without an internet connection once saved).

**Fix 2 — `file://` pushState error:**

The existing `updateHash` already has a try/catch around `pushState` (line 1152–1158), but Chrome's `file://` security violation is a **console error, not a thrown exception** — so the catch branch is never entered and the error still appears.

Fix: add a protocol guard so `pushState` is never attempted on `file://` origins. Replace:
```js
if (W.history && typeof W.history.pushState === "function") {
```
with:
```js
if (W.history && typeof W.history.pushState === "function" && W.location.protocol !== "file:") {
```

This causes `updateHash` to fall through to `W.location.hash = anchor` on `file://` pages, which works correctly in all browsers.

**Offline fallback:** The existing textarea fallback for when `window.CodeMirror` is unavailable must be preserved unchanged.

---

## 13. New view: `display`

Add `"display"` as a new view to `VIEWS` and `ROLE_VIEWS`.

**Availability:** `interviewed`, `reviewer`, `editor`  
**Default view:** unchanged (display is opt-in, not default for any role)

**Behaviour:**
- All categories are rendered on a single page (no pagination); the category nav is hidden in this view.
- Categories are rendered as `<h2>` section headings.
- Each visible question uses a new minimal template `display_card` (added to `TEMPLATE_IDS` and editable in the template view): renders the question text, the answer as plain human-readable text (not an input), and optionally the reviewer comment. The Mustache context includes a `_answer_display` variable (string) in addition to the raw `{{answer}}`. `_answer_display` converts special values: `true` → `"Yes"`, `false` → `"No"`, `null`/`undefined` → `""`, any string → the string as-is. For `yes_or_text` and `no_or_text`, `true` → `"Yes"` and `false` → `"No"` (the companion text string is stored directly as the answer when typed, so it already displays correctly). The `display_card` template should use `{{_answer_display}}` rather than raw `{{answer}}`.
- Reviewer questions are only visible for `reviewer` and `editor` roles; a separate `display_reviewer_card` template renders: review status label, reviewer comment, and a per-category summary (counts + score) — not the answer editor.
- No input controls, no Edit/Delete buttons, no card borders or shadows — purely a human-readable document view.
- Container gets class `q-display`; minimal CSS: generous `line-height`, no `.q-card` box styles, category `<h2>` headings with a bottom border.
- The display view is print-friendly (use `@media print` to hide the header/toolbar).

**New CSS:**
```css
.q-display .q-card { box-shadow: none; border: none; padding: 0; margin-bottom: 1.5em; }
.q-display .q-card-head h3 { font-size: 1em; font-weight: 600; }
.q-display h2.q-display-category { border-bottom: 1px solid #ccc; margin: 1.5em 0 0.5em; }
```

---

## 14. Editable header and footer templates

The application header (blue bar with title, role/view selects, and action buttons) and footer (Prev/Next buttons) are currently hardcoded in the host HTML. Add Mustache-powered templates for both so they can be customised and saved as part of the questionnaire document.

**New template IDs** (added to `TEMPLATE_IDS`):
- `header` — template for the `.q-header` element
- `footer` — template for the `.q-footer` element

**New methods:**
- `proto.renderHeader()` — renders the `header` template into `this.containers.header` if that container is set
- `proto.renderFooter()` — renders the `footer` template into `this.containers.footer` if that container is set
- Both are called from `render()` after the questions container is rebuilt

**Container registration:** host HTML passes `header` and `footer` elements in the `containers` option:
```js
containers: {
  ...,
  header: document.querySelector(".q-header"),
  footer: document.querySelector(".q-footer")
}
```

**Template context:** same top-level Mustache context as question cards — includes `{{title}}`, `{{version}}`, `{{id}}` from config, plus `{{_role}}`, `{{_view}}`, `{{_editor}}`, `{{_reviewer}}`, `{{_interviewed}}`.

**Default templates:** replicate the current hardcoded appearance so existing questionnaires look unchanged before any customisation.

**Binding interactive header controls:** Because `renderHeader()` replaces `innerHTML` on every `render()`, event listeners set in the host `<script>` block become stale after the first re-render. The library must bind all standard interactive elements itself via `bindHeader()` called after each `renderHeader()`. Standard controls are identified by `data-` attributes on the template elements (not hard-coded IDs):

| `data-` attribute | Action |
|---|---|
| `data-role-select` | `change` → `app.setRole(value)` + `syncRoleControls` |
| `data-view-select` | `change` → `app.setView(value)` |
| `data-prev-category` | `click` → `app.previousCategory()` |
| `data-next-category` | `click` → `app.nextCategory()` |
| `data-save-csv` | `click` → `app.saveCsvFile(...)` |
| `data-save-json` | `click` → `app.saveJsonFile(...)` |
| `data-save-html` | `click` → `app.saveHtmlFile(...)` |
| `data-load-csv` | `change` (file input) → `app.loadCsv(text)` |

The existing host HTML (`example-questionnaire-v3.html`, `empty-questionnaire-v3.html`) must be updated to add these `data-` attributes to the corresponding elements, and the manually-wired event listeners in the `<script>` block must be removed (the library handles them now).

For backwards compatibility, `syncSelects` continues to sync the `<select>` values (selected option) after role/view changes.

**Host HTML changes** (`example-questionnaire-v3.html` and `empty-questionnaire-v3.html`): add `<template id="header-template">` and `<template id="footer-template">` elements with the default content, wired via `templateOverrides` or new `TEMPLATE_IDS` resolution in `resolveTemplate`.

---

## 15. Fix tabular view scrolling on row reorder

**Problem:** The tabular view wraps the `<table>` in a `<div class="q-tabular-scroll">` with `max-height: 70vh; overflow: auto`. This creates a separate scroll container. When a row is reordered via the up/down buttons, `swapQuestion` calls `render()` which rebuilds `innerHTML`, resetting the scroll container's `scrollTop` to 0 — the view jumps to the top of the table.

**Fix:**

1. In `renderTabular`, remove the `<div class="q-tabular-scroll">` wrapper. Render `<table class="q-tabular">` directly into the container element.

2. In `questionnaire.css`, remove (or zero out) `max-height` and `overflow: auto` from `.q-tabular-scroll`:
   ```css
   .q-tabular-scroll { /* max-height: 70vh; overflow: auto; */ }
   ```
   The sticky `<thead>` (`position: sticky; top: 0`) continues to work correctly — with the wrapper removed, the sticky anchor is the page viewport itself.

3. **Preserve scroll position across re-renders:** add a `_pendingScrollY` property on the app instance. In `swapQuestion` (and `deleteQuestion`, `addQuestion`, any tabular operation that calls `render()`), save `window.scrollY` to `this._pendingScrollY` before calling `render()`. At the end of `render()`, if `_pendingScrollY` is set, call `window.scrollTo(0, this._pendingScrollY)` and clear it.

---

## 16. Drag-and-drop row reordering in tabular view

Add HTML5 drag-and-drop reordering to tabular rows in editor role.

**Rendering (editor role only):**
- Each `<tr data-tabular-row="<id>">` gets `draggable="true"`.
- A drag handle indicator (e.g. `⣿` or `≡`) is rendered in the controls cell to signal draggability to the user.

**Event handlers** (wired in `bindTabular`):

| Event | Target | Action |
|-------|--------|--------|
| `dragstart` | `<tr>` | Store source `question.id` in `event.dataTransfer` (text/plain); add `.q-drag-source` class |
| `dragover` | `<tr>` | `event.preventDefault()` (enables drop); add `.q-drag-over` class; remove it from other rows |
| `dragleave` | `<tr>` | Remove `.q-drag-over` class |
| `drop` | `<tr>` | Read source id from `dataTransfer`; get target id from `closest("[data-tabular-row]")`. Call `moveQuestion(sourceId, { before: targetId })`. Prevent default. |
| `dragend` | `<tr>` | Remove `.q-drag-source` and all `.q-drag-over` classes |

**`moveQuestion(id, { before })` (new proto method):**
- Finds question with `id`, removes it from `this.questions`, re-inserts it immediately before the question with id `before`.
- If `before` is `null` or `undefined`, or does not match any question id (e.g. dropping past the last row), the question is appended to the end of the list.
- Calls `triggerChange({ type: "reorder" })` and `render()`.
- Uses `_pendingScrollY` (from fix #15) to prevent scroll-to-top.

**Drop at end of list:** The last `<tr>` has a `<td>` drop zone below it. When the user drags past the last row, `dragover` fires on the table's `<tbody>` or on the last row. Detect "below last row" by checking if the drop Y coordinate is below the midpoint of the last row; if so, pass `before: null` to `moveQuestion` to append at end.

**CSS:**
```css
.q-drag-source { opacity: 0.4; }
.q-drag-over { outline: 2px solid var(--q-accent-soft); }
tr[draggable="true"] { cursor: grab; }
```

Drag-and-drop is only active in editor role (`draggable` attribute omitted for reviewer).

---

## 17. "Sort by category" button in tabular view

Add a **"Sort by category"** button to the tabular toolbar, visible in editor role only (alongside the existing "Add question" button).

**Behaviour:** reorders `this.questions` so that questions are grouped by category, preserving:
1. Category order by first appearance (same ordering as `getCategories()` returns).
2. Relative order of questions within each category (stable sort).

**Implementation:**
```js
proto.sortByCategory = function () {
  var self = this;
  var categories = this.getCategories();
  var sorted = [];
  categories.forEach(function (cat) {
    self.questions.forEach(function (q) {
      if (q.category === cat) sorted.push(q);
    });
  });
  this.questions = sorted;
  this.triggerChange({ type: "reorder" });
  this._pendingScrollY = window.scrollY;
  this.render();
};
```

**Rendering:** in `renderTabular`, add to the toolbar:
```html
<button type="button" data-tabular-sort-category>Sort by category</button>
```

**Binding:** in `bindTabular`, add click handler:
```js
container.addEventListener("click", function (e) {
  if (e.target.closest("[data-tabular-sort-category]")) self.sortByCategory();
});
```
