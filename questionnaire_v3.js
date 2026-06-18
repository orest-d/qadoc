(function () {
  "use strict";

  var W = (typeof window !== "undefined") ? window
    : (typeof global !== "undefined") ? global
      : this;

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  var ROLES = ["interviewed", "reviewer", "editor"];
  var VIEWS = ["normal", "tabular", "overview", "template", "display"];

  var ROLE_VIEWS = {
    interviewed: ["normal", "display"],
    reviewer: ["normal", "tabular", "overview", "display"],
    editor: ["normal", "tabular", "overview", "template", "display"]
  };

  var DEFAULT_VIEW = {
    interviewed: "normal",
    reviewer: "overview",
    editor: "tabular"
  };

  var REVIEW_STATUSES = ["pending", "satisfactory", "partial", "unsatisfactory"];

  var SCORE_FACTOR = {
    satisfactory: 1.0,
    partial: 0.5,
    unsatisfactory: 0.0,
    pending: 0.0
  };

  var QUESTION_TYPES = [
    "text", "checkbox", "yes_or_no", "yes_or_text", "no_or_text",
    "radio", "dropdown", "date", "info", "html", "review", "ignore"
  ];

  var TEMPLATE_IDS = [
    "question_card", "reviewer_card", "editor_form",
    "display_card", "display_reviewer_card", "header", "footer",
    "css", "onchange", "script", "data"
  ];

  var TEMPLATE_LABELS = {
    question_card: "Question Card",
    reviewer_card: "Reviewer Card",
    editor_form: "Editor Form",
    onchange: "On Change (JS)",
    display_card: "Display Card",
    display_reviewer_card: "Display Reviewer",
    header: "Header",
    footer: "Footer",
    css: "CSS",
    data: "Data (JSON)",
    script: "App Script (JS)"
  };

  var TEMPLATE_FORMAT = {
    question_card: "html",
    reviewer_card: "html",
    editor_form: "html",
    display_card: "html",
    display_reviewer_card: "html",
    header: "html",
    footer: "html",
    css: "css",
    onchange: "js",
    data: "json",
    script: "js"
  };

  var RELOAD_WARNING_IDS = { script: true };

  // Field groups used by the tabular editor view.
  var GROUP_QUESTION = ["id", "category", "subcategory", "question", "default", "help", "answer"];
  var GROUP_UI = ["type", "options", "rows", "visible_if_id", "visible_if_value", "required"];
  var GROUP_OPTIONAL = ["review_status", "reviewer_comment", "weight", "weight_score", "analysis"];

  // Known fields, in the order they appear in CSV/JSON exports.
  var KNOWN_FIELDS = [
    "id", "category", "subcategory", "question", "help", "required", "default",
    "type", "rows", "options", "visible_if_id", "visible_if_value",
    "answer", "review_status", "reviewer_comment", "weight", "analysis"
  ];

  var DEFAULT_EDITOR_FIELDS = [
    { name: "id", label: "ID", ui: "text" },
    { name: "category", label: "Category", ui: "text" },
    { name: "subcategory", label: "Subcategory", ui: "text" },
    { name: "type", label: "Type", ui: "select", options: QUESTION_TYPES },
    { name: "question", label: "Question", ui: "textarea" },
    { name: "help", label: "Help", ui: "textarea" },
    { name: "required", label: "Required", ui: "checkbox" },
    { name: "default", label: "Default value", ui: "textarea" },
    { name: "rows", label: "Rows", ui: "number" },
    { name: "options", label: "Options", ui: "options_table" },
    { name: "visible_if_id", label: "Visible if (question)", ui: "question_datalist" },
    { name: "visible_if_value", label: "Visible if value", ui: "visibility_value_datalist" },
    { name: "weight", label: "Weight", ui: "number" },
    { name: "analysis", label: "Analysis", ui: "textarea" },
    { name: "answer", label: "Answer", ui: "textarea" },
    { name: "review_status", label: "Review status", ui: "select", options: REVIEW_STATUSES },
    { name: "reviewer_comment", label: "Reviewer comment", ui: "textarea" }
  ];

  var DEFAULT_QUESTION_CARD =
    '<!-- Question card: rendered for each normal (non-review) question -->\n' +
    '<section class="q-card" data-question-id="{{id}}">\n' +
    '  <div class="q-card-head">\n' +
    '    <h3 class="q-prompt">{{question}}</h3>\n' +
    '    {{#required}}<span class="q-required">*</span>{{/required}}\n' +
    '    {{#subcategory}}<span class="q-subcategory">{{subcategory}}</span>{{/subcategory}}\n' +
    '    <!-- Edit button: only visible to editors -->\n' +
    '    {{#_editor}}<button type="button" class="q-edit-btn" data-edit-question="{{id}}">✏️ Edit</button>{{/_editor}}\n' +
    '  </div>\n' +
    '  {{#help}}<p class="q-help">{{help}}</p>{{/help}}\n' +
    '  {{#_analysis_visible}}<p class="q-analysis">{{analysis}}</p>{{/_analysis_visible}}\n' +
    '  <!-- The library injects the answer widget here -->\n' +
    '  <div class="q-answer-block" data-question-control></div>\n' +
    '  <!-- Review status and reviewer comment controls (injected by the library) -->\n' +
    '  <div data-review-control></div>\n' +
    '  <div data-reviewer-comment-control></div>\n' +
    '  {{#_errors}}<p class="q-error">{{.}}</p>{{/_errors}}\n' +
    '</section>';

  var DEFAULT_REVIEWER_CARD =
    '<!-- Reviewer card: rendered for review-type questions -->\n' +
    '<section class="q-card{{#_highlight_reviewer}} q-reviewer-card{{/_highlight_reviewer}}" data-question-id="{{id}}">\n' +
    '  <div class="q-card-head q-reviewer-head">\n' +
    '    <h3 class="q-prompt">{{question}}</h3>\n' +
    '    <span class="q-meta-pill q-status-{{review_status}}">{{_status_label}}</span>\n' +
    '    <!-- Review status dropdown (injected by the library) -->\n' +
    '    <div data-review-control></div>\n' +
    '    {{#_editor}}<button type="button" class="q-edit-btn" data-edit-question="{{id}}">✏️ Edit</button>{{/_editor}}\n' +
    '  </div>\n' +
    '  {{#analysis}}<p class="q-analysis">{{analysis}}</p>{{/analysis}}\n' +
    '  {{#help}}<p class="q-help">{{help}}</p>{{/help}}\n' +
    '  <!-- Answer block intentionally absent for review cards -->\n' +
    '  <div data-reviewer-comment-control></div>\n' +
    '  {{#_errors}}<p class="q-error">{{.}}</p>{{/_errors}}\n' +
    '</section>';

  var DEFAULT_DISPLAY_CARD =
    '<!-- Display card: read-only view of a normal question -->\n' +
    '<div class="q-display-item" data-question-id="{{id}}">\n' +
    '  <p class="q-display-question">{{question}}</p>\n' +
    '  {{#_answer_display}}<p class="q-display-answer">{{_answer_display}}</p>{{/_answer_display}}\n' +
    '  {{#_has_comment}}<p class="q-display-comment">{{reviewer_comment}}</p>{{/_has_comment}}\n' +
    '</div>';

  var DEFAULT_DISPLAY_REVIEWER_CARD =
    '<!-- Display reviewer card: read-only view of a review question -->\n' +
    '<div class="q-display-reviewer-item" data-question-id="{{id}}">\n' +
    '  <p class="q-display-question q-display-reviewer-question">{{question}}</p>\n' +
    '  <p class="q-display-status q-status-{{review_status}}">{{_status_label}}</p>\n' +
    '  {{#reviewer_comment}}<p class="q-display-comment">{{reviewer_comment}}</p>{{/reviewer_comment}}\n' +
    '</div>';

  var DEFAULT_HEADER =
    '<!-- Header: title area and toolbar. IDs below are bound by the library automatically. -->\n' +
    '<div>\n' +
    '  <p class="q-kicker">Questionnaire</p>\n' +
    '  <h1 id="questionnaire-title">{{title}}</h1>\n' +
    '  {{#version}}<p id="questionnaire-version" class="q-subtitle">{{version}}</p>{{/version}}\n' +
    '</div>\n' +
    '<div class="q-toolbar">\n' +
    '  <label><span>Role</span><select id="role-select"></select></label>\n' +
    '  <!-- data-roles controls visibility per role -->\n' +
    '  <label data-roles="reviewer editor"><span>View</span><select id="view-select"></select></label>\n' +
    '  <div class="q-toolbar-actions">\n' +
    '    <label class="q-load-button q-toolbar-action" data-roles="reviewer editor">📂 Load CSV<input type="file" id="load-csv" accept=".csv,text/csv"></label>\n' +
    '    <button type="button" class="q-toolbar-action" id="save-csv" data-roles="reviewer editor">💾 Save CSV</button>\n' +
    '    <button type="button" class="q-toolbar-action" id="save-json" data-roles="reviewer editor">💾 Save JSON</button>\n' +
    '    <button type="button" class="q-toolbar-action" id="save-html">💾 Save HTML</button>\n' +
    '  </div>\n' +
    '</div>';

  var DEFAULT_FOOTER =
    '<!-- Footer: navigation buttons. IDs are bound by the library automatically. -->\n' +
    '<button type="button" id="prev-category">Previous</button>\n' +
    '<button type="button" id="next-category">Next</button>';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value === null || typeof value === "undefined" ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeScriptData(value) {
    return String(value)
      .replace(/<\/script/gi, "<\\/script")
      .replace(/<\/style/gi, "<\\/style");
  }

  function serializeDoctype(doctype) {
    if (!doctype) {
      return "<!DOCTYPE html>";
    }
    var text = "<!DOCTYPE " + doctype.name;
    if (doctype.publicId) {
      text += ' PUBLIC "' + doctype.publicId + '"';
    }
    if (doctype.systemId) {
      text += ' "' + doctype.systemId + '"';
    }
    return text + ">";
  }

  function downloadText(filename, mimeType, text) {
    var doc = W.document;
    var link = doc.createElement("a");
    var objectUrl = null;
    if (W.Blob && W.URL && W.URL.createObjectURL) {
      objectUrl = W.URL.createObjectURL(new W.Blob([text], { type: mimeType + ";charset=utf-8" }));
      link.href = objectUrl;
    } else {
      link.href = "data:" + mimeType + ";charset=utf-8," + encodeURIComponent(text);
    }
    link.download = filename;
    doc.body.appendChild(link);
    link.click();
    doc.body.removeChild(link);
    if (objectUrl) {
      W.setTimeout(function () {
        W.URL.revokeObjectURL(objectUrl);
      }, 0);
    }
  }

  // Returns true / false for recognised boolean tokens, otherwise null.
  function boolToken(value) {
    if (typeof value === "boolean") {
      return value;
    }
    if (value === null || typeof value === "undefined") {
      return null;
    }
    var text = String(value).trim().toLowerCase();
    if (text === "true" || text === "yes") {
      return true;
    }
    if (text === "false" || text === "no") {
      return false;
    }
    return null;
  }

  function parseBoolean(value, fallback) {
    if (typeof value === "boolean") {
      return value;
    }
    if (value === null || typeof value === "undefined" || value === "") {
      return fallback;
    }
    var text = String(value).trim().toLowerCase();
    if (["1", "true", "t", "yes", "y", "on"].indexOf(text) !== -1) {
      return true;
    }
    if (["0", "false", "f", "no", "n", "off"].indexOf(text) !== -1) {
      return false;
    }
    return fallback;
  }

  function parseScalar(value) {
    if (typeof value !== "string") {
      return value;
    }
    var text = value.trim();
    if (text === "") {
      return "";
    }
    var lowered = text.toLowerCase();
    if (["true", "t", "yes", "y"].indexOf(lowered) !== -1) {
      return true;
    }
    if (["false", "f", "no", "n"].indexOf(lowered) !== -1) {
      return false;
    }
    if (lowered === "null") {
      return null;
    }
    return value;
  }

  function parseJsonField(value, fallback) {
    if (Array.isArray(value) || (value && typeof value === "object")) {
      return value;
    }
    if (typeof value !== "string" || !value.trim()) {
      return fallback;
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function normalizeKeys(value, aliases) {
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return normalizeKeys(item, aliases);
      });
    }
    if (value && typeof value === "object") {
      var normalized = {};
      Object.keys(value).forEach(function (key) {
        normalized[aliases[key] || key] = normalizeKeys(value[key], aliases);
      });
      return normalized;
    }
    return value;
  }

  function optionValueToString(value) {
    if (value === null || typeof value === "undefined") {
      return "";
    }
    return String(value);
  }

  function displayValue(value) {
    if (value === null || typeof value === "undefined") {
      return "";
    }
    if (Array.isArray(value) || (value && typeof value === "object")) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  function ciEquals(left, right) {
    return String(left === null || typeof left === "undefined" ? "" : left).trim().toLowerCase() ===
      String(right === null || typeof right === "undefined" ? "" : right).trim().toLowerCase();
  }

  function getTemplateHtml(template) {
    if (!template) {
      return "";
    }
    if (typeof template === "string") {
      return template;
    }
    if (typeof template.innerHTML === "string") {
      return template.innerHTML;
    }
    return "";
  }

  function fallbackMustache(template, data) {
    return template
      .replace(/\{\{#([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, function (_, key, content) {
        var value = data[key];
        if (Array.isArray(value)) {
          return value.map(function (item) {
            return fallbackMustache(content.replace(/\{\{\.\}\}/g, escapeHtml(item)), data);
          }).join("");
        }
        return value ? fallbackMustache(content, data) : "";
      })
      .replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, function (_, key) {
        return escapeHtml(data[key]);
      });
  }

  function renderTemplate(template, data) {
    if (W.Mustache && typeof W.Mustache.render === "function") {
      return W.Mustache.render(template, data);
    }
    return fallbackMustache(template, data);
  }

  // ---------------------------------------------------------------------------
  // CSV
  // ---------------------------------------------------------------------------

  function csvEscape(value) {
    var text = String(value === null || typeof value === "undefined" ? "" : value);
    if (/[",\n\r]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function firstCsvLine(text) {
    var inQuotes = false;
    var line = "";
    for (var i = 0; i < text.length; i += 1) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') {
          line += '""';
          i += 1;
        } else if (ch === '"') {
          inQuotes = false;
          line += ch;
        } else {
          line += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
        line += ch;
      } else if (ch === "\n" || ch === "\r") {
        break;
      } else {
        line += ch;
      }
    }
    return line;
  }

  function detectCsvDelimiter(text) {
    var line = firstCsvLine(text);
    var candidates = [",", ";", "|", "\t"];
    var counts = candidates.map(function (delimiter) {
      var count = 0;
      var inQuotes = false;
      for (var i = 0; i < line.length; i += 1) {
        var ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            i += 1;
          } else if (ch === '"') {
            inQuotes = false;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === delimiter) {
          count += 1;
        }
      }
      return { delimiter: delimiter, count: count };
    });
    counts.sort(function (a, b) {
      return b.count - a.count;
    });
    return counts[0].count > 0 ? counts[0].delimiter : ",";
  }

  function parseCsv(text) {
    var delimiter = detectCsvDelimiter(text);
    var rows = [];
    var row = [];
    var cell = "";
    var inQuotes = false;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (ch !== "\r") {
        cell += ch;
      }
    }
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    if (!rows.length) {
      return [];
    }
    var headers = rows.shift();
    return rows.filter(function (item) {
      return item.some(function (value) {
        return value !== "";
      });
    }).map(function (item) {
      var object = {};
      headers.forEach(function (header, index) {
        object[header] = item[index] || "";
      });
      return object;
    });
  }

  function stringifyCsv(rows, columns) {
    return [columns.map(csvEscape).join(",")].concat(rows.map(function (row) {
      return columns.map(function (column) {
        var value = row[column];
        if (Array.isArray(value) || (value && typeof value === "object")) {
          value = JSON.stringify(value);
        }
        return csvEscape(value);
      }).join(",");
    })).join("\n") + "\n";
  }

  // ---------------------------------------------------------------------------
  // Normalization
  // ---------------------------------------------------------------------------

  // Replaces dashes in a category with underscores, warning the host.
  function sanitizeCategory(value, warn) {
    var text = value === null || typeof value === "undefined" ? "" : String(value);
    if (text.indexOf("-") !== -1) {
      var replaced = text.replace(/-/g, "_");
      if (typeof warn === "function") {
        warn(text, replaced);
      }
      return replaced;
    }
    return text;
  }

  function normalizeQuestion(raw, index, warn) {
    var aliases = { visibleIf: "visible_if_value" };
    var optionAliases = { isOther: "is_other" };
    var question = {};
    Object.keys(raw || {}).forEach(function (key) {
      question[aliases[key] || key] = raw[key];
    });

    question.id = question.id ? String(question.id) : ("q_" + (index + 1));
    question.category = sanitizeCategory(question.category || "default", warn) || "default";
    if (typeof question.subcategory !== "undefined" && question.subcategory !== null) {
      question.subcategory = String(question.subcategory);
    }
    question.question = question.question === null || typeof question.question === "undefined"
      ? "" : String(question.question);
    question.help = question.help === null || typeof question.help === "undefined"
      ? "" : String(question.help);
    question.type = QUESTION_TYPES.indexOf(question.type) !== -1 ? question.type : (question.type || "text");
    question.required = parseBoolean(question.required, false);

    if (typeof question.rows !== "undefined" && question.rows !== null && question.rows !== "") {
      question.rows = Math.max(1, Number(question.rows) || 1);
    } else {
      delete question.rows;
    }

    question.options = normalizeKeys(parseJsonField(question.options, []), optionAliases);
    question.visible_if_id = question.visible_if_id ? String(question.visible_if_id) : "";
    question.visible_if_value = question.visible_if_value === null || typeof question.visible_if_value === "undefined"
      ? "" : String(question.visible_if_value);
    question.default = parseScalar(question.default);
    var rawAns = question.answer;
    if (rawAns === "" || typeof rawAns === "undefined") {
      question.answer = null;
    } else if (Array.isArray(rawAns) || (rawAns !== null && typeof rawAns === "object")) {
      question.answer = null;
    } else {
      question.answer = parseScalar(rawAns);
    }

    question.review_status = REVIEW_STATUSES.indexOf(question.review_status) !== -1
      ? question.review_status : "pending";
    question.reviewer_comment = question.reviewer_comment === null || typeof question.reviewer_comment === "undefined"
      ? "" : String(question.reviewer_comment);

    if (typeof question.weight !== "undefined" && question.weight !== null && question.weight !== "") {
      question.weight = Number(question.weight);
      if (!isFinite(question.weight)) {
        question.weight = 1;
      }
    } else {
      question.weight = 1;
    }

    if (typeof question.analysis !== "undefined" && question.analysis !== null) {
      question.analysis = String(question.analysis);
    }

    // weight_score is always recalculated and never trusted from input.
    delete question.weight_score;

    return question;
  }

  // ---------------------------------------------------------------------------
  // App
  // ---------------------------------------------------------------------------

  function QuestionnaireV3App(config) {
    config = config || {};
    this.config = deepClone(config.config || {});
    this.containers = config.containers || {};
    this.editorFields = deepClone(config.questionFields || DEFAULT_EDITOR_FIELDS);

    this.roleLabels = Object.assign(
      { interviewed: "Interviewed", reviewer: "Reviewer", editor: "Editor" },
      config.roleLabels || {}
    );
    this.viewLabels = Object.assign(
      { normal: "Normal", tabular: "Tabular", overview: "Overview", template: "Source code", display: "Document" },
      config.viewLabels || {}
    );
    this.statusLabels = Object.assign(
      {
        pending: "Pending",
        satisfactory: "Satisfactory",
        partial: "Partial",
        unsatisfactory: "Unsatisfactory"
      },
      config.statusLabels || {}
    );
    this.totalLabel = config.totalLabel || "Total";

    if (config.ragThresholds === null) {
      this.ragThresholds = null;
    } else {
      this.ragThresholds = Object.assign({ green: 80, amber: 50 }, config.ragThresholds || {});
    }

    // Template sources: DOM template elements (from host) used as defaults,
    // overridden by string overrides edited in the template view.
    this.templates = config.templates || {};
    this.templateOverrides = Object.assign({}, config.templateOverrides || {});
    if (this.templateOverrides.css) {
      this._applyCssOverride(this.templateOverrides.css);
    }

    this.configOnChange = typeof config.onChange === "function" ? config.onChange : null;
    this.onChangeBody = typeof config.onChangeBody === "string" ? config.onChangeBody : "";
    this.compileOnChange();

    this.role = ROLES.indexOf(config.role) !== -1 ? config.role : "interviewed";
    this.view = config.view && this.viewAvailable(config.view, this.role)
      ? config.view : DEFAULT_VIEW[this.role];

    this.questions = [];
    this.currentCategory = "";
    this.editorSearch = "";
    this.editingId = null;
    this.selectedTemplateId = "question_card";
    this.validationErrors = {};
    this._suppressHash = false;
    this._codeMirror = null;
    this._pendingScrollY = null;
    this.showNormalQuestions = true;
    this.showReviewerQuestions = true;
    var initVis = this._defaultVisibility();
    this.showNormalQuestions = initVis.showNormal;
    this.showReviewerQuestions = initVis.showReviewer;

    this.setQuestions(config.questions || [], { silent: true });

    if (config.useHash !== false) {
      this.bindHash();
      this.applyHash({ silent: true });
    }

    this.render();
  }

  var proto = QuestionnaireV3App.prototype;

  proto.api = function () {
    return this;
  };

  // --- onChange -------------------------------------------------------------

  proto.compileOnChange = function () {
    if (this.onChangeBody && this.onChangeBody.trim()) {
      try {
        this.onChangeFn = new Function("event", "api", this.onChangeBody);
      } catch (error) {
        if (W.console) {
          W.console.error("Failed to compile onChange hook:", error);
        }
        this.onChangeFn = this.configOnChange;
      }
    } else {
      this.onChangeFn = this.configOnChange;
    }
  };

  proto.triggerChange = function (event, options) {
    if (options && options.silent) {
      return;
    }
    if (this.onChangeFn) {
      try {
        this.onChangeFn(Object.assign({ role: this.role, view: this.view }, event), this);
      } catch (error) {
        if (W.console) {
          W.console.error("onChange hook error:", error);
        }
      }
    }
  };

  // --- warnings -------------------------------------------------------------

  proto.warnCategoryDash = function (original, replaced) {
    var message = 'Category "' + original + '" contains a dash ("-"), which is not allowed. ' +
      'It has been changed to "' + replaced + '".';
    if (typeof W.alert === "function") {
      W.alert(message);
    } else if (W.console) {
      W.console.warn(message);
    }
  };

  // --- data -----------------------------------------------------------------

  proto.getQuestions = function () {
    return deepClone(this.questions);
  };

  proto.setQuestions = function (questions, options) {
    var self = this;
    var list = Array.isArray(questions) ? questions : (questions && questions.questions) || [];
    if (questions && questions.config) {
      this.config = Object.assign({}, this.config, questions.config);
    }
    this.questions = list.map(function (raw, index) {
      return normalizeQuestion(raw, index, function (a, b) { self.warnCategoryDash(a, b); });
    });
    this.recomputeScores();
    if (!this.currentCategory || this.getCategories().indexOf(this.currentCategory) === -1) {
      this.currentCategory = this.getCategories()[0] || "default";
    }
    if (!options || !options.silent) {
      this.triggerChange({ type: "load" }, options);
      this.render();
    }
  };

  proto.getQuestion = function (id) {
    for (var i = 0; i < this.questions.length; i += 1) {
      if (this.questions[i].id === id) {
        return this.questions[i];
      }
    }
    return null;
  };

  proto.updateQuestion = function (id, patch) {
    var question = this.getQuestion(id);
    if (!question) {
      return;
    }
    Object.assign(question, patch || {});
    this.recomputeScores();
    this.triggerChange({ type: "question", question_id: id, value: patch });
    this.render();
  };

  proto.updateQuestionField = function (id, field, value, options) {
    var self = this;
    var question = this.getQuestion(id);
    if (!question) {
      return;
    }
    if (field === "category") {
      value = sanitizeCategory(value, function (a, b) { self.warnCategoryDash(a, b); }) || "default";
    } else if (field === "options") {
      value = parseJsonField(value, []);
    } else if (field === "required") {
      value = parseBoolean(value, false);
    } else if (field === "rows") {
      value = value === "" ? undefined : Math.max(1, Number(value) || 1);
    } else if (field === "weight") {
      value = value === "" ? 1 : Number(value);
    } else if (field === "answer" || field === "default") {
      value = parseScalar(value);
    }
    if (typeof value === "undefined") {
      delete question[field];
    } else {
      question[field] = value;
    }
    this.recomputeScores();
    this.triggerChange({ type: "question", question_id: id, field: field, value: value }, options);
    if (!options || !options.deferRender) {
      this.render();
    }
  };

  proto.addQuestion = function (question) {
    var self = this;
    var normalized = normalizeQuestion(
      Object.assign({ category: this.currentCategory || "default", type: "text" }, question || {}),
      this.questions.length,
      function (a, b) { self.warnCategoryDash(a, b); }
    );
    this.questions.push(normalized);
    this.recomputeScores();
    this.triggerChange({ type: "add", question_id: normalized.id });
    this.render();
    return normalized;
  };

  proto.deleteQuestion = function (id) {
    this.questions = this.questions.filter(function (question) {
      return question.id !== id;
    });
    if (this.editingId === id) {
      this.editingId = null;
    }
    this.recomputeScores();
    this.triggerChange({ type: "delete", question_id: id });
    this.render();
  };

  proto.moveQuestion = function (id, placement) {
    var index = this.indexOfQuestion(id);
    if (index < 0) {
      return;
    }
    var target = index;
    if (placement && placement.before) {
      target = this.indexOfQuestion(placement.before);
    } else if (placement && placement.after) {
      target = this.indexOfQuestion(placement.after) + 1;
    } else if (placement && typeof placement.to === "number") {
      target = placement.to;
    }
    if (target < 0) {
      return;
    }
    var item = this.questions.splice(index, 1)[0];
    if (target > index) {
      target -= 1;
    }
    this.questions.splice(Math.max(0, Math.min(target, this.questions.length)), 0, item);
    this.triggerChange({ type: "move", question_id: id });
    this.render();
  };

  proto.sortByCategory = function () {
    var self = this;
    var categories = this.getCategories();
    var sorted = [];
    categories.forEach(function (cat) {
      self.questions.forEach(function (q) {
        if (q.category === cat) { sorted.push(q); }
      });
    });
    this.questions = sorted;
    this._pendingScrollY = W.scrollY || 0;
    this.triggerChange({ type: "reorder" });
    this.render();
  };

  proto.indexOfQuestion = function (id) {
    for (var i = 0; i < this.questions.length; i += 1) {
      if (this.questions[i].id === id) {
        return i;
      }
    }
    return -1;
  };

  proto.swapQuestion = function (id, direction) {
    var index = this.indexOfQuestion(id);
    var next = index + direction;
    if (index < 0 || next < 0 || next >= this.questions.length) {
      return;
    }
    var tmp = this.questions[index];
    this.questions[index] = this.questions[next];
    this.questions[next] = tmp;
    this.triggerChange({ type: "move", question_id: id });
    this._pendingScrollY = W.scrollY || 0;
    this.render();
  };

  // --- answers --------------------------------------------------------------

  proto.questionValue = function (question) {
    if (question.answer === null || typeof question.answer === "undefined" || question.answer === "") {
      return question.default;
    }
    return question.answer;
  };

  proto.getAnswer = function (id) {
    var question = this.getQuestion(id);
    return question ? question.answer : undefined;
  };

  proto.setAnswer = function (id, value, options) {
    var question = this.getQuestion(id);
    if (!question) {
      return;
    }
    var previous = question.answer;
    question.answer = value;
    this.triggerChange({ type: "answer", question_id: id, field: "answer", previous_value: previous, value: value }, options);
    if (!options || !options.silent) {
      if (!options || !options.deferRender) {
        this.render();
      }
    }
  };

  proto.getAnswers = function () {
    var answers = {};
    this.questions.forEach(function (question) {
      answers[question.id] = question.answer;
    });
    return answers;
  };

  proto.setAnswers = function (answers) {
    var self = this;
    Object.keys(answers || {}).forEach(function (id) {
      self.setAnswer(id, answers[id], { silent: true });
    });
    this.triggerChange({ type: "answers" });
    this.render();
  };

  // --- review ---------------------------------------------------------------

  proto.getReviewStatus = function (id) {
    var question = this.getQuestion(id);
    return question && question.type === "review" ? question.review_status : null;
  };

  proto.setReviewStatus = function (id, status, options) {
    var question = this.getQuestion(id);
    if (!question || question.type !== "review") {
      return;
    }
    if (REVIEW_STATUSES.indexOf(status) === -1) {
      return;
    }
    question.review_status = status;
    this.recomputeScores();
    this.triggerChange({ type: "review_status", question_id: id, field: "review_status", value: status }, options);
    if (!options || !options.silent) {
      this.render();
    }
  };

  proto.getReviewerComment = function (id) {
    var question = this.getQuestion(id);
    return question ? question.reviewer_comment : "";
  };

  proto.setReviewerComment = function (id, value, options) {
    var question = this.getQuestion(id);
    if (!question) {
      return;
    }
    question.reviewer_comment = value;
    this.triggerChange({ type: "reviewer_comment", question_id: id, field: "reviewer_comment", value: value }, options);
    if (!options || !options.silent) {
      if (!options || !options.deferRender) {
        this.render();
      }
    }
  };

  // --- scoring --------------------------------------------------------------

  proto.recomputeScores = function () {
    this.questions.forEach(function (question) {
      if (question.type === "review") {
        var factor = SCORE_FACTOR[question.review_status] || 0;
        question.weight_score = (Number(question.weight) || 0) * factor;
      } else {
        delete question.weight_score;
      }
    });
  };

  proto.computeScore = function (questions) {
    var counts = { satisfactory: 0, partial: 0, unsatisfactory: 0, pending: 0 };
    var totalWeight = 0;
    var weightedScore = 0;
    var reviewCount = 0;
    questions.forEach(function (question) {
      if (question.type !== "review") {
        return;
      }
      reviewCount += 1;
      var status = REVIEW_STATUSES.indexOf(question.review_status) !== -1 ? question.review_status : "pending";
      counts[status] += 1;
      var weight = Number(question.weight) || 0;
      totalWeight += weight;
      weightedScore += weight * (SCORE_FACTOR[status] || 0);
    });
    var score = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : null;
    return {
      counts: counts,
      total: reviewCount,
      total_weight: totalWeight,
      score: score
    };
  };

  proto.getScore = function () {
    var self = this;
    var current = this.questions.filter(function (question) {
      return question.category === self.currentCategory;
    });
    return {
      current_category: this.computeScore(current),
      total: this.computeScore(this.questions)
    };
  };

  proto.ragClass = function (score) {
    if (this.ragThresholds === null) {
      return null;
    }
    if (score === null || typeof score === "undefined") {
      return "neutral";
    }
    if (score >= this.ragThresholds.green) {
      return "green";
    }
    if (score >= this.ragThresholds.amber) {
      return "amber";
    }
    return "red";
  };

  // --- categories -----------------------------------------------------------

  proto.getCategories = function () {
    var seen = {};
    var ordered = [];
    this.questions.forEach(function (question) {
      var category = question.category || "default";
      if (!seen[category]) {
        seen[category] = true;
        ordered.push(category);
      }
    });
    return ordered;
  };

  proto.getCurrentCategory = function () {
    var categories = this.getCategories();
    if (categories.indexOf(this.currentCategory) === -1) {
      this.currentCategory = categories[0] || "default";
    }
    return this.currentCategory;
  };

  proto.setCategory = function (category, options) {
    if (this.getCategories().indexOf(category) === -1) {
      return;
    }
    this.currentCategory = category;
    if (!options || !options.silent) {
      this.updateHash();
      this.render();
    }
  };

  proto.nextCategory = function () {
    var categories = this.getCategories();
    var index = categories.indexOf(this.getCurrentCategory());
    if (index < categories.length - 1) {
      this.setCategory(categories[index + 1]);
    }
  };

  proto.previousCategory = function () {
    var categories = this.getCategories();
    var index = categories.indexOf(this.getCurrentCategory());
    if (index > 0) {
      this.setCategory(categories[index - 1]);
    }
  };

  // --- roles & views --------------------------------------------------------

  proto.getRole = function () {
    return this.role;
  };

  proto._defaultVisibility = function () {
    var showNormal = true;
    var showReviewer = true;
    if (this.role === "reviewer") {
      if (this.view === "normal" || this.view === "display") {
        showReviewer = false;
      } else if (this.view === "overview") {
        showNormal = false;
      }
    }
    return { showNormal: showNormal, showReviewer: showReviewer };
  };

  proto.setRole = function (role) {
    if (ROLES.indexOf(role) === -1) {
      return;
    }
    this.role = role;
    // Switching role moves to that role's default view.
    this.view = DEFAULT_VIEW[role];
    this.editingId = null;
    var vis = this._defaultVisibility();
    this.showNormalQuestions = vis.showNormal;
    this.showReviewerQuestions = vis.showReviewer;
    this.updateHash();
    this.triggerChange({ type: "role", value: role });
    this.render();
  };

  proto.getRoleLabels = function () {
    return Object.assign({}, this.roleLabels);
  };

  proto.setRoleLabels = function (labels) {
    this.roleLabels = Object.assign({}, this.roleLabels, labels || {});
    this.render();
  };

  proto.getView = function () {
    return this.view;
  };

  proto.viewAvailable = function (view, role) {
    return (ROLE_VIEWS[role || this.role] || []).indexOf(view) !== -1;
  };

  proto.getAvailableViews = function () {
    return (ROLE_VIEWS[this.role] || []).slice();
  };

  proto.setView = function (view) {
    if (!this.viewAvailable(view, this.role)) {
      return;
    }
    this.view = view;
    var vis = this._defaultVisibility();
    this.showNormalQuestions = vis.showNormal;
    this.showReviewerQuestions = vis.showReviewer;
    this.updateHash();
    this.triggerChange({ type: "view", value: view });
    this.render();
  };

  // --- navigation / hash ----------------------------------------------------

  proto.getAnchor = function () {
    var anchor = this.role + "-" + this.view;
    if (this.view === "template") {
      anchor += "-" + this.selectedTemplateId;
    } else if (this.view === "normal" || this.view === "overview") {
      anchor += "-" + this.getCurrentCategory();
    }
    return anchor;
  };

  proto.setAnchor = function (anchor) {
    this.applyAnchorString(anchor);
  };

  proto.navigateTo = function (target) {
    target = target || {};
    if (target.role && ROLES.indexOf(target.role) !== -1) {
      this.role = target.role;
    }
    if (target.view && this.viewAvailable(target.view, this.role)) {
      this.view = target.view;
    } else if (!this.viewAvailable(this.view, this.role)) {
      this.view = DEFAULT_VIEW[this.role];
    }
    if (target.id) {
      this.resolveAnchorId(target.id);
    }
    this.updateHash();
    this.render();
  };

  proto.resolveAnchorId = function (id) {
    if (!id) {
      return;
    }
    var question = this.getQuestion(id);
    if (question) {
      this.currentCategory = question.category;
      this._pendingScrollId = id;
      return;
    }
    if (this.getCategories().indexOf(id) !== -1) {
      this.currentCategory = id;
      return;
    }
    if (this.view === "template" && TEMPLATE_IDS.indexOf(id) !== -1) {
      this.selectedTemplateId = id;
    }
    // Unknown id: ignored.
  };

  proto.applyAnchorString = function (anchor) {
    var clean = String(anchor || "").replace(/^#/, "");
    if (!clean) {
      return;
    }
    var parts = clean.split("-");
    var role = parts.shift();
    if (ROLES.indexOf(role) === -1) {
      return;
    }
    this.role = role;
    var view = parts.shift();
    if (view === "doc") { view = "display"; }
    if (view && this.viewAvailable(view, role)) {
      this.view = view;
    } else {
      this.view = DEFAULT_VIEW[role];
    }
    var id = parts.join("-");
    if (id) {
      this.resolveAnchorId(id);
    }
  };

  proto.bindHash = function () {
    var self = this;
    if (!W.addEventListener) {
      return;
    }
    W.addEventListener("hashchange", function () {
      if (self._suppressHash) {
        self._suppressHash = false;
        return;
      }
      self.applyHash({ silent: true });
      self.render();
    });
  };

  proto.applyHash = function () {
    if (!W.location) {
      return;
    }
    var hash = W.location.hash || "";
    if (!hash) {
      return;
    }
    this.applyAnchorString(hash);
  };

  proto.updateHash = function () {
    if (!W.location) {
      return;
    }
    var anchor = this.getAnchor();
    var newHash = "#" + anchor;
    if (W.location.hash === newHash) {
      return;
    }
    this._suppressHash = true;
    if (W.history && typeof W.history.pushState === "function" && W.location.protocol !== "file:") {
      try {
        W.history.pushState(null, "", newHash);
        return;
      } catch (error) {
        // fall through to direct assignment
      }
    }
    W.location.hash = anchor;
  };

  proto.navigateToQuestion = function (id) {
    var question = this.getQuestion(id);
    if (!question) {
      return;
    }
    this.currentCategory = question.category;
    this._pendingScrollId = id;
    this.updateHash();
    this.render();
  };

  // --- visibility -----------------------------------------------------------

  // Whether a question is shown for the current role + view, ignoring its
  // conditional visibility expression. Respects showNormalQuestions /
  // showReviewerQuestions flags (reviewer & editor only).
  proto.passesRoleView = function (question) {
    if (question.type === "ignore") {
      return false;
    }
    if (question.type === "review") {
      if (this.role === "interviewed") {
        return false;
      }
      if (!this.showReviewerQuestions) {
        return false;
      }
      return true;
    }
    if ((this.role === "reviewer" || this.role === "editor") && !this.showNormalQuestions) {
      return false;
    }
    return true;
  };

  // Whether a question passes its conditional visibility expression. This is
  // independent of role/view filtering so controlling values stay correct.
  proto.isExpressionVisible = function (question, stack) {
    if (!question.visible_if_id) {
      return true;
    }
    stack = stack || [];
    if (stack.indexOf(question.id) !== -1) {
      return true;
    }
    var ref = this.getQuestion(question.visible_if_id);
    if (!ref) {
      return true;
    }
    var refVisible = this.isExpressionVisible(ref, stack.concat(question.id));
    var value = refVisible ? this.questionValue(ref) : ref.default;
    return this.evaluateExpression(question.visible_if_value, value, ref);
  };

  proto.isQuestionVisible = function (question) {
    if (!this.passesRoleView(question)) {
      return false;
    }
    return this.isExpressionVisible(question, []);
  };

  proto.evaluateExpression = function (expression, value, refQuestion) {
    var expr = String(expression === null || typeof expression === "undefined" ? "" : expression).trim();
    if (expr === "") {
      return value === true || (value !== false && value !== null && typeof value !== "undefined" && value !== "");
    }
    var negate = false;
    if (expr.charAt(0) === "!") {
      negate = true;
      expr = expr.slice(1);
    }
    var tokens = expr.split("|").map(function (token) {
      return token.trim();
    }).filter(function (token) {
      return token !== "";
    });
    var match = tokens.some(function (token) {
      return valueMatchesToken(value, token, refQuestion);
    });
    return negate ? !match : match;
  };

  function valueMatchesToken(value, token, refQuestion) {
    var lowered = token.toLowerCase();
    if (lowered === "true") {
      return boolToken(value) === true;
    }
    if (lowered === "false") {
      return boolToken(value) === false;
    }
    if (lowered === "other") {
      if (value === null || typeof value === "undefined" || value === "") {
        return false;
      }
      if (ciEquals(value, "other")) {
        return true;
      }
      var options = (refQuestion && refQuestion.options) || [];
      var present = options.some(function (option) {
        return ciEquals(value, option.value);
      });
      return !present;
    }
    // Boolean-aware comparison when the token is a boolean word and value is boolean.
    var tokenBool = boolToken(token);
    if (typeof value === "boolean" && tokenBool !== null) {
      return value === tokenBool;
    }
    return ciEquals(value, token);
  }

  // --- rendering ------------------------------------------------------------

  proto.render = function () {
    this.recomputeScores();
    this.getCurrentCategory();
    if (!this.viewAvailable(this.view, this.role)) {
      this.view = DEFAULT_VIEW[this.role];
    }
    this.syncSelects();
    this.syncHeaderControls();
    this.renderHeader();
    this.renderFooter();
    this.renderCategoryNav();

    var containers = this.containers;
    if (this.view === "overview") {
      this.renderSummary();
    } else if (containers.summary) {
      containers.summary.innerHTML = "";
    }

    if (this.view === "tabular") {
      if (containers.questions) {
        containers.questions.innerHTML = "";
      }
      this.renderTabular();
    } else if (this.view === "template") {
      if (containers.questions) {
        containers.questions.innerHTML = "";
      }
      this.renderTemplateEditor();
    } else if (this.view === "display") {
      this.renderDisplay();
      if (containers.editor) {
        containers.editor.innerHTML = "";
      }
    } else {
      this.renderQuestions();
      this.renderEditorPanel();
    }

    this.flushPendingScroll();
  };

  proto.syncSelects = function () {
    var doc = W.document;
    if (!doc) {
      return;
    }
    var self = this;
    var roleSelect = doc.getElementById("role-select");
    if (roleSelect) {
      roleSelect.innerHTML = ROLES.map(function (role) {
        return '<option value="' + escapeHtml(role) + '">' + escapeHtml(self.roleLabels[role]) + "</option>";
      }).join("");
      roleSelect.value = this.role;
    }
    var viewSelect = doc.getElementById("view-select");
    if (viewSelect) {
      viewSelect.innerHTML = this.getAvailableViews().map(function (view) {
        return '<option value="' + escapeHtml(view) + '">' + escapeHtml(self.viewLabels[view]) + "</option>";
      }).join("");
      viewSelect.value = this.view;
    }
    // Visibility checkboxes — only shown in reviewer/editor roles.
    var normalCb = doc.getElementById("show-normal-checkbox");
    if (normalCb) {
      normalCb.checked = this.showNormalQuestions;
      if (!normalCb._qBound) {
        normalCb._qBound = true;
        normalCb.addEventListener("change", function () {
          self.showNormalQuestions = normalCb.checked;
          self.render();
        });
      }
    }
    var reviewerCb = doc.getElementById("show-reviewer-checkbox");
    if (reviewerCb) {
      reviewerCb.checked = this.showReviewerQuestions;
      if (!reviewerCb._qBound) {
        reviewerCb._qBound = true;
        reviewerCb.addEventListener("change", function () {
          self.showReviewerQuestions = reviewerCb.checked;
          self.render();
        });
      }
    }
  };

  proto.syncHeaderControls = function () {
    var doc = W.document;
    if (!doc) {
      return;
    }
    var self = this;
    doc.querySelectorAll("[data-roles]").forEach(function (el) {
      var roles = el.getAttribute("data-roles").split(/\s+/).filter(Boolean);
      el.hidden = roles.indexOf(self.role) === -1;
    });
    var shell = doc.querySelector(".q-shell");
    if (shell) {
      shell.classList.toggle("is-fullwidth", this.role === "editor");
    }
  };

  proto.renderCategoryNav = function () {
    var container = this.containers.categoryNav;
    if (!container) {
      return;
    }
    var categories = this.getCategories();
    if (categories.length <= 1 || this.view === "tabular" || this.view === "template" || this.view === "display") {
      container.innerHTML = "";
      container.hidden = true;
      return;
    }
    container.hidden = false;
    var self = this;
    container.innerHTML = categories.map(function (category) {
      var current = category === self.currentCategory ? " is-current" : "";
      return '<button type="button" class="q-category-tab' + current + '" data-category="' +
        escapeHtml(category) + '">' + escapeHtml(category) + "</button>";
    }).join("");
    container.querySelectorAll("[data-category]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.setCategory(button.getAttribute("data-category"));
      });
    });
  };

  proto.renderSummary = function () {
    var container = this.containers.summary;
    if (!container) {
      return;
    }
    var score = this.getScore();
    container.innerHTML = '<div class="q-summary-panel">' +
      this.renderSummaryBlock(this.getCurrentCategory(), score.current_category) +
      this.renderSummaryBlock(this.totalLabel, score.total) +
      "</div>";
  };

  proto.renderSummaryBlock = function (label, summary) {
    var self = this;
    var rag = this.ragClass(summary.score);
    var ragClass = rag ? " q-rag-" + rag : "";
    var scoreText = summary.score === null ? "–" : (Math.round(summary.score * 10) / 10) + "%";
    var counts = REVIEW_STATUSES.map(function (status) {
      return '<span class="q-summary-count q-status-' + status + '">' +
        escapeHtml(self.statusLabels[status]) + ": " + summary.counts[status] + "</span>";
    }).join("");
    return '<div class="q-summary-block' + ragClass + '">' +
      '<div class="q-summary-label">' + escapeHtml(label) + "</div>" +
      '<div class="q-summary-counts">' + counts + "</div>" +
      '<div class="q-summary-score">' + escapeHtml(scoreText) + "</div>" +
      '<div class="q-summary-total"><strong>' + summary.total + "</strong> review question(s)</div>" +
      "</div>";
  };

  proto.renderDisplay = function () {
    var container = this.containers.questions;
    if (!container) { return; }
    var self = this;
    var categories = this.getCategories();
    var displayCardTpl = this.getTemplateBody("display_card");
    var displayReviewerTpl = this.getTemplateBody("display_reviewer_card");
    var html = '<div class="q-display">';
    categories.forEach(function (cat) {
      html += '<h2 class="q-display-category">' + escapeHtml(cat) + "</h2>";
      self.questions.forEach(function (question) {
        if (question.category !== cat) { return; }
        if (!self.passesRoleView(question)) { return; }
        if (!self.isQuestionVisible(question)) { return; }
        var ctx = self.questionContext(question);
        var tpl = question.type === "review" ? displayReviewerTpl : displayCardTpl;
        html += W.Mustache ? W.Mustache.render(tpl, ctx) : tpl;
      });
    });
    html += "</div>";
    container.innerHTML = html;
    if (this.containers.editor) { this.containers.editor.innerHTML = ""; }
  };

  proto.renderHeader = function () {
    var container = this.containers.header;
    if (!container) { return; }
    var tpl = this.getTemplateBody("header");
    var ctx = {
      title: this.config.title || "",
      version: this.config.version || "",
      id: this.config.id || "",
      _role: this.role,
      _view: this.view
    };
    container.innerHTML = W.Mustache ? W.Mustache.render(tpl, ctx) : tpl;
    this.bindHeader(container);
  };

  proto.renderFooter = function () {
    var container = this.containers.footer;
    if (!container) { return; }
    if (this.view === "template" || this.view === "display") {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    var tpl = this.getTemplateBody("footer");
    var ctx = {
      title: this.config.title || "",
      version: this.config.version || "",
      id: this.config.id || "",
      _role: this.role,
      _view: this.view
    };
    container.innerHTML = W.Mustache ? W.Mustache.render(tpl, ctx) : tpl;
    this.bindHeader(container);
  };

  proto.bindHeader = function (container) {
    var self = this;
    var doc = W.document;
    // Role select
    var roleSelect = container.querySelector("#role-select") || (doc && doc.getElementById("role-select"));
    if (roleSelect && !roleSelect._qBound) {
      roleSelect._qBound = true;
      roleSelect.addEventListener("change", function () {
        self.setRole(roleSelect.value);
      });
    }
    // View select
    var viewSelect = container.querySelector("#view-select") || (doc && doc.getElementById("view-select"));
    if (viewSelect && !viewSelect._qBound) {
      viewSelect._qBound = true;
      viewSelect.addEventListener("change", function () {
        self.setView(viewSelect.value);
      });
    }
    // Prev/Next
    var prev = container.querySelector("#prev-category") || (doc && doc.getElementById("prev-category"));
    if (prev && !prev._qBound) {
      prev._qBound = true;
      prev.addEventListener("click", function () { self.previousCategory(); });
    }
    var next = container.querySelector("#next-category") || (doc && doc.getElementById("next-category"));
    if (next && !next._qBound) {
      next._qBound = true;
      next.addEventListener("click", function () { self.nextCategory(); });
    }
    // Save/Load
    var saveHtml = container.querySelector("#save-html") || (doc && doc.getElementById("save-html"));
    if (saveHtml && !saveHtml._qBound) {
      saveHtml._qBound = true;
      saveHtml.addEventListener("click", function () { self.saveHtmlFile(); });
    }
    var saveCsv = container.querySelector("#save-csv") || (doc && doc.getElementById("save-csv"));
    if (saveCsv && !saveCsv._qBound) {
      saveCsv._qBound = true;
      saveCsv.addEventListener("click", function () { self.saveCsvFile(); });
    }
    var saveJson = container.querySelector("#save-json") || (doc && doc.getElementById("save-json"));
    if (saveJson && !saveJson._qBound) {
      saveJson._qBound = true;
      saveJson.addEventListener("click", function () { self.saveJsonFile(); });
    }
    var loadCsv = container.querySelector("#load-csv") || (doc && doc.getElementById("load-csv"));
    if (loadCsv && !loadCsv._qBound) {
      loadCsv._qBound = true;
      loadCsv.addEventListener("change", function () {
        var file = loadCsv.files && loadCsv.files[0];
        if (!file) { return; }
        file.text().then(function (text) { self.loadCsv(text); });
      });
    }
    this.syncHeaderControls();
    this.syncSelects();
  };

  proto.currentQuestions = function () {
    var self = this;
    return this.questions.filter(function (question) {
      return question.category === self.getCurrentCategory();
    });
  };

  proto.renderQuestions = function () {
    var container = this.containers.questions;
    if (!container) {
      return;
    }
    var self = this;
    var visible = this.currentQuestions().filter(function (question) {
      return self.isQuestionVisible(question);
    });
    if (!visible.length) {
      container.innerHTML = '<p class="q-empty">No questions to display.</p>';
      return;
    }
    container.innerHTML = visible.map(function (question) {
      return self.renderQuestion(question);
    }).join("");
    this.bindQuestionControls(container);
  };

  proto.pickCardTemplate = function (question) {
    var isReviewCard = question.type === "review" && (this.role === "reviewer" || this.role === "editor");
    if (isReviewCard) {
      var reviewerTemplate = this.templateOverrides.reviewer_card || getTemplateHtml(this.templates.reviewerQuestionCard);
      if (reviewerTemplate) {
        return reviewerTemplate;
      }
      return this.templateOverrides.question_card || getTemplateHtml(this.templates.questionCard) || DEFAULT_REVIEWER_CARD;
    }
    return this.templateOverrides.question_card || getTemplateHtml(this.templates.questionCard) || DEFAULT_QUESTION_CARD;
  };

  function answerDisplay(value) {
    if (value === null || typeof value === "undefined") { return ""; }
    if (value === true) { return "Yes"; }
    if (value === false) { return "No"; }
    return String(value);
  }

  proto.questionContext = function (question) {
    var context = deepClone(question);
    context._role = this.role;
    context._view = this.view;
    context._editor = this.role === "editor";
    context._reviewer = this.role === "reviewer";
    context._interviewed = this.role === "interviewed";
    context._visible = this.isQuestionVisible(question);
    context._is_review = question.type === "review";
    context._category_title = question.category;
    context._status_label = this.statusLabels[question.review_status] || question.review_status;
    context._analysis_visible = (this.role === "reviewer" || this.role === "editor") && !!question.analysis;
    context._comment_readonly = this.role === "interviewed" && !!question.reviewer_comment;
    context._has_comment = !!question.reviewer_comment;
    context._highlight_reviewer = question.type === "review" && this.showNormalQuestions && this.showReviewerQuestions;
    context._answer_display = answerDisplay(question.answer);
    var errors = this.validationErrors[question.id];
    context._errors = errors ? [errors] : [];
    var rag = this.ragClass(null);
    context._rag = rag;
    return context;
  };

  proto.renderQuestion = function (question) {
    var template = this.pickCardTemplate(question);
    var doc = W.document;
    var wrapper = doc.createElement("div");
    wrapper.innerHTML = renderTemplate(template, this.questionContext(question)).trim();
    var node = wrapper.firstElementChild;
    if (!node) {
      return "";
    }
    if (!node.getAttribute("data-question-id")) {
      node.setAttribute("data-question-id", question.id);
    }
    var control = node.querySelector("[data-question-control]");
    if (control) {
      control.innerHTML = this.renderQuestionControl(question);
    }
    var review = node.querySelector("[data-review-control]");
    if (review) {
      review.innerHTML = this.renderReviewControl(question);
    }
    var comment = node.querySelector("[data-reviewer-comment-control]");
    if (comment) {
      comment.innerHTML = this.renderCommentControl(question);
    }
    return node.outerHTML;
  };

  proto.answerDisabled = function (question) {
    if (this.role === "reviewer" && question.type !== "review") {
      return true;
    }
    return false;
  };

  proto.renderQuestionControl = function (question) {
    var value = this.questionValue(question);
    var disabled = this.answerDisabled(question) ? " disabled" : "";
    var id = escapeHtml(question.id);

    if (question.type === "info") {
      return '<pre class="q-info">' + escapeHtml(value || "") + "</pre>";
    }
    if (question.type === "html") {
      return '<div class="q-html">' + String(value || "") + "</div>";
    }
    if (question.type === "checkbox") {
      var checked = boolToken(value) === true ? " checked" : "";
      var label = (question.options[0] && question.options[0].label) || "Yes";
      return '<label class="q-choice"><input type="checkbox" data-answer="' + id + '"' + checked + disabled +
        "><span>" + escapeHtml(label) + "</span></label>";
    }
    if (question.type === "yes_or_no") {
      return this.renderYesNo(question, value, disabled, false);
    }
    if (question.type === "yes_or_text") {
      return this.renderYesNo(question, value, disabled, "yes");
    }
    if (question.type === "no_or_text") {
      return this.renderYesNo(question, value, disabled, "no");
    }
    if (question.type === "date") {
      var dateVal = escapeHtml(value || "");
      var todayBtn = disabled ? "" :
        '<button type="button" class="q-date-today" data-date-today="' + id + '">Today</button>';
      return '<label class="q-subfield"><span class="sr-only">' + escapeHtml(question.question) +
        '</span><input type="date" data-answer="' + id + '" value="' + dateVal + '"' + disabled + ">" +
        todayBtn + "</label>";
    }
    if (question.type === "radio") {
      var hasOtherRadio = (question.options || []).some(function (o) { return o.is_other; });
      var selectedOtherRadio = hasOtherRadio && (question.options || []).some(function (o) {
        return o.is_other && ciEquals(value, o.value);
      });
      var otherTextRadio = (hasOtherRadio && !selectedOtherRadio && typeof value === "string" && value !== "")
        ? value : "";
      var radioValue = hasOtherRadio && !selectedOtherRadio && typeof value === "string" && value !== ""
        ? ((question.options || []).find(function (o) { return o.is_other; }) || {}).value || ""
        : value;
      var radioMarkup = '<fieldset class="q-fieldset">' + (question.options || []).map(function (option) {
        var optionChecked = ciEquals(radioValue, option.value) ? " checked" : "";
        return '<label class="q-choice"><input type="radio" name="' + id + '" data-other="' + id +
          '" value="' + escapeHtml(optionValueToString(option.value)) + '"' + optionChecked + disabled +
          (option.is_other ? ' data-is-other="1"' : "") +
          "><span>" + escapeHtml(option.label || option.value) + "</span></label>";
      }).join("") + "</fieldset>";
      if (hasOtherRadio) {
        var showOtherRadio = selectedOtherRadio || otherTextRadio !== "";
        var otherRows = Number(question.rows || 1);
        var otherInput = otherRows > 1
          ? '<textarea data-other-text="' + id + '" rows="' + otherRows + '"' + disabled + ">" + escapeHtml(otherTextRadio) + "</textarea>"
          : '<input type="text" data-other-text="' + id + '" value="' + escapeHtml(otherTextRadio) + '"' + disabled + ">";
        radioMarkup += '<label class="q-subfield q-other-text"' + (showOtherRadio ? "" : " hidden") + ">" +
          "<span>Please specify</span>" +
          otherInput +
          "</label>";
      }
      return radioMarkup;
    }
    if (question.type === "dropdown") {
      var hasOtherDrop = (question.options || []).some(function (o) { return o.is_other; });
      var otherOption = hasOtherDrop ? (question.options || []).find(function (o) { return o.is_other; }) : null;
      var selectedOtherDrop = hasOtherDrop && ciEquals(value, otherOption && otherOption.value);
      var dropTextValue = (hasOtherDrop && !selectedOtherDrop && typeof value === "string" && value !== "")
        ? value : "";
      var dropValue = (hasOtherDrop && !selectedOtherDrop && typeof value === "string" && value !== "")
        ? (otherOption ? otherOption.value : "") : value;
      var dropMarkup = '<label class="q-subfield"><span class="sr-only">' + escapeHtml(question.question) +
        '</span><select data-other="' + id + '"' + disabled + '><option value=""></option>' +
        (question.options || []).map(function (option) {
          var selected = ciEquals(dropValue, option.value) ? " selected" : "";
          return '<option value="' + escapeHtml(optionValueToString(option.value)) + '"' + selected +
            (option.is_other ? ' data-is-other="1"' : "") + ">" +
            escapeHtml(option.label || option.value) + "</option>";
        }).join("") + "</select></label>";
      if (hasOtherDrop) {
        var showOtherDrop = selectedOtherDrop || dropTextValue !== "";
        var otherDropRows = Number(question.rows || 1);
        var otherDropInput = otherDropRows > 1
          ? '<textarea data-other-text="' + id + '" rows="' + otherDropRows + '"' + disabled + ">" + escapeHtml(dropTextValue) + "</textarea>"
          : '<input type="text" data-other-text="' + id + '" value="' + escapeHtml(dropTextValue) + '"' + disabled + ">";
        dropMarkup += '<label class="q-subfield q-other-text"' + (showOtherDrop ? "" : " hidden") + ">" +
          "<span>Please specify</span>" +
          otherDropInput +
          "</label>";
      }
      return dropMarkup;
    }
    // text and review use a text input / textarea
    var rows = Number(question.rows || 1);
    if (rows > 1 || question.type === "review") {
      var textRows = rows > 1 ? rows : 4;
      return '<label class="q-subfield"><span class="sr-only">' + escapeHtml(question.question) +
        '</span><textarea data-answer="' + id + '" rows="' + textRows + '"' + disabled + ">" +
        escapeHtml(value || "") + "</textarea></label>";
    }
    return '<label class="q-subfield"><span class="sr-only">' + escapeHtml(question.question) +
      '</span><input type="text" data-answer="' + id + '" value="' + escapeHtml(value || "") + '"' + disabled +
      "></label>";
  };

  // mode: false (yes_or_no), "yes" (yes_or_text: text on No), "no" (no_or_text: text on Yes)
  proto.renderYesNo = function (question, value, disabled, mode) {
    var id = escapeHtml(question.id);
    var bool = boolToken(value);
    var isString = typeof value === "string" && value !== "" && bool === null;
    var yesSelected;
    var noSelected;
    if (mode === "yes") {
      // yes_or_text: answer is true (Yes) or string/false (No); text shown on No
      yesSelected = bool === true;
      noSelected = bool === false || isString;
    } else if (mode === "no") {
      // no_or_text: answer is false (No) or string/true (Yes); text shown on Yes
      yesSelected = bool === true || isString;
      noSelected = bool === false;
    } else {
      yesSelected = bool === true;
      noSelected = bool === false;
    }
    var markup = '<fieldset class="q-fieldset q-yesno">' +
      '<label class="q-choice"><input type="radio" name="' + id + '" data-yesno="' + id +
      '" value="yes"' + (yesSelected ? " checked" : "") + disabled + "><span>Yes</span></label>" +
      '<label class="q-choice"><input type="radio" name="' + id + '" data-yesno="' + id +
      '" value="no"' + (noSelected ? " checked" : "") + disabled + "><span>No</span></label>" +
      "</fieldset>";
    if (mode) {
      var showText = mode === "yes" ? noSelected : yesSelected;
      var textValue = isString ? value : "";
      var rows = Number(question.rows || 1);
      var textControl;
      if (rows > 1) {
        textControl = '<textarea data-yesno-text="' + id + '" rows="' + rows + '"' + disabled + ">" +
          escapeHtml(textValue) + "</textarea>";
      } else {
        textControl = '<input type="text" data-yesno-text="' + id + '" value="' +
          escapeHtml(textValue) + '"' + disabled + ">";
      }
      markup += '<label class="q-subfield q-yesno-text"' + (showText ? "" : ' hidden') + ">" +
        "<span>Details</span>" + textControl + "</label>";
    }
    return markup;
  };

  proto.renderReviewControl = function (question) {
    if (question.type !== "review" || (this.role !== "reviewer" && this.role !== "editor")) {
      return "";
    }
    var self = this;
    var id = escapeHtml(question.id);
    var statusClass = "q-review-status q-status-" + escapeHtml(question.review_status || "pending");
    return '<div class="q-review-panel"><label class="q-review-field"><span>Review status</span>' +
      '<select class="' + statusClass + '" data-review-status="' + id + '">' +
      REVIEW_STATUSES.map(function (status) {
        var selected = question.review_status === status ? " selected" : "";
        return '<option value="' + escapeHtml(status) + '"' + selected + ">" +
          escapeHtml(self.statusLabels[status] || status) + "</option>";
      }).join("") + "</select></label></div>";
  };

  proto.renderCommentControl = function (question) {
    var id = escapeHtml(question.id);
    if (this.role === "interviewed") {
      if (!question.reviewer_comment) { return ""; }
      return '<aside class="q-comment-balloon"><p class="q-comment-balloon-text">' +
        escapeHtml(question.reviewer_comment) + "</p></aside>";
    }
    if (this.role !== "reviewer" && this.role !== "editor") {
      return "";
    }
    return '<aside class="q-comment-balloon q-comment-balloon-edit">' +
      '<label class="q-review-field q-comment-field"><span>Reviewer comment</span>' +
      '<textarea data-comment="' + id + '">' + escapeHtml(question.reviewer_comment || "") + "</textarea></label>" +
      "</aside>";
  };

  proto.bindQuestionControls = function (container) {
    var self = this;
    container.querySelectorAll("[data-answer]").forEach(function (element) {
      var id = element.getAttribute("data-answer");
      var isText = element.tagName === "TEXTAREA" || element.type === "text";
      element.addEventListener(isText ? "input" : "change", function (event) {
        var question = self.getQuestion(id);
        var value;
        if (element.type === "checkbox") {
          value = element.checked;
        } else if (isText) {
          value = element.value;
        } else {
          value = parseScalar(element.value);
        }
        self.setAnswer(id, value, { deferRender: isText });
        if (question && (question.type === "radio" || question.type === "dropdown" || question.type === "checkbox")) {
          self.render();
        }
      });
    });

    container.querySelectorAll("[data-yesno]").forEach(function (element) {
      element.addEventListener("change", function () {
        self.handleYesNoChange(element.getAttribute("data-yesno"));
      });
    });
    container.querySelectorAll("[data-yesno-text]").forEach(function (element) {
      element.addEventListener("input", function () {
        self.handleYesNoChange(element.getAttribute("data-yesno-text"));
      });
    });
    container.querySelectorAll("[data-other]").forEach(function (element) {
      element.addEventListener("change", function () {
        self.handleOtherChange(element.getAttribute("data-other"));
      });
    });
    container.querySelectorAll("[data-other-text]").forEach(function (element) {
      element.addEventListener("input", function () {
        self.handleOtherChange(element.getAttribute("data-other-text"));
      });
    });
    container.querySelectorAll("[data-date-today]").forEach(function (element) {
      element.addEventListener("click", function () {
        var qid = element.getAttribute("data-date-today");
        var card = container.querySelector('[data-question-id="' + cssEscape(qid) + '"]');
        var dateInput = card && card.querySelector('[data-answer="' + cssEscape(qid) + '"]');
        if (!dateInput) { return; }
        var now = new Date();
        var y = now.getFullYear();
        var m = String(now.getMonth() + 1).padStart(2, "0");
        var d = String(now.getDate()).padStart(2, "0");
        var today = y + "-" + m + "-" + d;
        dateInput.value = today;
        self.setAnswer(qid, today);
      });
    });

    container.querySelectorAll("[data-review-status]").forEach(function (element) {
      element.addEventListener("change", function () {
        self.setReviewStatus(element.getAttribute("data-review-status"), element.value);
      });
    });
    container.querySelectorAll("[data-comment]").forEach(function (element) {
      element.addEventListener("input", function () {
        self.setReviewerComment(element.getAttribute("data-comment"), element.value, { deferRender: true });
      });
    });
    container.querySelectorAll("[data-edit-question]").forEach(function (element) {
      element.addEventListener("click", function () {
        self.openEditor(element.getAttribute("data-edit-question"));
      });
    });
  };

  proto.handleOtherChange = function (id) {
    var container = this.containers.questions;
    var question = this.getQuestion(id);
    if (!container || !question) { return; }
    var card = container.querySelector('[data-question-id="' + cssEscape(id) + '"]');
    if (!card) { return; }
    var otherTextInput = card.querySelector('[data-other-text="' + cssEscape(id) + '"]');
    var otherTextWrap = otherTextInput ? otherTextInput.closest(".q-other-text") : null;
    var isOtherSelected;
    var value;
    if (question.type === "radio") {
      var checkedRadio = card.querySelector('[data-other="' + cssEscape(id) + '"]:checked');
      isOtherSelected = !!(checkedRadio && checkedRadio.getAttribute("data-is-other"));
      if (isOtherSelected) {
        if (otherTextWrap) { otherTextWrap.hidden = false; }
        value = (otherTextInput && otherTextInput.value !== "") ? otherTextInput.value : null;
      } else {
        if (otherTextWrap) { otherTextWrap.hidden = true; }
        value = checkedRadio ? parseScalar(checkedRadio.value) : null;
      }
    } else if (question.type === "dropdown") {
      var selectEl = card.querySelector('[data-other="' + cssEscape(id) + '"]');
      var selectedOption = selectEl && selectEl.options[selectEl.selectedIndex];
      isOtherSelected = !!(selectedOption && selectedOption.getAttribute("data-is-other"));
      if (isOtherSelected) {
        if (otherTextWrap) { otherTextWrap.hidden = false; }
        value = (otherTextInput && otherTextInput.value !== "") ? otherTextInput.value : null;
      } else {
        if (otherTextWrap) { otherTextWrap.hidden = true; }
        value = selectEl ? parseScalar(selectEl.value) : null;
      }
    } else {
      return;
    }
    this.setAnswer(id, value, { deferRender: true });
  };

  proto.handleYesNoChange = function (id) {
    var container = this.containers.questions;
    var question = this.getQuestion(id);
    if (!container || !question) {
      return;
    }
    var card = container.querySelector('[data-question-id="' + cssEscape(id) + '"]');
    if (!card) {
      return;
    }
    var checkedRadio = card.querySelector('[data-yesno="' + cssEscape(id) + '"]:checked');
    var choice = checkedRadio ? checkedRadio.value : "";
    var textInput = card.querySelector('[data-yesno-text="' + cssEscape(id) + '"]');
    var textWrap = textInput ? textInput.closest(".q-yesno-text") : null;
    var value;

    if (question.type === "yes_or_text") {
      if (choice === "yes") {
        value = true;
        if (textWrap) { textWrap.hidden = true; }
      } else if (choice === "no") {
        value = textInput && textInput.value !== "" ? textInput.value : false;
        if (textWrap) { textWrap.hidden = false; }
      } else {
        value = null;
      }
    } else if (question.type === "no_or_text") {
      if (choice === "no") {
        value = false;
        if (textWrap) { textWrap.hidden = true; }
      } else if (choice === "yes") {
        value = textInput && textInput.value !== "" ? textInput.value : true;
        if (textWrap) { textWrap.hidden = false; }
      } else {
        value = null;
      }
    } else {
      value = choice === "yes" ? true : (choice === "no" ? false : null);
    }
    this.setAnswer(id, value, { deferRender: true });
  };

  function cssEscape(value) {
    return String(value).replace(/["\\]/g, "\\$&");
  }

  proto.flushPendingScroll = function () {
    if (this._pendingScrollY !== null && typeof this._pendingScrollY !== "undefined") {
      var savedY = this._pendingScrollY;
      this._pendingScrollY = null;
      if (W.scrollTo) { W.scrollTo(0, savedY); }
    }
    if (!this._pendingScrollId) {
      return;
    }
    var id = this._pendingScrollId;
    this._pendingScrollId = null;
    var container = this.containers.questions;
    if (!container) {
      return;
    }
    var element = container.querySelector('[data-question-id="' + cssEscape(id) + '"]');
    if (element) {
      if (typeof element.scrollIntoView === "function") {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      element.classList.add("q-highlight");
      W.setTimeout(function () {
        element.classList.remove("q-highlight");
      }, 2000);
    }
    if (this.role === "editor" && this.view === "normal") {
      this.openEditor(id);
    }
  };

  // --- editor panel ---------------------------------------------------------

  proto.openEditor = function (id) {
    this.editingId = id;
    if (this.view === "normal" || this.view === "overview") {
      this.updateHash();
    }
    this.renderEditorPanel();
  };

  proto.closeEditor = function () {
    this.editingId = null;
    this.render();
  };

  proto.renderEditorPanel = function () {
    var container = this.containers.editor;
    if (!container) {
      return;
    }
    if (this.role !== "editor" || !this.editingId) {
      // Only clear if we own the container in this view.
      if (this.view === "normal" || this.view === "overview") {
        container.innerHTML = "";
      } else {
        var existing = container.querySelector(".q-editor-panel");
        if (existing) {
          existing.parentNode.removeChild(existing);
        }
      }
      return;
    }
    var question = this.getQuestion(this.editingId);
    if (!question) {
      this.editingId = null;
      return;
    }
    var panelHtml = '<div class="q-editor-panel"><div class="q-editor-panel-head"><h3>Edit: ' +
      escapeHtml(question.id) + '</h3><button type="button" class="q-editor-close" data-editor-close>✕ Close</button></div>' +
      this.renderEditorForm(question) + "</div>";

    if (this.view === "normal" || this.view === "overview") {
      container.innerHTML = panelHtml;
    } else {
      var old = container.querySelector(".q-editor-panel");
      if (old) {
        old.parentNode.removeChild(old);
      }
      container.insertAdjacentHTML("beforeend", panelHtml);
    }
    this.bindEditorForm(container, question.id);
  };

  proto.renderEditorForm = function (question) {
    var self = this;
    var template = this.templateOverrides.editor_form || getTemplateHtml(this.templates.editorForm);
    var fieldMap = {};
    this.editorFields.forEach(function (field) {
      fieldMap[field.name] = field;
    });
    if (!template) {
      return '<div class="q-editor-grid">' + this.editorFields.map(function (field) {
        return self.renderEditorField(question, field);
      }).join("") + "</div>";
    }
    var wrapper = W.document.createElement("div");
    wrapper.innerHTML = renderTemplate(template, this.questionContext(question)).trim();
    var form = wrapper.firstElementChild;
    if (!form) {
      return "";
    }
    form.querySelectorAll("[data-editor-field]").forEach(function (slot) {
      var name = slot.getAttribute("data-editor-field");
      var field = fieldMap[name] || { name: name, label: name, ui: "text" };
      slot.classList.add("q-editor-slot");
      if (field.ui === "options_table") {
        slot.classList.add("is-wide");
      }
      slot.innerHTML = self.renderEditorField(question, field);
    });
    return form.outerHTML;
  };

  proto.renderEditorField = function (question, field) {
    var value = question[field.name];
    var name = escapeHtml(field.name);
    var input;
    if (field.ui === "options_table") {
      return '<div class="q-editor-field is-wide"><span>' + escapeHtml(field.label || field.name) + "</span>" +
        this.renderOptionsEditor(question) + "</div>";
    }
    if (field.ui === "checkbox") {
      input = '<input type="checkbox" data-editor-field="' + name + '"' + (value ? " checked" : "") + ">";
    } else if (field.ui === "textarea" || field.ui === "json_textarea") {
      var text = field.ui === "json_textarea" && (Array.isArray(value) || (value && typeof value === "object"))
        ? JSON.stringify(value, null, 2) : (value === null || typeof value === "undefined" ? "" : value);
      input = '<textarea data-editor-field="' + name + '" rows="3">' + escapeHtml(text) + "</textarea>";
    } else if (field.ui === "select") {
      input = '<select data-editor-field="' + name + '">' + (field.options || []).map(function (option) {
        var selected = String(value || "") === String(option) ? " selected" : "";
        return '<option value="' + escapeHtml(option) + '"' + selected + ">" + escapeHtml(option || "(none)") + "</option>";
      }).join("") + "</select>";
    } else if (field.ui === "question_select") {
      input = '<select data-editor-field="' + name + '"><option value=""></option>' + this.questions.map(function (item) {
        var selected = value === item.id ? " selected" : "";
        return '<option value="' + escapeHtml(item.id) + '"' + selected + ">" + escapeHtml(item.id) + "</option>";
      }).join("") + "</select>";
    } else if (field.ui === "question_datalist") {
      var dlId = "qlist-" + escapeHtml(question.id);
      input = '<input type="text" list="' + dlId + '" data-editor-field="' + name +
        '" value="' + escapeHtml(displayValue(value)) + '">' +
        '<datalist id="' + dlId + '">' +
        this.questions.map(function (item) {
          return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.id) + "</option>";
        }).join("") + "</datalist>";
    } else if (field.ui === "visibility_value_datalist") {
      var vdlId = "vlist-" + escapeHtml(question.id);
      var targetQ = question.visible_if_id ? this.getQuestion(question.visible_if_id) : null;
      var targetOpts = (targetQ && targetQ.options) || [];
      var baseKeywords = ["true", "false", "other", "!true", "!false", "!other"];
      var optionValues = targetOpts.map(function (o) { return optionValueToString(o.value); });
      var negated = optionValues.map(function (v) { return "!" + v; });
      var allValues = baseKeywords.concat(optionValues).concat(negated);
      input = '<input type="text" list="' + vdlId + '" data-editor-field="' + name +
        '" value="' + escapeHtml(displayValue(value)) + '">' +
        '<datalist id="' + vdlId + '">' +
        allValues.map(function (v) {
          return '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + "</option>";
        }).join("") + "</datalist>";
    } else {
      input = '<input type="' + (field.ui === "number" ? "number" : "text") + '" data-editor-field="' + name +
        '" value="' + escapeHtml(displayValue(value)) + '">';
    }
    return '<label class="q-editor-field"><span>' + escapeHtml(field.label || field.name) + "</span>" + input + "</label>";
  };

  proto.renderOptionsEditor = function (question) {
    var rows = (question.options || []).map(function (option, index) {
      return '<tr data-option-index="' + index + '">' +
        '<td><input type="text" data-option-field="value" value="' + escapeHtml(optionValueToString(option.value)) + '"></td>' +
        '<td><input type="text" data-option-field="label" value="' + escapeHtml(option.label || "") + '"></td>' +
        '<td class="q-option-other"><input type="checkbox" data-option-field="is_other"' + (option.is_other ? " checked" : "") + '></td>' +
        '<td class="q-option-actions">' +
        '<button type="button" data-option-up title="Move up">↑</button>' +
        '<button type="button" data-option-down title="Move down">↓</button>' +
        '<button type="button" data-option-delete title="Delete">🗑️</button>' +
        '</td></tr>';
    }).join("");
    return '<div class="q-options-editor">' +
      '<table><thead><tr><th>Value</th><th>Label</th><th>Other</th><th>Actions</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<button type="button" data-option-add>➕ Add option</button>' +
      '</div>';
  };

  proto.bindOptionsEditor = function (panel, id) {
    var self = this;
    var optionsEditor = panel.querySelector(".q-options-editor");
    if (!optionsEditor) {
      return;
    }

    function collectOptions() {
      var options = [];
      optionsEditor.querySelectorAll("[data-option-index]").forEach(function (row) {
        options.push({
          value: parseScalar(row.querySelector('[data-option-field="value"]').value),
          label: row.querySelector('[data-option-field="label"]').value,
          is_other: row.querySelector('[data-option-field="is_other"]').checked
        });
      });
      return options;
    }

    optionsEditor.querySelectorAll("[data-option-field]").forEach(function (input) {
      input.addEventListener(input.type === "checkbox" ? "change" : "input", function () {
        self.updateQuestionField(id, "options", collectOptions(), { deferRender: true });
      });
    });

    optionsEditor.querySelectorAll("[data-option-up]").forEach(function (button) {
      button.addEventListener("click", function () {
        var row = button.closest("[data-option-index]");
        var prev = row && row.previousElementSibling;
        if (prev) {
          row.parentNode.insertBefore(row, prev);
          self.updateQuestionField(id, "options", collectOptions());
        }
      });
    });

    optionsEditor.querySelectorAll("[data-option-down]").forEach(function (button) {
      button.addEventListener("click", function () {
        var row = button.closest("[data-option-index]");
        var next = row && row.nextElementSibling;
        if (next) {
          row.parentNode.insertBefore(next, row);
          self.updateQuestionField(id, "options", collectOptions());
        }
      });
    });

    optionsEditor.querySelectorAll("[data-option-delete]").forEach(function (button) {
      button.addEventListener("click", function () {
        var row = button.closest("[data-option-index]");
        if (row) {
          row.remove();
          self.updateQuestionField(id, "options", collectOptions());
        }
      });
    });

    var add = optionsEditor.querySelector("[data-option-add]");
    if (add) {
      add.addEventListener("click", function () {
        var opts = collectOptions();
        opts.push({ value: "", label: "", is_other: false });
        self.updateQuestionField(id, "options", opts);
      });
    }
  };

  proto.bindEditorForm = function (container, id) {
    var self = this;
    var panel = container.querySelector(".q-editor-panel");
    if (!panel) {
      return;
    }
    var close = panel.querySelector("[data-editor-close]");
    if (close) {
      close.addEventListener("click", function () {
        self.closeEditor();
      });
    }
    panel.querySelectorAll("input[data-editor-field], select[data-editor-field], textarea[data-editor-field]").forEach(function (input) {
      var isImmediate = input.type === "checkbox" || input.tagName === "SELECT";
      input.addEventListener(isImmediate ? "change" : "input", function () {
        var field = input.getAttribute("data-editor-field");
        var value = input.type === "checkbox" ? input.checked : input.value;
        self.updateQuestionField(id, field, value, { deferRender: !isImmediate && field !== "id" });
      });
    });
    this.bindOptionsEditor(panel, id);
  };

  // --- tabular view ---------------------------------------------------------

  proto.tabularColumns = function () {
    var extra = [];
    var known = {};
    KNOWN_FIELDS.concat(["weight_score"]).forEach(function (field) {
      known[field] = true;
    });
    this.questions.forEach(function (question) {
      Object.keys(question).forEach(function (key) {
        if (!known[key] && extra.indexOf(key) === -1) {
          extra.push(key);
        }
      });
    });
    return {
      question: GROUP_QUESTION.slice(),
      ui: GROUP_UI.slice(),
      optional: GROUP_OPTIONAL.concat(extra)
    };
  };

  proto.editorQuestionMatchesSearch = function (question, search) {
    var needle = String(search || "").trim().toLowerCase();
    if (!needle) {
      return true;
    }
    return [question.id, question.question, question.answer].some(function (value) {
      return displayValue(value).toLowerCase().indexOf(needle) !== -1;
    });
  };

  proto.renderTabular = function () {
    var container = this.containers.editor;
    if (!container) {
      return;
    }
    var self = this;
    var groups = this.tabularColumns();
    var allColumns = groups.question.concat(groups.ui, groups.optional);
    var search = this.editorSearch || "";
    var rows = this.questions.filter(function (question) {
      return self.editorQuestionMatchesSearch(question, search);
    });

    var addButton = this.role === "editor"
      ? '<button type="button" class="q-tabular-add" data-tabular-add>➕ Add question</button>' +
        '<button type="button" class="q-tabular-sort" data-tabular-sort-category>Sort by category</button>' : "";
    var groupHeader = '<tr class="q-tabular-groups">' +
      '<th class="q-tabular-controls-head"></th>' +
      '<th class="q-tabular-group-question" colspan="' + groups.question.length + '">Question</th>' +
      '<th class="q-tabular-group-ui" colspan="' + groups.ui.length + '">UI</th>' +
      '<th class="q-tabular-group-optional" colspan="' + groups.optional.length + '">Optional</th>' +
      "</tr>";
    var columnHeader = '<tr class="q-tabular-columns"><th class="q-tabular-controls-head">Actions</th>' +
      allColumns.map(function (column) {
        var groupClass = groups.question.indexOf(column) !== -1 ? "q-tabular-group-question"
          : groups.ui.indexOf(column) !== -1 ? "q-tabular-group-ui" : "q-tabular-group-optional";
        return '<th class="' + groupClass + '">' + escapeHtml(column) + "</th>";
      }).join("") + "</tr>";

    var body = rows.map(function (question) {
      return self.renderTabularRow(question, groups, allColumns);
    }).join("");

    container.innerHTML = '<div class="q-tabular">' +
      '<div class="q-tabular-toolbar"><label class="q-editor-search"><span>🔍 Search</span>' +
      '<input type="search" data-tabular-search value="' + escapeHtml(search) +
      '" placeholder="ID, question, or answer"></label>' + addButton + "</div>" +
      '<table class="q-tabular-table"><thead>' + groupHeader + columnHeader +
      "</thead><tbody>" + body + "</tbody></table></div>";

    this.bindTabular(container);
    this.renderEditorPanel();
  };

  proto.renderTabularRow = function (question, groups, columns) {
    var self = this;
    var id = escapeHtml(question.id);
    var index = this.indexOfQuestion(question.id);
    var isEditor = this.role === "editor";
    var normalLink = '<a class="q-tabular-normalview" href="#normal-' + id + '" draggable="false" title="Normal view">⤴</a>';
    var dragHandle = isEditor ? '<span class="q-drag-handle" draggable="true" data-drag-for="' + id + '" title="Drag to reorder">⠿</span>' : "";
    var upBtn = isEditor ? '<button type="button" data-tabular-up="' + id + '"' + (index === 0 ? " disabled" : "") + ' title="Move up">↑</button>' : "";
    var downBtn = isEditor ? '<button type="button" data-tabular-down="' + id + '"' + (index === this.questions.length - 1 ? " disabled" : "") + ' title="Move down">↓</button>' : "";
    var editBtn = isEditor ? '<button type="button" data-tabular-edit="' + id + '" title="Edit">✏️</button>' : "";
    var deleteBtn = isEditor ? '<button type="button" data-tabular-delete="' + id + '" title="Delete">🗑️</button>' : "";
    var controls = '<td class="q-tabular-controls">' + dragHandle + normalLink + upBtn + downBtn + editBtn + deleteBtn + "</td>";
    var cells = columns.map(function (column) {
      var groupClass = groups.question.indexOf(column) !== -1 ? "q-tabular-group-question"
        : groups.ui.indexOf(column) !== -1 ? "q-tabular-group-ui" : "q-tabular-group-optional";
      return '<td class="' + groupClass + '">' + self.renderTabularCell(question, column) + "</td>";
    }).join("");
    return '<tr data-tabular-row="' + id + '">' + controls + cells + "</tr>";
  };

  proto.renderTabularCell = function (question, column) {
    var id = escapeHtml(question.id);
    var value = question[column];
    var editable = this.role === "editor";

    if (column === "weight_score") {
      var score = typeof value === "number" ? value : "";
      return '<span class="q-tabular-readonly">' + escapeHtml(score) + "</span>";
    }
    if (column === "options") {
      var preview = Array.isArray(value) && value.length ? value.length + " option(s)" : "";
      return '<span class="q-tabular-preview" title="Edit via the form">' + escapeHtml(preview) + "</span>";
    }
    if (!editable) {
      return '<span class="q-tabular-readonly">' + escapeHtml(displayValue(value)) + "</span>";
    }
    if (column === "type") {
      return '<select data-tabular-field="type" data-tabular-id="' + id + '">' + QUESTION_TYPES.map(function (type) {
        var selected = value === type ? " selected" : "";
        return '<option value="' + escapeHtml(type) + '"' + selected + ">" + escapeHtml(type) + "</option>";
      }).join("") + "</select>";
    }
    if (column === "review_status") {
      return '<select data-tabular-field="review_status" data-tabular-id="' + id + '">' + REVIEW_STATUSES.map(function (status) {
        var selected = value === status ? " selected" : "";
        return '<option value="' + escapeHtml(status) + '"' + selected + ">" + escapeHtml(status) + "</option>";
      }).join("") + "</select>";
    }
    if (column === "required") {
      return '<input type="checkbox" data-tabular-field="required" data-tabular-id="' + id + '"' +
        (value ? " checked" : "") + ">";
    }
    if (column === "rows" || column === "weight") {
      return '<input type="number" data-tabular-field="' + column + '" data-tabular-id="' + id +
        '" value="' + escapeHtml(displayValue(value)) + '">';
    }
    if (column === "question" || column === "help" || column === "analysis" || column === "reviewer_comment" || column === "answer" || column === "default") {
      return '<textarea data-tabular-field="' + column + '" data-tabular-id="' + id + '" rows="1">' +
        escapeHtml(displayValue(value)) + "</textarea>";
    }
    return '<input type="text" data-tabular-field="' + column + '" data-tabular-id="' + id +
      '" value="' + escapeHtml(displayValue(value)) + '">';
  };

  proto.bindTabular = function (container) {
    var self = this;
    var searchInput = container.querySelector("[data-tabular-search]");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        self.editorSearch = searchInput.value;
        self.renderTabular();
        var next = self.containers.editor.querySelector("[data-tabular-search]");
        if (next) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      });
    }
    var add = container.querySelector("[data-tabular-add]");
    if (add) {
      add.addEventListener("click", function () {
        var created = self.addQuestion({ question: "New question" });
        self.openEditor(created.id);
      });
    }
    container.querySelectorAll("[data-tabular-field]").forEach(function (input) {
      var isImmediate = input.type === "checkbox" || input.tagName === "SELECT";
      input.addEventListener(isImmediate ? "change" : "input", function () {
        var field = input.getAttribute("data-tabular-field");
        var qid = input.getAttribute("data-tabular-id");
        var value = input.type === "checkbox" ? input.checked : input.value;
        self.updateQuestionField(qid, field, value, { deferRender: !isImmediate });
      });
    });
    container.querySelectorAll("[data-tabular-up]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.swapQuestion(button.getAttribute("data-tabular-up"), -1);
      });
    });
    container.querySelectorAll("[data-tabular-down]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.swapQuestion(button.getAttribute("data-tabular-down"), 1);
      });
    });
    container.querySelectorAll("[data-tabular-edit]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.openEditor(button.getAttribute("data-tabular-edit"));
      });
    });
    container.querySelectorAll("[data-tabular-delete]").forEach(function (button) {
      button.addEventListener("click", function () {
        var qid = button.getAttribute("data-tabular-delete");
        if (typeof W.confirm !== "function" || W.confirm("Delete question " + qid + "?")) {
          self.deleteQuestion(qid);
        }
      });
    });

    var sortBtn = container.querySelector("[data-tabular-sort-category]");
    if (sortBtn) {
      sortBtn.addEventListener("click", function () {
        self.sortByCategory();
      });
    }

    // §1 — normal view links (anchor navigation)
    container.querySelectorAll(".q-tabular-normalview").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var href = link.getAttribute("href") || "";
        var qid = href.replace(/^#normal-/, "");
        self.navigateTo({ view: "normal", id: qid });
      });
    });

    // §16 — drag-and-drop reorder (editor only)
    if (self.role === "editor") {
      var tbody = container.querySelector(".q-tabular-table tbody");
      if (!tbody) { return; }
      var dragSourceId = null;
      tbody.querySelectorAll("[data-drag-for]").forEach(function (handle) {
        handle.addEventListener("dragstart", function (e) {
          dragSourceId = handle.getAttribute("data-drag-for");
          var row = handle.closest("[data-tabular-row]");
          if (row) { row.classList.add("q-drag-source"); }
          e.dataTransfer.setData("text/plain", dragSourceId);
          e.dataTransfer.effectAllowed = "move";
        });
      });
      tbody.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        var row = e.target.closest("[data-tabular-row]");
        tbody.querySelectorAll(".q-drag-over").forEach(function (el) { el.classList.remove("q-drag-over"); });
        if (row) { row.classList.add("q-drag-over"); }
      });
      tbody.addEventListener("drop", function (e) {
        e.preventDefault();
        var row = e.target.closest("[data-tabular-row]");
        var targetId = row ? row.getAttribute("data-tabular-row") : null;
        if (dragSourceId && targetId && dragSourceId !== targetId) {
          self._pendingScrollY = W.scrollY || 0;
          self.moveQuestion(dragSourceId, { before: targetId });
        }
        tbody.querySelectorAll(".q-drag-over").forEach(function (el) { el.classList.remove("q-drag-over"); });
        tbody.querySelectorAll(".q-drag-source").forEach(function (el) { el.classList.remove("q-drag-source"); });
        dragSourceId = null;
      });
      tbody.addEventListener("dragend", function () {
        tbody.querySelectorAll(".q-drag-source").forEach(function (el) { el.classList.remove("q-drag-source"); });
        tbody.querySelectorAll(".q-drag-over").forEach(function (el) { el.classList.remove("q-drag-over"); });
        dragSourceId = null;
      });
    }
  };

  // --- template view --------------------------------------------------------

  proto.getTemplateBody = function (templateId) {
    if (Object.prototype.hasOwnProperty.call(this.templateOverrides, templateId)) {
      return this.templateOverrides[templateId];
    }
    if (templateId === "onchange") {
      return this.onChangeBody || "";
    }
    if (templateId === "question_card") {
      return getTemplateHtml(this.templates.questionCard) || DEFAULT_QUESTION_CARD;
    }
    if (templateId === "reviewer_card") {
      return getTemplateHtml(this.templates.reviewerQuestionCard) || DEFAULT_REVIEWER_CARD;
    }
    if (templateId === "editor_form") {
      return getTemplateHtml(this.templates.editorForm) || "";
    }
    if (templateId === "display_card") {
      return DEFAULT_DISPLAY_CARD;
    }
    if (templateId === "display_reviewer_card") {
      return DEFAULT_DISPLAY_REVIEWER_CARD;
    }
    if (templateId === "header") {
      return getTemplateHtml(this.templates.header) || DEFAULT_HEADER;
    }
    if (templateId === "footer") {
      return getTemplateHtml(this.templates.footer) || DEFAULT_FOOTER;
    }
    if (templateId === "css") {
      return this._collectInlineCss();
    }
    if (templateId === "data") {
      return JSON.stringify(this.exportJson({ format: "full" }), null, 2);
    }
    if (templateId === "script") {
      var scriptEl = W.document && W.document.getElementById("questionnaire-v3-script");
      return scriptEl ? scriptEl.textContent : "";
    }
    return "";
  };

  proto._collectInlineCss = function () {
    var doc = W.document;
    if (!doc) { return ""; }
    var parts = [];
    Array.prototype.forEach.call(doc.querySelectorAll("style:not(#q-custom-css)"), function (s) {
      var text = s.textContent.trim();
      if (text) { parts.push(text); }
    });
    return parts.join("\n\n");
  };

  proto.setTemplateBody = function (templateId, body) {
    if (templateId === "script") {
      var scriptEl = W.document && W.document.getElementById("questionnaire-v3-script");
      if (scriptEl) { scriptEl.textContent = body; }
      this.triggerChange({ type: "template", template_id: templateId });
      return;
    }
    if (templateId === "data") {
      try {
        var parsed = JSON.parse(body);
        var list = Array.isArray(parsed) ? parsed : (parsed && parsed.questions) || [];
        if (parsed && parsed.config) {
          this.config = Object.assign({}, this.config, parsed.config);
        }
        var self = this;
        this.questions = list.map(function (raw, index) {
          return normalizeQuestion(raw, index, function (a, b) { self.warnCategoryDash(a, b); });
        });
        this.recomputeScores();
        this.triggerChange({ type: "load" });
      } catch (e) {
        if (W.console) { W.console.warn("Invalid JSON in data editor:", e.message); }
      }
      return;
    }
    if (templateId === "onchange") {
      this.onChangeBody = body;
      this.compileOnChange();
    } else {
      this.templateOverrides[templateId] = body;
    }
    if (templateId === "css") {
      this._applyCssOverride(body);
    }
    if (templateId === "header") {
      this.renderHeader();
      this.syncSelects();
    }
    if (templateId === "footer") {
      this.renderFooter();
    }
    this.triggerChange({ type: "template", template_id: templateId });
  };

  proto._applyCssOverride = function (css) {
    var doc = W.document;
    if (!doc) { return; }
    var styleId = "q-custom-css";
    var el = doc.getElementById(styleId);
    if (!el) {
      el = doc.createElement("style");
      el.id = styleId;
      doc.head.appendChild(el);
      // Disable pre-existing inline <style> blocks so the edited CSS fully replaces them.
      Array.prototype.forEach.call(doc.querySelectorAll("style:not(#" + styleId + ")"), function (s) {
        if (s.sheet) { s.sheet.disabled = true; }
      });
    }
    el.textContent = css || "";
  };

  proto.renderTemplateEditor = function () {
    var container = this.containers.editor;
    if (!container) {
      return;
    }
    var self = this;
    var tabs = TEMPLATE_IDS.map(function (templateId) {
      var current = templateId === self.selectedTemplateId ? " is-current" : "";
      var fmt = TEMPLATE_FORMAT[templateId] || "html";
      return '<button type="button" class="q-template-tab q-template-tab--' + fmt + current + '" data-template-tab="' +
        templateId + '">' + escapeHtml(TEMPLATE_LABELS[templateId] || templateId) + "</button>";
    }).join("");
    var body = this.getTemplateBody(this.selectedTemplateId);
    var warning = RELOAD_WARNING_IDS[this.selectedTemplateId]
      ? '<div class="q-template-warning">Changes take effect after saving the HTML and reloading the page.</div>'
      : "";
    container.innerHTML = '<div class="q-template-editor"><div class="q-template-tabs">' + tabs + "</div>" +
      warning +
      '<textarea class="q-template-code" data-template-code spellcheck="false">' + escapeHtml(body) + "</textarea>" +
      "</div>";

    container.querySelectorAll("[data-template-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.selectedTemplateId = button.getAttribute("data-template-tab");
        self.updateHash();
        self.renderTemplateEditor();
      });
    });
    this.setupTemplateCode(container);
  };

  proto.setupTemplateCode = function (container) {
    var self = this;
    var textarea = container.querySelector("[data-template-code]");
    if (!textarea) {
      return;
    }
    var mode = (this.selectedTemplateId === "onchange" || this.selectedTemplateId === "script") ? "javascript"
      : this.selectedTemplateId === "css" ? "css"
      : this.selectedTemplateId === "data" ? "application/json"
      : "htmlmixed";

    if (W.CodeMirror) {
      this._codeMirror = W.CodeMirror.fromTextArea(textarea, {
        mode: mode,
        lineNumbers: true,
        lineWrapping: true
      });
      var debounce = null;
      this._codeMirror.on("change", function (instance) {
        if (debounce) {
          W.clearTimeout(debounce);
        }
        debounce = W.setTimeout(function () {
          self.applyTemplateEdit(instance.getValue());
        }, 300);
      });
    } else {
      this._codeMirror = null;
      var debounceFallback = null;
      textarea.addEventListener("input", function () {
        if (debounceFallback) {
          W.clearTimeout(debounceFallback);
        }
        debounceFallback = W.setTimeout(function () {
          self.applyTemplateEdit(textarea.value);
        }, 300);
      });
    }
  };

  proto.applyTemplateEdit = function (body) {
    this.setTemplateBody(this.selectedTemplateId, body);
    // Live preview affects the rendered cards; the template view itself stays put.
  };

  // --- import / export ------------------------------------------------------

  proto.getCsvColumns = function () {
    var columns = KNOWN_FIELDS.slice();
    var seen = {};
    columns.forEach(function (column) {
      seen[column] = true;
    });
    this.questions.forEach(function (question) {
      Object.keys(question).forEach(function (key) {
        if (key !== "weight_score" && !seen[key]) {
          seen[key] = true;
          columns.push(key);
        }
      });
    });
    return columns;
  };

  proto.exportCsv = function () {
    return stringifyCsv(this.questions, this.getCsvColumns());
  };

  proto.loadCsv = function (csvText) {
    this.setQuestions(parseCsv(csvText));
  };

  proto.exportJson = function (options) {
    var format = (options && options.format) || "full";
    if (format === "flat") {
      return deepClone(this.questions);
    }
    return {
      config: deepClone(this.config),
      questions: deepClone(this.questions)
    };
  };

  proto.loadJson = function (jsonTextOrObject) {
    var data = typeof jsonTextOrObject === "string" ? JSON.parse(jsonTextOrObject) : jsonTextOrObject;
    this.setQuestions(data);
  };

  proto.collectTemplateOverrides = function () {
    var result = {};
    var self = this;
    TEMPLATE_IDS.forEach(function (templateId) {
      if (templateId === "data" || templateId === "script") { return; }
      if (Object.prototype.hasOwnProperty.call(self.templateOverrides, templateId)) {
        result[templateId] = self.templateOverrides[templateId];
      }
    });
    if (this.onChangeBody && this.onChangeBody.trim()) {
      result.onchange = this.onChangeBody;
    }
    return result;
  };

  proto.saveJsonFile = function (filename) {
    downloadText(
      filename || ((this.config.id || "questionnaire") + ".json"),
      "application/json",
      JSON.stringify(this.exportJson({ format: "full" }), null, 2)
    );
  };

  proto.saveCsvFile = function (filename) {
    downloadText(filename || ((this.config.id || "questions") + ".csv"), "text/csv", this.exportCsv());
  };

  function fetchText(url) {
    if (W.fetch) {
      return W.fetch(url).then(function (r) {
        if (!r.ok) { throw new Error(r.status); }
        return r.text();
      });
    }
    return Promise.reject(new Error("fetch unavailable"));
  }

  function xhrSyncText(url) {
    return new Promise(function (resolve, reject) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, false);
        xhr.send();
        if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
          resolve(xhr.responseText);
        } else {
          reject(new Error(xhr.status));
        }
      } catch (e) { reject(e); }
    });
  }

  function fetchOrXhr(url) {
    return fetchText(url).catch(function () { return xhrSyncText(url); });
  }

  function readStyleSheetByHref(href) {
    var sheets = W.document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      try {
        if (sheets[i].href && new URL(sheets[i].href).pathname === new URL(href, W.location.href).pathname) {
          var rules = sheets[i].cssRules || sheets[i].rules;
          if (!rules) { continue; }
          var parts = [];
          for (var j = 0; j < rules.length; j++) { parts.push(rules[j].cssText); }
          return parts.join("\n");
        }
      } catch (e) { /* cross-origin stylesheet, skip */ }
    }
    return null;
  }

  function inlineExternalResources(clone) {
    var fetches = [];
    var failures = [];

    Array.prototype.forEach.call(clone.querySelectorAll('link[rel="stylesheet"][href]'), function (link) {
      var href = link.getAttribute("href");
      if (!href) { return; }
      var url = new URL(href, W.location.href).href;
      fetches.push(
        fetchOrXhr(url).catch(function () {
          var css = readStyleSheetByHref(href);
          if (css) { return css; }
          throw new Error("all methods failed");
        }).then(function (css) {
          var style = W.document.createElement("style");
          style.textContent = "\n" + escapeScriptData(css) + "\n";
          link.parentNode.replaceChild(style, link);
        }).catch(function () {
          failures.push(href);
        })
      );
    });

    Array.prototype.forEach.call(clone.querySelectorAll("script[src]"), function (script) {
      var src = script.getAttribute("src");
      if (!src) { return; }
      var url = new URL(src, W.location.href).href;
      fetches.push(
        fetchOrXhr(url).then(function (code) {
          script.removeAttribute("src");
          script.textContent = "\n" + escapeScriptData(code) + "\n";
        }).catch(function () {
          failures.push(src);
        })
      );
    });

    return Promise.all(fetches).then(function () { return failures; });
  }

  proto.saveHtmlFile = function (filename) {
    var self = this;
    var doc = W.document;
    var clone = doc.documentElement.cloneNode(true);

    var data = clone.querySelector("#questionnaire-v3-data");
    if (!data) {
      data = doc.createElement("script");
      data.id = "questionnaire-v3-data";
      data.type = "application/json";
      clone.querySelector("body").appendChild(data);
    }
    data.textContent = "\n" + escapeScriptData(JSON.stringify(this.exportJson({ format: "full" }), null, 2)) + "\n";

    var templates = clone.querySelector("#questionnaire-v3-templates");
    if (!templates) {
      templates = doc.createElement("script");
      templates.id = "questionnaire-v3-templates";
      templates.type = "application/json";
      clone.querySelector("body").appendChild(templates);
    }
    templates.textContent = "\n" + escapeScriptData(JSON.stringify(this.collectTemplateOverrides(), null, 2)) + "\n";

    var outName = filename || ((this.config.id || "questionnaire") + ".html");

    inlineExternalResources(clone).then(function (failures) {
      if (failures.length > 0) {
        W.alert(
          "Warning: the following resources could not be inlined. " +
          "The saved file may not work standalone.\n\n" +
          failures.join("\n") +
          "\n\nTo create a fully self-contained file, serve the page via a web server (e.g. python3 -m http.server)."
        );
      }
      downloadText(
        outName,
        "text/html",
        serializeDoctype(doc.doctype) + "\n" + clone.outerHTML
      );
    });
  };

  // --- misc API -------------------------------------------------------------

  proto.getOnChangeBody = function () {
    return this.onChangeBody || "";
  };

  proto.setOnChangeBody = function (body) {
    this.onChangeBody = body || "";
    this.compileOnChange();
  };

  proto.refreshVisibility = function () {
    this.render();
  };

  proto.renderEditor = function () {
    this.render();
  };

  proto.validate = function () {
    var self = this;
    var errors = {};
    this.questions.forEach(function (question) {
      if (question.required && self.isQuestionVisible(question)) {
        var value = self.questionValue(question);
        if (value === null || typeof value === "undefined" || value === "" || value === false) {
          errors[question.id] = "This question is required.";
        }
      }
    });
    this.validationErrors = errors;
    this.render();
    return errors;
  };

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  var QuestionnaireV3 = {
    create: function (config) {
      return new QuestionnaireV3App(config || {});
    },
    parseCsv: parseCsv,
    stringifyCsv: stringifyCsv,
    normalizeQuestion: normalizeQuestion,
    ROLES: ROLES,
    VIEWS: VIEWS,
    ROLE_VIEWS: ROLE_VIEWS,
    REVIEW_STATUSES: REVIEW_STATUSES,
    QUESTION_TYPES: QUESTION_TYPES
  };

  W.QuestionnaireV3 = QuestionnaireV3;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = QuestionnaireV3;
  }
}());
