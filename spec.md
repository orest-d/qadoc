# Questionnaire Library Specification

## 1. Purpose

This document specifies a simple embeddable JavaScript and CSS library that renders a questionnaire from a JSON specification and allows the resulting answers and review data to be saved as a JSON document using a client-side data URL.

The library must run entirely in the browser. No server component is allowed or required.

In addition to the browser runtime, the project must include a Python build script that combines the questionnaire data, JavaScript, CSS, and HTML template into a single self-contained HTML output file.

## 2. Goals

- Provide a lightweight embeddable `javascript + css` library.
- Provide exactly one distributable JavaScript file and one distributable CSS file.
- Provide exactly one HTML template in Mustache format.
- Accept a questionnaire definition in JSON format.
- Accept a questionnaire definition in JSON or YAML format as build input.
- Render the questionnaire into an existing HTML document.
- Support multi-page questionnaires.
- Support conditional question flow based on previous answers.
- Allow an interviewed user to answer questions.
- Allow a reviewer to assign statuses to questions.
- Allow saving the completed result as a JSON document via client-side download using a data URL.
- Allow loading a previously saved JSON state back into the generated HTML document.
- Produce a single standalone HTML file for delivery and use.

## 3. Non-Goals

- No backend, database, or remote API.
- No authentication or user management.
- No collaborative real-time editing.
- No requirement for offline storage beyond in-memory state and downloadable JSON export.
- No requirement for a JavaScript build toolchain for basic generation.

## 4. Actors

### 4.1 Interviewed

The interviewed role:

- views the questionnaire,
- navigates between pages,
- answers questions,
- optionally edits prefilled text where allowed.

The interviewed role must not assign review statuses unless explicitly enabled by the application embedding the library.

### 4.2 Reviewer

The reviewer role:

- views the questionnaire and answers,
- assigns a status to each question,
- may add optional review notes if the embedding application enables that feature.

The reviewer role may also view unanswered questions and conditional visibility states.

## 5. High-Level Architecture

The solution consists of:

- a JavaScript library that parses the questionnaire JSON and renders UI,
- a CSS stylesheet that provides default presentation,
- a single Mustache HTML template,
- a Python generator script that reads questionnaire input and produces a standalone HTML page.

The generated standalone HTML file contains:

- the questionnaire specification,
- the embedded JavaScript,
- the embedded CSS,
- the rendered application shell,
- client-side save and load controls.

The browser library must expose an API similar to:

```js
QuestionnaireRenderer.render({
  container: document.getElementById("app"),
  spec: questionnaireSpec,
  role: "interviewed"
});
```

The exact API name may vary, but the library must support:

- initialization into a DOM container,
- loading questionnaire JSON,
- selecting the current role,
- getting the current answer/review state as JSON,
- generating a downloadable data URL for the state,
- loading state from previously saved JSON data.

### 5.1 Distribution Artifacts

The source layout must include at least:

- one JavaScript file,
- one CSS file,
- one Mustache HTML template,
- one Python script that generates the final HTML output.

Example source artifact names:

- `questionnaire.js`
- `questionnaire.css`
- `questionnaire.mustache.html`
- `build_questionnaire.py`

Exact filenames may vary, but the one-file-per-artifact constraint is required.

### 5.2 Build Process

The Python script must:

- read questionnaire input from JSON or YAML,
- read the JavaScript file,
- read the CSS file,
- read the Mustache template,
- combine them into one self-contained HTML document,
- write the resulting HTML file to disk.

The generated HTML must not depend on any external network resource.

### 5.3 Safe Embedding Requirements

Because JavaScript, CSS, and questionnaire data are embedded into a generated HTML file, the build process must handle escaping safely.

The Python generator must:

- safely embed CSS inside a `<style>` element,
- safely embed JavaScript inside a `<script>` element,
- safely embed questionnaire data as JSON,
- prevent accidental termination of `<script>` or `<style>` blocks due to unescaped content,
- preserve valid Unicode and quotation characters in questionnaire text.

Recommended approach:

- embed questionnaire data inside a `<script type="application/json">` element,
- escape any `</script>` sequence in embedded JSON and JavaScript content,
- avoid direct string interpolation of raw JSON into executable JavaScript code,
- apply equivalent care for any content placed inside `<style>` or template markup.

## 6. Rendering Model

### 6.1 Pages

The questionnaire must support multiple pages.

Each page:

- has an identifier,
- has a title,
- contains zero or more questions,
- may include descriptive text.

The UI must provide:

- next page navigation,
- previous page navigation,
- an indication of the current page,
- optional prevention of advancing when required visible questions are unanswered.

### 6.2 Questions

Each question must have:

- a unique identifier,
- a question type,
- a prompt,
- optional help text,
- optional required flag,
- optional visibility condition,
- optional default value,
- optional `allow_freetext` flag,
- runtime state fields for answer and review information.

### 6.3 Supported Question Types

The library must support at least these question types:

1. `checkbox`
   - Single boolean choice.
   - Example: yes/no acceptance represented as checked/unchecked.

2. `radio`
   - Single-choice multiple option selection.
   - Example: select one from a list of answers.

3. `dropdown`
   - Single-choice selection from a drop-down list of options.
   - Useful when there are many options or a compact UI is preferred.

4. `text`
   - Free text input.
   - May be single-line or multi-line, depending on configuration.
   - May contain the predefined text. If answer field is empty, default field is used. 

If desired in implementation, `editable_predefined_text` may be modeled as a specialized `text` question with additional configuration, but it must behave as a first-class supported feature.

### 6.4 Shared Question Parameters

All question types must support the following shared parameters:

- `default`
- `allow_freetext`
- `answer`
- `review_status`
- `reviewer_comment`

#### `default`

The `default` field defines the initial value for the question before the interviewed user provides an answer.

#### `allow_freetext`

The `allow_freetext` field is a boolean flag that optionally enables additional free-text input for a question.

When `allow_freetext` is enabled, rendering depends on question type:

- `checkbox`
  - may render an optional companion text field for explanation or details. The text field is only enabled when the checkbox is unchecked.
- `radio`
  - may render an additional "Other" style text entry or a companion detail field. Text entry is only visible when Other is selected.
- `dropdown`
  - may render an additional "Other" style text entry or a companion detail field. Text entry is only visible when Other is selected.
- `text`
  - may be ignored because the question is already free-text by nature, or may enable an additional companion detail field if the implementation chooses.

The implementation must document the exact rendering behavior for `text`. The recommended default is:

- for `radio` and `dropdown`, `allow_freetext` enables an "Other" text input,
- for `checkbox`, `allow_freetext` enables an optional explanation field,
- for `text` and `editable_predefined_text`, the flag is accepted for schema consistency but has no additional UI effect unless explicitly configured by the embedding application.

#### `answer`

The `answer` field represents the current interviewed response.

#### `review_status`

The `review_status` field represents the current reviewer assessment.

#### `reviewer_comment`

The `reviewer_comment` field stores optional reviewer remarks for the question.

## 7. Conditional Logic

The questionnaire must support showing or hiding subsequent questions depending on answers to previous questions.

### 7.1 Requirements

- A question may define a visibility condition.
- A condition may reference answers to earlier questions.
- Hidden questions must not be shown.
- Hidden questions should not block page completion.
- Hidden questions should either:
  - keep their previously entered answers but exclude them from validation, or
  - be reset when hidden.

The implementation must choose one behavior and document it clearly. The recommended default is to keep hidden answers unless the embedding application explicitly requests reset-on-hide behavior.

### 7.2 Minimum Condition Support

The JSON format must support at least:

- equality check,
- inequality check,
- checkbox true/false check,
- contains option for radio/text where appropriate,
- logical `all` and `any` grouping.

Example condition:

```json
{
  "all": [
    { "questionId": "employment_status", "equals": "self_employed" },
    { "questionId": "has_accountant", "equals": true }
  ]
}
```

## 8. Review Model

Each question must support reviewer status independent of the interviewed answer.

### 8.1 Reviewer Status

Each question review status should support at least:

- `pending`
- `satisfactory`
- `partial`
- `unsatisfactory`

The exact labels may be configurable, but the default set above should be provided.

### 8.2 Review Data

For each question, the saved state should support:

- review status,
- optional reviewer note,
- reviewer role metadata if provided by the host application.

### 8.3 Role-Based UI

When role is `interviewed`:

- question answering controls are enabled,
- review controls are hidden or disabled.

When role is `reviewer`:

- answers are visible,
- review controls are enabled,
- answer controls may be read-only by default.

The embedding application may choose to allow a reviewer to edit answers, but that is not required by this specification.

## 9. Unified Data Format

The questionnaire definition and the saved questionnaire state must use the same data format.

There is no separate response format and no separate review format. The same questionnaire object structure is used:

- as the source questionnaire definition,
- as the in-browser working state,
- as the saved `.json` file for later reload.

At runtime, the questionnaire object is updated in place with answers, review statuses, and reviewer comments.

### 9.1 Top-Level Structure

```json
{
  "id": "sample-questionnaire",
  "title": "Sample Questionnaire",
  "version": "1.0",
  "pages": []
}
```

### 9.2 Page Structure

```json
{
  "id": "page-1",
  "title": "General Information",
  "description": "Please answer the following questions.",
  "questions": []
}
```

### 9.3 Question Structure

```json
{
  "id": "q1",
  "type": "radio",
  "prompt": "What is your current employment status?",
  "required": true,
  "default": "employed",
  "allow_freetext": false,
  "options": [
    { "value": "employed", "label": "Employed" },
    { "value": "self_employed", "label": "Self-employed" },
    { "value": "unemployed", "label": "Unemployed" }
  ],
  "answer": null,
  "review_status": "pending",
  "reviewer_comment": ""
}
```

### 9.4 Checkbox Question Example

```json
{
  "id": "q_accept_terms",
  "type": "checkbox",
  "prompt": "I confirm the information provided is correct.",
  "required": true,
  "default": false,
  "allow_freetext": false,
  "answer": null,
  "review_status": "pending",
  "reviewer_comment": ""
}
```

### 9.5 Text Question Example

```json
{
  "id": "q_notes",
  "type": "text",
  "prompt": "Additional notes",
  "multiline": true,
  "required": false,
  "default": "",
  "allow_freetext": false,
  "answer": null,
  "review_status": "pending",
  "reviewer_comment": ""
}
```

### 9.6 Dropdown Question Example

```json
{
  "id": "q_country",
  "type": "dropdown",
  "prompt": "Select your country",
  "required": true,
  "default": "no",
  "allow_freetext": true,
  "options": [
    { "value": "no", "label": "Norway" },
    { "value": "se", "label": "Sweden" },
    { "value": "dk", "label": "Denmark" }
  ],
  "answer": null,
  "review_status": "pending",
  "reviewer_comment": ""
}
```

### 9.7 Conditional Question Example

```json
{
  "id": "q_accountant_name",
  "type": "text",
  "prompt": "What is your accountant's name?",
  "default": "",
  "allow_freetext": false,
  "visibleIf": {
    "questionId": "q_has_accountant",
    "equals": true
  },
  "answer": null,
  "review_status": "pending",
  "reviewer_comment": ""
}
```

## 10. Save and Load Semantics

The generated HTML application must support saving the current questionnaire object and loading a previously saved questionnaire object at any time.

The saved JSON must include the full questionnaire content together with its current answers and review fields.

### 10.1 Saved Questionnaire Content

The saved questionnaire JSON must preserve the content needed for later restoration, including at least:

- questionnaire id and version,
- pages,
- question definitions,
- visibility rules,
- option lists,
- `allow_freetext` behavior,
- required flags,
- default values,
- current answer values,
- current review status values,
- current reviewer comments,
- predefined text values,
- any review-related metadata configured in the questionnaire.

### 10.2 Load Semantics

Loading state must:

- restore the questionnaire structure,
- restore answers,
- restore reviewer statuses,
- restore reviewer comments,
- refresh conditional visibility based on restored answers,
- restore the UI without requiring a page reload where practical.

Because the saved file uses the same format as the questionnaire itself, loading should replace the current in-memory questionnaire object with the loaded one after validation.

### 10.3 HTML Load Mechanism

The generated standalone HTML file must provide a direct way to load a questionnaire JSON file from the local machine.

The recommended mechanism is:

1. A visible `Load JSON` control in the HTML UI.
2. A browser file picker restricted to `.json` files.
3. Client-side reading of the selected file using `FileReader` or an equivalent browser API.
4. Parsing the file as JSON.
5. Validation and normalization of the loaded object using the same rules as initial questionnaire loading.
6. Replacement of the current in-memory questionnaire object with the loaded object.
7. Immediate re-render of the questionnaire UI.

The generated HTML must not upload the selected file anywhere.

If loading fails, the UI must display a clear client-side error message.

If loading succeeds, the UI should display a short confirmation message.

## 11. Download and Export

The application must support saving and loading the current questionnaire state entirely on the client.

### 11.1 Required Behavior

- Serialize the current state to JSON.
- Serialize the full questionnaire object, including answers and review fields, to JSON.
- Create a data URL with MIME type `application/json`.
- Provide a download action through an HTML link or button.
- Allow the user to download a `.json` file.
- Provide a load action that lets the user choose a previously saved `.json` file.
- Parse the selected file in the browser and restore state without any server interaction.
- Show a clear success or error message after a load attempt.

### 11.2 Suggested Implementation

The implementation may generate:

```js
const json = JSON.stringify(data, null, 2);
const href = "data:application/json;charset=utf-8," + encodeURIComponent(json);
```

The resulting `href` can be assigned to a download link with a filename such as `questionnaire-response.json`.

Loading may be implemented using a file input and `FileReader` or modern browser equivalents.

## 12. Validation

The library must validate:

- required visible questions are answered,
- question ids are unique,
- referenced question ids in conditions exist,
- radio questions define options,
- dropdown questions define options,
- editable predefined text questions define `predefinedText`,
- each question supports the shared fields `default`, `answer`, `review_status`, and `reviewer_comment`,
- loaded save files are structurally valid,
- loaded save files conform to the same questionnaire format used by the application.

Validation errors in the questionnaire specification should be reported clearly to the embedding application.

## 13. Accessibility

The rendered questionnaire should follow basic accessibility requirements:

- labels associated with inputs,
- keyboard-accessible navigation,
- semantic grouping of radio options,
- visible indication of required fields,
- readable focus states,
- status controls accessible to keyboard and screen readers.

## 14. Styling

The CSS library must provide default styling for:

- page layout,
- question blocks,
- labels and help text,
- navigation buttons,
- validation errors,
- reviewer status controls.

The library should also allow host applications to override styles through CSS class names or CSS variables.

### 14.1 Visual Direction

The default UI should look professional, clean, and simple.

The design should avoid:

- overly playful styling,
- heavy decoration,
- visually noisy layouts,
- strong gradients or distracting effects.

The design should emphasize:

- clarity,
- readability,
- generous spacing,
- strong visual hierarchy,
- restrained use of color.

### 14.2 Required Color Palette

The default stylesheet must use the following colors as the primary palette:

- `#fcfcfc`
  - main page background
- `rgba(0,0,94,0.85)`
  - page header background
- `#ffffff`
  - header text color
- `#fbd9ca`
  - secondary light background for accents or highlighted sections

### 14.3 Intended Usage

The default theme should apply these colors in a consistent way:

- use `#fcfcfc` as the main application background,
- use `rgba(0,0,94,0.85)` for page headers or major section headers,
- use white text on the dark header background,
- use `#fbd9ca` for secondary panels, help areas, highlighted question groups, or other light-emphasis surfaces.

### 14.4 Styling Guidance

The implementation should aim for:

- clear card or section separation without heavy borders,
- subtle borders or dividers,
- accessible contrast for text and controls,
- consistent spacing between questions,
- simple, polished form controls,
- a reviewer status area that is visually distinct but still restrained.

The page header should feel formal and prominent, while the rest of the layout should remain light and calm.

## 15. Embedding Requirements

The source assets must be easy to embed in a static HTML page during development:

```html
<link rel="stylesheet" href="questionnaire.css">
<div id="app"></div>
<script src="questionnaire.js"></script>
<script>
  QuestionnaireRenderer.render({
    container: document.getElementById("app"),
    spec: questionnaireSpec,
    role: "interviewed"
  });
</script>
```

No build step should be required for basic usage.

For delivery, the Python generator must produce one standalone HTML file from the template and source assets.

## 16. Recommended Future Extensions

These are optional and not required for the first version:

- local storage autosave,
- richer validation rules,
- reviewer summary page,
- per-page completion overview,
- localization support.

## 17. Acceptance Criteria

The specification is satisfied when:

1. A static HTML page can embed the library.
2. The library renders a questionnaire from JSON.
3. The questionnaire supports multiple pages.
4. The questionnaire supports `checkbox`, `radio`, `dropdown`, `text`, and `editable_predefined_text`.
5. Conditional visibility of subsequent questions works.
6. The interviewed role can answer questions.
7. The reviewer role can assign statuses to questions.
8. A Python script can read questionnaire input in JSON or YAML and generate one self-contained HTML file.
9. The generated HTML safely embeds the JavaScript, CSS, and questionnaire data.
10. All question types support `allow_freetext`, `default`, `answer`, `review_status`, and `reviewer_comment`.
11. The current questionnaire object can be exported as a downloadable JSON file using a client-side data URL.
12. The generated HTML can load a previously saved questionnaire JSON file in the same format and restore questionnaire content, answers, review statuses, and comments.
13. No server is required anywhere in the workflow.
