(function () {
  "use strict";

  var REVIEW_STATUSES = ["pending", "satisfactory", "partial", "unsatisfactory"];
  var QUESTION_TYPES = ["checkbox", "radio", "dropdown", "text", "info", "html"];

  var DEFAULT_QUESTION_FIELDS = [
    { name: "id", label: "Question ID", ui: "text", required: true, section: "identity" },
    { name: "page_id", label: "Page", ui: "page_select", default: "default", section: "identity" },
    { name: "order", label: "Order", ui: "number", section: "identity" },
    { name: "type", label: "Type", ui: "select", section: "identity", options: QUESTION_TYPES },
    { name: "prompt", label: "Prompt", ui: "textarea", section: "content" },
    { name: "help", label: "Help", ui: "textarea", section: "content" },
    { name: "required", label: "Required", ui: "checkbox", default: false, section: "behavior" },
    { name: "default", label: "Default value", ui: "text", section: "behavior" },
    { name: "allow_freetext", label: "Allow free text", ui: "checkbox", default: false, section: "behavior" },
    { name: "reviewer_question", label: "Reviewer question", ui: "checkbox", default: false, section: "behavior" },
    { name: "has_status", label: "Has review status", ui: "checkbox", default: true, section: "behavior" },
    { name: "multiline", label: "Multiline", ui: "checkbox", default: false, section: "behavior" },
    { name: "textarea_rows", label: "Textarea rows", ui: "number", default: 4, min: 1, section: "behavior" },
    { name: "options", label: "Options JSON", ui: "json_textarea", section: "behavior" },
    { name: "visible_if_question_id", label: "Visible if question", ui: "question_select", section: "rules" },
    { name: "visible_if_operator", label: "Visible if operator", ui: "select", section: "rules", options: ["", "equals", "not_equals", "contains"] },
    { name: "visible_if_value", label: "Visible if value", ui: "text", section: "rules" },
    { name: "visible_if", label: "Complex visibility JSON", ui: "json_textarea", section: "rules" },
    { name: "rule_on_value", label: "Rule on value", ui: "text", section: "rules" },
    { name: "rule_status", label: "Rule status", ui: "select", section: "rules", options: ["", "pending", "satisfactory", "partial", "unsatisfactory"] },
    { name: "answer", label: "Answer", ui: "textarea", section: "state" },
    { name: "review_status", label: "Review status", ui: "select", section: "state", options: REVIEW_STATUSES },
    { name: "review_status_by_rule", label: "Review status by rule", ui: "readonly_checkbox", section: "state" },
    { name: "reviewer_comment", label: "Reviewer comment", ui: "textarea", section: "state" }
  ];

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

  function downloadText(filename, mimeType, text) {
    var link = document.createElement("a");
    var objectUrl = null;
    if (window.Blob && window.URL && window.URL.createObjectURL) {
      objectUrl = window.URL.createObjectURL(new Blob([text], { type: mimeType + ";charset=utf-8" }));
      link.href = objectUrl;
    } else {
      link.href = "data:" + mimeType + ";charset=utf-8," + encodeURIComponent(text);
    }
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (objectUrl) {
      window.setTimeout(function () {
        window.URL.revokeObjectURL(objectUrl);
      }, 0);
    }
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
    if (["1", "true", "t", "yes", "y"].indexOf(lowered) !== -1) {
      return true;
    }
    if (["0", "false", "f", "no", "n"].indexOf(lowered) !== -1) {
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
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  function sameValue(left, right) {
    return left === right || String(left) === String(right);
  }

  function getTemplateHtml(template) {
    if (!template) {
      return "";
    }
    if (typeof template === "string") {
      return template;
    }
    if (template.innerHTML) {
      return template.innerHTML;
    }
    return "";
  }

  function renderMustache(template, data) {
    return template
      .replace(/\{\{#([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, function (_, key, content) {
        return data[key] ? renderMustache(content, data) : "";
      })
      .replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, function (_, key) {
        return escapeHtml(data[key]);
      });
  }

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

  function normalizeQuestion(raw, index) {
    var aliases = {
      predefinedText: "predefined_text",
      visibleIf: "visible_if"
    };
    var optionAliases = { isOther: "is_other" };
    var conditionAliases = { questionId: "question_id", notEquals: "not_equals" };
    var question = {};
    Object.keys(raw || {}).forEach(function (key) {
      var normalizedKey = aliases[key] || key;
      question[normalizedKey] = raw[key];
    });
    question.id = question.id || "Q" + (index + 1);
    question.page_id = question.page_id || "default";
    question.order = Number(question.order || index + 1);
    question.type = question.type === "editable_predefined_text" ? "text" : (question.type || "text");
    question.prompt = question.prompt || "";
    question.help = question.help || "";
    question.required = parseBoolean(question.required, false);
    question.allow_freetext = parseBoolean(question.allow_freetext, false);
    question.reviewer_question = parseBoolean(question.reviewer_question, false);
    question.has_status = parseBoolean(question.has_status, true);
    question.multiline = parseBoolean(question.multiline, false);
    question.textarea_rows = Math.max(1, Number(question.textarea_rows || 4));
    question.options = normalizeKeys(parseJsonField(question.options, []), optionAliases);
    question.visible_if = normalizeKeys(parseJsonField(question.visible_if, question.visible_if || null), conditionAliases);
    question.visible_if_value = parseScalar(question.visible_if_value);
    question.rule_on_value = parseScalar(question.rule_on_value);
    question.default = parseScalar(question.default);
    question.answer = parseJsonField(question.answer, question.answer === "" ? null : parseScalar(question.answer));
    question.review_status = question.review_status || "pending";
    question.review_status_by_rule = parseBoolean(question.review_status_by_rule, false);
    question.reviewer_comment = question.reviewer_comment || "";
    return question;
  }

  function normalizePages(pages, questions) {
    var result = (pages || []).map(function (page, index) {
      return {
        id: page.id || "default",
        title: page.title || page.id || "Default",
        description: page.description || "",
        order: Number(page.order || index)
      };
    });
    var pageIds = {};
    result.forEach(function (page) {
      pageIds[page.id] = true;
    });
    questions.forEach(function (question) {
      if (!question.page_id) {
        question.page_id = "default";
      }
      if (!pageIds[question.page_id]) {
        pageIds[question.page_id] = true;
        result.push({
          id: question.page_id,
          title: question.page_id,
          description: "",
          order: result.length
        });
      }
    });
    if (!result.length) {
      result.push({ id: "default", title: "Default", description: "", order: 0 });
    }
    return result.sort(function (a, b) {
      return Number(a.order || 0) - Number(b.order || 0);
    });
  }

  function QuestionnaireV2App(config) {
    this.config = deepClone(config.config || {});
    this.mode = config.mode || "interviewed";
    this.modeLabels = Object.assign({ interviewed: "Interviewed", reviewer: "Reviewer", editor: "Editor" }, config.modeLabels || {});
    this.questionFields = deepClone(config.questionFields || DEFAULT_QUESTION_FIELDS);
    this.templates = config.templates || {};
    this.containers = config.containers || {};
    this.onChange = typeof config.onChange === "function" ? config.onChange : null;
    this.validationErrors = {};
    this.currentPageId = "";
    this.editorAdvanced = {};
    this.editorSearch = "";
    this.questions = [];
    this.pages = [];
    this.loadData({ config: this.config, pages: config.pages || [], questions: config.questions || [] }, { silent: true });
    this.bindModeSelect();
    this.render();
  }

  QuestionnaireV2App.prototype.api = function () {
    return this;
  };

  QuestionnaireV2App.prototype.loadData = function (data, options) {
    if (data.config) {
      this.config = Object.assign({}, this.config, data.config);
    }
    var questions = data.questions || (Array.isArray(data) ? data : []);
    if (!questions.length && Array.isArray(data.pages)) {
      questions = [];
      data.pages.forEach(function (page) {
        (page.questions || []).forEach(function (question) {
          var copy = Object.assign({}, question);
          copy.page_id = page.id || "default";
          questions.push(copy);
        });
      });
    }
    this.questions = questions.map(normalizeQuestion);
    this.pages = normalizePages(data.pages || this.pages, this.questions);
    this.currentPageId = this.currentPageId || (this.pages[0] && this.pages[0].id) || "default";
    this.applyReviewRules();
    if (!options || !options.silent) {
      this.triggerChange({ type: "load" }, options);
      this.render();
    }
  };

  QuestionnaireV2App.prototype.bindModeSelect = function () {
    var select = document.getElementById("mode-select");
    if (!select) {
      return;
    }
    select.innerHTML = Object.keys(this.modeLabels).map(function (mode) {
      return '<option value="' + escapeHtml(mode) + '">' + escapeHtml(this.modeLabels[mode]) + "</option>";
    }, this).join("");
    select.value = this.mode;
  };

  QuestionnaireV2App.prototype.triggerChange = function (event, options) {
    if (options && options.silent) {
      return;
    }
    if (this.onChange) {
      this.onChange(Object.assign({ mode: this.mode }, event), this.api());
    }
  };

  QuestionnaireV2App.prototype.getMode = function () {
    return this.mode;
  };

  QuestionnaireV2App.prototype.setMode = function (mode) {
    this.mode = mode;
    this.bindModeSelect();
    this.triggerChange({ type: "mode", value: mode });
    this.render();
  };

  QuestionnaireV2App.prototype.getModeLabels = function () {
    return Object.assign({}, this.modeLabels);
  };

  QuestionnaireV2App.prototype.setModeLabels = function (labels) {
    this.modeLabels = Object.assign({}, this.modeLabels, labels || {});
    this.bindModeSelect();
    this.render();
  };

  QuestionnaireV2App.prototype.getPages = function () {
    return deepClone(this.pages);
  };

  QuestionnaireV2App.prototype.setPages = function (pages) {
    this.pages = normalizePages(pages || [], this.questions);
    this.currentPageId = (this.pages[0] && this.pages[0].id) || "default";
    this.render();
  };

  QuestionnaireV2App.prototype.getCurrentPage = function () {
    var id = this.currentPageId;
    var pages = this.visiblePages();
    return pages.filter(function (page) {
      return page.id === id;
    })[0] || pages[0] || this.pages[0];
  };

  QuestionnaireV2App.prototype.visiblePages = function () {
    var self = this;
    return this.pages.filter(function (page) {
      return self.questions.some(function (question) {
        return question.page_id === page.id && self.isQuestionVisible(question);
      });
    });
  };

  QuestionnaireV2App.prototype.setPage = function (pageId) {
    this.currentPageId = pageId;
    this.render();
  };

  QuestionnaireV2App.prototype.nextPage = function () {
    var pages = this.visiblePages();
    var index = pages.indexOf(this.getCurrentPage());
    if (index < pages.length - 1) {
      this.currentPageId = pages[index + 1].id;
      this.render();
    }
  };

  QuestionnaireV2App.prototype.previousPage = function () {
    var pages = this.visiblePages();
    var index = pages.indexOf(this.getCurrentPage());
    if (index > 0) {
      this.currentPageId = pages[index - 1].id;
      this.render();
    }
  };

  QuestionnaireV2App.prototype.getQuestions = function () {
    return deepClone(this.questions);
  };

  QuestionnaireV2App.prototype.setQuestions = function (questions) {
    this.questions = (questions || []).map(normalizeQuestion);
    this.pages = normalizePages(this.pages, this.questions);
    this.render();
  };

  QuestionnaireV2App.prototype.getQuestion = function (id) {
    return this.questions.filter(function (question) {
      return question.id === id;
    })[0] || null;
  };

  QuestionnaireV2App.prototype.updateQuestion = function (id, patch) {
    var question = this.getQuestion(id);
    if (!question) {
      return;
    }
    Object.assign(question, patch || {});
    this.pages = normalizePages(this.pages, this.questions);
    this.triggerChange({ type: "question", question_id: id, value: patch });
    this.render();
  };

  QuestionnaireV2App.prototype.updateQuestionField = function (id, field, value, options) {
    var question = this.getQuestion(id);
    if (!question) {
      return;
    }
    question[field] = value;
    if (field === "page_id") {
      this.pages = normalizePages(this.pages, this.questions);
    }
    this.triggerChange({ type: "question", question_id: id, field: field, value: value }, options);
    if ((!options || !options.silent) && !(options && options.deferRender)) {
      this.render();
    }
  };

  QuestionnaireV2App.prototype.addQuestion = function (question) {
    this.questions.push(normalizeQuestion(question || {}, this.questions.length));
    this.pages = normalizePages(this.pages, this.questions);
    this.render();
  };

  QuestionnaireV2App.prototype.deleteQuestion = function (id) {
    this.questions = this.questions.filter(function (question) {
      return question.id !== id;
    });
    this.render();
  };

  QuestionnaireV2App.prototype.moveQuestion = function (id, placement) {
    this.updateQuestion(id, placement || {});
  };

  QuestionnaireV2App.prototype.getAnswer = function (id) {
    var question = this.getQuestion(id);
    return question ? question.answer : undefined;
  };

  QuestionnaireV2App.prototype.getFreeText = function (question) {
    return question && question.answer && typeof question.answer === "object" && !Array.isArray(question.answer) ? question.answer.freetext || "" : "";
  };

  QuestionnaireV2App.prototype.setAnswer = function (id, value, options) {
    var question = this.getQuestion(id);
    if (!question) {
      return;
    }
    var previous = question.answer;
    if (question.allow_freetext && ["checkbox", "radio", "dropdown"].indexOf(question.type) !== -1) {
      question.answer = { value: value, freetext: this.getFreeText(question) };
    } else {
      question.answer = value;
    }
    var previousStatus = question.review_status;
    var previousByRule = question.review_status_by_rule;
    this.applyReviewRule(question);
    this.triggerChange({ type: "answer", question_id: id, previous_value: previous, value: value }, options);
    if ((!options || !options.silent) && (previousStatus !== question.review_status || previousByRule !== question.review_status_by_rule || !(options && options.deferRender))) {
      this.render();
    }
  };

  QuestionnaireV2App.prototype.getAnswers = function () {
    var answers = {};
    this.questions.forEach(function (question) {
      answers[question.id] = question.answer;
    });
    return answers;
  };

  QuestionnaireV2App.prototype.setAnswers = function (answers) {
    var self = this;
    Object.keys(answers || {}).forEach(function (id) {
      self.setAnswer(id, answers[id], { silent: true });
    });
    this.triggerChange({ type: "answers" });
    this.render();
  };

  QuestionnaireV2App.prototype.getReviewStatus = function (id) {
    var question = this.getQuestion(id);
    return question && question.has_status ? question.review_status : null;
  };

  QuestionnaireV2App.prototype.setReviewStatus = function (id, status, options) {
    var question = this.getQuestion(id);
    if (!question || !question.has_status) {
      return;
    }
    question.review_status = status;
    question.review_status_by_rule = !!(options && options.byRule);
    this.triggerChange({ type: "review_status", question_id: id, value: status }, options);
    if (!options || !options.silent) {
      this.render();
    }
  };

  QuestionnaireV2App.prototype.getReviewerComment = function (id) {
    var question = this.getQuestion(id);
    return question ? question.reviewer_comment : "";
  };

  QuestionnaireV2App.prototype.setReviewerComment = function (id, value, options) {
    var question = this.getQuestion(id);
    if (!question) {
      return;
    }
    question.reviewer_comment = value;
    this.triggerChange({ type: "reviewer_comment", question_id: id, value: value }, options);
    if (!options || !options.silent) {
      this.render();
    }
  };

  QuestionnaireV2App.prototype.questionValue = function (question) {
    if (question.answer === null || typeof question.answer === "undefined" || question.answer === "") {
      return question.default;
    }
    if (question.allow_freetext && question.answer && typeof question.answer === "object" && Object.prototype.hasOwnProperty.call(question.answer, "value")) {
      return question.answer.value;
    }
    return question.answer;
  };

  QuestionnaireV2App.prototype.isQuestionVisible = function (question) {
    if (question.reviewer_question && this.mode === "interviewed") {
      return false;
    }
    var flatId = question.visible_if_question_id;
    if (flatId) {
      var referenced = this.getQuestion(flatId);
      var value = referenced ? this.questionValue(referenced) : "";
      var expected = question.visible_if_value;
      if (question.visible_if_operator === "not_equals") {
        return !sameValue(value, expected);
      }
      if (question.visible_if_operator === "contains") {
        return String(value || "").indexOf(String(expected || "")) !== -1;
      }
      return sameValue(value, expected);
    }
    return this.evaluateCondition(question.visible_if);
  };

  QuestionnaireV2App.prototype.evaluateCondition = function (condition) {
    var self = this;
    if (!condition) {
      return true;
    }
    if (Array.isArray(condition.all)) {
      return condition.all.every(function (item) {
        return self.evaluateCondition(item);
      });
    }
    if (Array.isArray(condition.any)) {
      return condition.any.some(function (item) {
        return self.evaluateCondition(item);
      });
    }
    var question = this.getQuestion(condition.question_id);
    var value = question ? this.questionValue(question) : "";
    if (Object.prototype.hasOwnProperty.call(condition, "equals")) {
      return sameValue(value, condition.equals);
    }
    if (Object.prototype.hasOwnProperty.call(condition, "not_equals")) {
      return !sameValue(value, condition.not_equals);
    }
    if (Object.prototype.hasOwnProperty.call(condition, "contains")) {
      return String(value || "").indexOf(String(condition.contains || "")) !== -1;
    }
    return true;
  };

  QuestionnaireV2App.prototype.applyReviewRule = function (question) {
    if (!question.has_status || !question.rule_status || !REVIEW_STATUSES.includes(question.rule_status)) {
      question.review_status_by_rule = false;
      return;
    }
    if (sameValue(this.questionValue(question), question.rule_on_value) && (question.review_status === "pending" || question.review_status_by_rule)) {
      question.review_status = question.rule_status;
      question.review_status_by_rule = true;
    } else if (question.review_status_by_rule) {
      question.review_status = "pending";
      question.review_status_by_rule = false;
    }
  };

  QuestionnaireV2App.prototype.applyReviewRules = function () {
    var self = this;
    this.questions.forEach(function (question) {
      self.applyReviewRule(question);
    });
  };

  QuestionnaireV2App.prototype.render = function () {
    this.applyReviewRules();
    this.renderPageNav();
    this.updatePageButtons();
    if (this.mode === "editor") {
      this.renderEditor();
      if (this.containers.questions) {
        this.containers.questions.innerHTML = "";
      }
    } else {
      if (this.containers.editor) {
        this.containers.editor.innerHTML = "";
      }
      this.renderQuestions();
    }
  };

  QuestionnaireV2App.prototype.updatePageButtons = function () {
    var pages = this.visiblePages();
    var index = pages.indexOf(this.getCurrentPage());
    var previous = document.getElementById("prev-page");
    var next = document.getElementById("next-page");
    if (previous) {
      previous.disabled = index <= 0;
      previous.hidden = pages.length <= 1;
    }
    if (next) {
      next.disabled = index < 0 || index >= pages.length - 1;
      next.hidden = pages.length <= 1;
    }
  };

  QuestionnaireV2App.prototype.renderPageNav = function () {
    var container = this.containers.pageNav;
    if (!container) {
      return;
    }
    var pages = this.visiblePages();
    if (pages.length <= 1) {
      container.innerHTML = "";
      container.hidden = true;
      return;
    }
    if (pages.indexOf(this.getCurrentPage()) === -1) {
      this.currentPageId = pages[0].id;
    }
    container.hidden = false;
    var self = this;
    container.innerHTML = pages.map(function (page) {
      var current = page.id === self.currentPageId ? " is-current" : "";
      return '<button type="button" class="q-page-tab' + current + '" data-page-id="' + escapeHtml(page.id) + '">' + escapeHtml(page.title || page.id) + "</button>";
    }).join("");
    container.querySelectorAll("[data-page-id]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.setPage(button.getAttribute("data-page-id"));
      });
    });
  };

  QuestionnaireV2App.prototype.currentQuestions = function () {
    var page = this.getCurrentPage();
    if (!page) {
      return [];
    }
    return this.questions.filter(function (question) {
      return question.page_id === page.id;
    }).sort(function (a, b) {
      return Number(a.order || 0) - Number(b.order || 0);
    });
  };

  QuestionnaireV2App.prototype.renderQuestions = function () {
    var container = this.containers.questions;
    if (!container) {
      return;
    }
    var self = this;
    container.innerHTML = this.currentQuestions().filter(function (question) {
      return self.isQuestionVisible(question);
    }).map(function (question) {
      return self.renderQuestion(question);
    }).join("");
    this.bindQuestionControls(container);
  };

  QuestionnaireV2App.prototype.renderQuestion = function (question) {
    var template = this.mode === "reviewer" ? getTemplateHtml(this.templates.reviewerQuestionCard) : "";
    template = template || getTemplateHtml(this.templates.questionCard) || '<section class="q-card {{#reviewer_question}}is-reviewer-question{{/reviewer_question}}"><div class="q-card-head"><h3 class="q-prompt">{{prompt}}</h3></div><div data-question-control></div>{{#has_status}}<div data-review-control></div>{{/has_status}}</section>';
    var wrapper = document.createElement("div");
    wrapper.innerHTML = renderMustache(template, question).trim();
    var node = wrapper.firstElementChild;
    var control = node.querySelector("[data-question-control]");
    var review = node.querySelector("[data-review-control]");
    if (control) {
      control.innerHTML = this.renderQuestionControl(question);
    }
    if (review) {
      review.innerHTML = this.renderReviewControl(question);
    }
    return node.outerHTML;
  };

  QuestionnaireV2App.prototype.renderQuestionControl = function (question) {
    var value = this.questionValue(question);
    var disabled = this.mode === "reviewer" && !question.reviewer_question ? " disabled" : "";
    if (question.type === "info") {
      return '<pre class="q-info">' + escapeHtml(value || "") + "</pre>";
    }
    if (question.type === "html") {
      return '<div class="q-html">' + String(value || "") + "</div>";
    }
    if (question.type === "checkbox") {
      var checked = value === true ? " checked" : "";
      var label = question.checkbox_label || (question.options[0] && question.options[0].label) || "";
      var checkboxMarkup = '<label class="q-choice"><input type="checkbox" data-v2-answer="' + escapeHtml(question.id) + '"' + checked + disabled + '><span>' + escapeHtml(label) + "</span></label>";
      if (question.allow_freetext && value !== true) {
        checkboxMarkup += this.renderFreeTextControl(question, "Explanation", disabled);
      }
      return checkboxMarkup;
    }
    if (question.type === "radio") {
      var radioMarkup = '<fieldset class="q-fieldset">' + question.options.map(function (option) {
        var checked = sameValue(value, option.value) ? " checked" : "";
        return '<label class="q-choice"><input type="radio" name="' + escapeHtml(question.id) + '" data-v2-answer="' + escapeHtml(question.id) + '" value="' + escapeHtml(optionValueToString(option.value)) + '"' + checked + disabled + '><span>' + escapeHtml(option.label || option.value) + "</span></label>";
      }).join("") + "</fieldset>";
      if (question.allow_freetext && this.selectedOptionNeedsFreeText(question, value)) {
        radioMarkup += this.renderFreeTextControl(question, "Other details", disabled);
      }
      return radioMarkup;
    }
    if (question.type === "dropdown") {
      var dropdownMarkup = '<label class="q-subfield"><span class="sr-only">' + escapeHtml(question.prompt) + '</span><select data-v2-answer="' + escapeHtml(question.id) + '"' + disabled + '><option value=""></option>' + question.options.map(function (option) {
        var selected = sameValue(value, option.value) ? " selected" : "";
        return '<option value="' + escapeHtml(optionValueToString(option.value)) + '"' + selected + ">" + escapeHtml(option.label || option.value) + "</option>";
      }).join("") + "</select></label>";
      if (question.allow_freetext && this.selectedOptionNeedsFreeText(question, value)) {
        dropdownMarkup += this.renderFreeTextControl(question, "Other details", disabled);
      }
      return dropdownMarkup;
    }
    if (question.multiline) {
      return '<label class="q-subfield"><span class="sr-only">' + escapeHtml(question.prompt) + '</span><textarea data-v2-answer="' + escapeHtml(question.id) + '" rows="' + Number(question.textarea_rows || 4) + '"' + disabled + ">" + escapeHtml(value || "") + "</textarea></label>";
    }
    return '<label class="q-subfield"><span class="sr-only">' + escapeHtml(question.prompt) + '</span><input type="text" data-v2-answer="' + escapeHtml(question.id) + '" value="' + escapeHtml(value || "") + '"' + disabled + "></label>";
  };

  QuestionnaireV2App.prototype.selectedOptionNeedsFreeText = function (question, value) {
    return (question.options || []).some(function (option) {
      return sameValue(option.value, value) && !!option.is_other;
    });
  };

  QuestionnaireV2App.prototype.renderFreeTextControl = function (question, label, disabled) {
    var value = this.getFreeText(question);
    if (question.multiline) {
      return '<label class="q-subfield"><span>' + escapeHtml(label) + '</span><textarea data-v2-freetext="' + escapeHtml(question.id) + '" rows="' + Number(question.textarea_rows || 4) + '"' + disabled + ">" + escapeHtml(value) + "</textarea></label>";
    }
    return '<label class="q-subfield"><span>' + escapeHtml(label) + '</span><input type="text" data-v2-freetext="' + escapeHtml(question.id) + '" value="' + escapeHtml(value) + '"' + disabled + "></label>";
  };

  QuestionnaireV2App.prototype.renderReviewControl = function (question) {
    if (this.mode !== "reviewer" || !question.has_status) {
      return "";
    }
    var statusClass = "q-review-status q-review-status-" + escapeHtml(question.review_status || "pending");
    var panelClass = "q-review-panel" + (question.review_status_by_rule ? " is-rule-applied" : "");
    return '<div class="' + panelClass + '"><label class="q-review-field"><span>Review status</span><select class="' + statusClass + '" data-v2-review-status="' + escapeHtml(question.id) + '">' + REVIEW_STATUSES.map(function (status) {
      var selected = question.review_status === status ? " selected" : "";
      return '<option value="' + escapeHtml(status) + '"' + selected + ">" + escapeHtml(status) + "</option>";
    }).join("") + '</select></label><label class="q-review-field"><span>Reviewer comment</span><textarea data-v2-review-comment="' + escapeHtml(question.id) + '">' + escapeHtml(question.reviewer_comment || "") + "</textarea></label></div>";
  };

  QuestionnaireV2App.prototype.bindQuestionControls = function (container) {
    var self = this;
    container.querySelectorAll("[data-v2-answer]").forEach(function (element) {
      var id = element.getAttribute("data-v2-answer");
      var handler = function (event) {
        var question = self.getQuestion(id);
        var value = event.target.type === "checkbox" ? event.target.checked : parseScalar(event.target.value);
        self.setAnswer(id, value, { deferRender: element.tagName === "TEXTAREA" || element.type === "text" });
        if (question && (question.type === "radio" || question.type === "dropdown" || question.type === "checkbox")) {
          self.render();
        }
      };
      element.addEventListener(element.tagName === "TEXTAREA" || element.type === "text" ? "input" : "change", handler);
    });
    container.querySelectorAll("[data-v2-review-status]").forEach(function (element) {
      element.addEventListener("change", function () {
        self.setReviewStatus(element.getAttribute("data-v2-review-status"), element.value);
      });
    });
    container.querySelectorAll("[data-v2-freetext]").forEach(function (element) {
      element.addEventListener("input", function () {
        var id = element.getAttribute("data-v2-freetext");
        var question = self.getQuestion(id);
        if (!question) {
          return;
        }
        question.answer = {
          value: self.questionValue(question),
          freetext: element.value
        };
        self.triggerChange({ type: "freetext", question_id: id, value: element.value });
      });
    });
    container.querySelectorAll("[data-v2-review-comment]").forEach(function (element) {
      element.addEventListener("input", function () {
        self.setReviewerComment(element.getAttribute("data-v2-review-comment"), element.value, { silent: true });
      });
    });
  };

  QuestionnaireV2App.prototype.renderEditor = function () {
    var container = this.containers.editor;
    if (!container) {
      return;
    }
    var self = this;
    var search = this.editorSearch || "";
    var visibleQuestions = this.questions.filter(function (question) {
      return self.editorQuestionMatchesSearch(question, search);
    });
    container.innerHTML = '<div class="q-editor-toolbar"><label class="q-editor-search"><span>Search</span><input type="search" data-v2-editor-search value="' + escapeHtml(search) + '" placeholder="Prompt, ID, or answer"></label><button type="button" data-v2-add-question>Add question</button></div>' + visibleQuestions.map(function (question) {
      var index = self.questions.indexOf(question);
      return self.renderEditorQuestion(question, index);
    }).join("");
    var searchInput = container.querySelector("[data-v2-editor-search]");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        self.editorSearch = searchInput.value;
        self.renderEditor();
        var nextInput = self.containers.editor && self.containers.editor.querySelector("[data-v2-editor-search]");
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
        }
      });
    }
    container.querySelector("[data-v2-add-question]").addEventListener("click", function () {
      self.addQuestion({ page_id: self.currentPageId || "default", order: self.questions.length + 1, type: "text", prompt: "New question" });
    });
    this.bindEditorControls(container);
  };

  QuestionnaireV2App.prototype.editorQuestionMatchesSearch = function (question, search) {
    var needle = String(search || "").trim().toLowerCase();
    if (!needle) {
      return true;
    }
    return [question.id, question.prompt, question.answer].some(function (value) {
      return displayValue(value).toLowerCase().indexOf(needle) !== -1;
    });
  };

  QuestionnaireV2App.prototype.renderEditorQuestion = function (question, index) {
    var template = getTemplateHtml(this.templates.editorForm);
    var advancedEnabled = !!this.editorAdvanced[question.id];
    var checked = advancedEnabled ? " checked" : "";
    var formMarkup = this.renderEditorForm(question, template, advancedEnabled);
    return '<section class="q-card q-editor-card" data-v2-editor-question="' + escapeHtml(question.id) + '"><div class="q-card-head"><h3 class="q-prompt">' + escapeHtml(question.id) + '</h3><div class="q-editor-actions"><button type="button" data-v2-move-up="' + escapeHtml(question.id) + '"' + (index === 0 ? " disabled" : "") + '>Up</button><button type="button" data-v2-move-down="' + escapeHtml(question.id) + '"' + (index === this.questions.length - 1 ? " disabled" : "") + '>Down</button><button type="button" data-v2-delete-question="' + escapeHtml(question.id) + '">Delete</button></div></div><label class="q-editor-advanced-toggle"><input type="checkbox" data-v2-advanced-settings="' + escapeHtml(question.id) + '"' + checked + '> Advanced settings</label>' + formMarkup + "</section>";
  };

  QuestionnaireV2App.prototype.renderEditorForm = function (question, template, advancedEnabled) {
    var self = this;
    var fieldMap = {};
    this.questionFields.forEach(function (field) {
      fieldMap[field.name] = field;
    });
    if (!template) {
      return '<div class="q-editor-grid">' + this.questionFields.map(function (field) {
        return self.renderEditorField(question, field);
      }).join("") + "</div>";
    }
    var wrapper = document.createElement("div");
    wrapper.innerHTML = renderMustache(template, question).trim();
    var form = wrapper.firstElementChild;
    if (!form) {
      return "";
    }
    form.querySelectorAll("[data-editor-field]").forEach(function (slot) {
      var name = slot.getAttribute("data-editor-field");
      var field = fieldMap[name] || { name: name, label: name, ui: "text" };
      slot.classList.add("q-editor-slot");
      if (field.ui === "textarea" || field.ui === "json_textarea" || field.ui === "options_table") {
        slot.classList.add("is-wide");
      }
      slot.innerHTML = self.renderEditorField(question, field);
    });
    form.querySelectorAll(".is-essential").forEach(function (section) {
      section.hidden = false;
    });
    form.querySelectorAll(".is-advanced").forEach(function (section) {
      section.hidden = !advancedEnabled;
    });
    return form.outerHTML;
  };

  QuestionnaireV2App.prototype.renderEditorField = function (question, field) {
    var value = question[field.name];
    var id = question.id + "-" + field.name;
    var input = "";
    if (field.ui === "checkbox" || field.ui === "readonly_checkbox") {
      input = '<input id="' + escapeHtml(id) + '" type="checkbox" data-v2-editor-field="' + escapeHtml(field.name) + '"' + (value ? " checked" : "") + (field.ui === "readonly_checkbox" ? " disabled" : "") + ">";
    } else if (field.ui === "textarea" || field.ui === "json_textarea") {
      var text = field.ui === "json_textarea" && (Array.isArray(value) || (value && typeof value === "object")) ? JSON.stringify(value, null, 2) : (value || "");
      var rows = field.rows || (field.name === "prompt" || field.name === "help" ? 2 : 6);
      input = '<textarea id="' + escapeHtml(id) + '" data-v2-editor-field="' + escapeHtml(field.name) + '" rows="' + rows + '">' + escapeHtml(text) + "</textarea>";
    } else if (field.ui === "options_table") {
      input = this.renderOptionsEditor(question);
    } else if (field.ui === "select") {
      input = '<select id="' + escapeHtml(id) + '" data-v2-editor-field="' + escapeHtml(field.name) + '">' + (field.options || []).map(function (option) {
        var selected = String(value || "") === String(option) ? " selected" : "";
        return '<option value="' + escapeHtml(option) + '"' + selected + ">" + escapeHtml(option || "(none)") + "</option>";
      }).join("") + "</select>";
    } else if (field.ui === "page_select") {
      input = '<select id="' + escapeHtml(id) + '" data-v2-editor-field="' + escapeHtml(field.name) + '">' + this.pages.map(function (page) {
        var selected = question.page_id === page.id ? " selected" : "";
        return '<option value="' + escapeHtml(page.id) + '"' + selected + ">" + escapeHtml(page.title || page.id) + "</option>";
      }).join("") + "</select>";
    } else if (field.ui === "question_select") {
      input = '<select id="' + escapeHtml(id) + '" data-v2-editor-field="' + escapeHtml(field.name) + '"><option value=""></option>' + this.questions.map(function (item) {
        var selected = value === item.id ? " selected" : "";
        return '<option value="' + escapeHtml(item.id) + '"' + selected + ">" + escapeHtml(item.id) + "</option>";
      }).join("") + "</select>";
    } else {
      input = '<input id="' + escapeHtml(id) + '" type="' + (field.ui === "number" ? "number" : "text") + '" data-v2-editor-field="' + escapeHtml(field.name) + '" value="' + escapeHtml(displayValue(value)) + '">';
    }
    var classes = ["q-editor-field", "q-editor-field-" + (field.ui || "text")];
    if (field.ui === "textarea" || field.ui === "json_textarea") {
      classes.push("is-wide");
    }
    if (field.ui === "options_table") {
      classes.push("is-wide");
      return '<div class="' + classes.join(" ") + '"><span>' + escapeHtml(field.label || field.name) + "</span>" + input + "</div>";
    }
    return '<label class="' + classes.join(" ") + '"><span>' + escapeHtml(field.label || field.name) + "</span>" + input + "</label>";
  };

  QuestionnaireV2App.prototype.renderOptionsEditor = function (question) {
    var rows = (question.options || []).map(function (option, index) {
      return '<tr data-v2-option-index="' + index + '"><td><input type="text" data-v2-option-field="value" value="' + escapeHtml(optionValueToString(option.value)) + '"></td><td><input type="text" data-v2-option-field="label" value="' + escapeHtml(option.label || "") + '"></td><td class="q-option-other"><input type="checkbox" data-v2-option-field="is_other"' + (option.is_other ? " checked" : "") + '></td><td class="q-option-actions"><button type="button" data-v2-option-up>Up</button><button type="button" data-v2-option-down>Down</button><button type="button" data-v2-option-delete>Delete</button></td></tr>';
    }).join("");
    return '<div class="q-options-editor"><table><thead><tr><th>Value</th><th>Label</th><th>Other</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table><button type="button" data-v2-option-add>Add option</button></div>';
  };

  QuestionnaireV2App.prototype.bindEditorControls = function (container) {
    var self = this;
    container.querySelectorAll("[data-v2-editor-question]").forEach(function (card) {
      var id = card.getAttribute("data-v2-editor-question");
      var advanced = card.querySelector("[data-v2-advanced-settings]");
      if (advanced) {
        advanced.addEventListener("change", function () {
          self.editorAdvanced[id] = advanced.checked;
          self.render();
        });
      }
      card.querySelectorAll("[data-v2-editor-field]").forEach(function (input) {
        input.addEventListener(input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input", function () {
          var field = input.getAttribute("data-v2-editor-field");
          var value = input.type === "checkbox" ? input.checked : input.value;
          if (field === "options" || field === "visible_if") {
            value = parseJsonField(value, value);
          } else {
            value = parseScalar(value);
          }
          self.updateQuestionField(id, field, value, { deferRender: input.tagName === "TEXTAREA" || input.type === "text" });
        });
      });
      self.bindOptionsEditor(card, id);
    });
    container.querySelectorAll("[data-v2-delete-question]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.deleteQuestion(button.getAttribute("data-v2-delete-question"));
      });
    });
    container.querySelectorAll("[data-v2-move-up]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.swapQuestion(button.getAttribute("data-v2-move-up"), -1);
      });
    });
    container.querySelectorAll("[data-v2-move-down]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.swapQuestion(button.getAttribute("data-v2-move-down"), 1);
      });
    });
  };

  QuestionnaireV2App.prototype.bindOptionsEditor = function (card, id) {
    var self = this;
    var question = this.getQuestion(id);
    if (!question) {
      return;
    }
    function saveOptions(renderAfter) {
      var options = [];
      card.querySelectorAll("[data-v2-option-index]").forEach(function (row) {
        options.push({
          value: parseScalar(row.querySelector('[data-v2-option-field="value"]').value),
          label: row.querySelector('[data-v2-option-field="label"]').value,
          is_other: row.querySelector('[data-v2-option-field="is_other"]').checked
        });
      });
      question.options = options;
      self.triggerChange({ type: "question", question_id: id, field: "options", value: options });
      if (renderAfter) {
        self.render();
      }
    }
    card.querySelectorAll("[data-v2-option-field]").forEach(function (input) {
      input.addEventListener(input.type === "checkbox" ? "change" : "input", function () {
        saveOptions(false);
      });
    });
    card.querySelectorAll("[data-v2-option-up]").forEach(function (button) {
      button.addEventListener("click", function () {
        var row = button.closest("[data-v2-option-index]");
        var previous = row && row.previousElementSibling;
        if (previous) {
          row.parentNode.insertBefore(row, previous);
          saveOptions(true);
        }
      });
    });
    card.querySelectorAll("[data-v2-option-down]").forEach(function (button) {
      button.addEventListener("click", function () {
        var row = button.closest("[data-v2-option-index]");
        var next = row && row.nextElementSibling;
        if (next) {
          row.parentNode.insertBefore(next, row);
          saveOptions(true);
        }
      });
    });
    card.querySelectorAll("[data-v2-option-delete]").forEach(function (button) {
      button.addEventListener("click", function () {
        var row = button.closest("[data-v2-option-index]");
        if (row) {
          row.remove();
          saveOptions(true);
        }
      });
    });
    var add = card.querySelector("[data-v2-option-add]");
    if (add) {
      add.addEventListener("click", function () {
        question.options = question.options || [];
        question.options.push({ value: "", label: "", is_other: false });
        self.render();
      });
    }
  };

  QuestionnaireV2App.prototype.swapQuestion = function (id, direction) {
    var index = this.questions.findIndex(function (question) {
      return question.id === id;
    });
    var next = index + direction;
    if (index < 0 || next < 0 || next >= this.questions.length) {
      return;
    }
    var tmp = this.questions[index];
    this.questions[index] = this.questions[next];
    this.questions[next] = tmp;
    this.questions.forEach(function (question, itemIndex) {
      question.order = itemIndex + 1;
    });
    this.render();
  };

  QuestionnaireV2App.prototype.getCsvColumns = function () {
    var columns = this.questionFields.map(function (field) {
      return field.name;
    });
    this.questions.forEach(function (question) {
      Object.keys(question).forEach(function (key) {
        if (columns.indexOf(key) === -1) {
          columns.push(key);
        }
      });
    });
    return columns;
  };

  QuestionnaireV2App.prototype.exportCsv = function () {
    return stringifyCsv(this.questions, this.getCsvColumns());
  };

  QuestionnaireV2App.prototype.loadCsv = function (csvText) {
    this.loadData({ questions: parseCsv(csvText), pages: this.pages });
  };

  QuestionnaireV2App.prototype.exportJson = function (options) {
    var format = options && options.format || "full";
    if (format === "flat") {
      return deepClone(this.questions);
    }
    if (format === "v1-nested") {
      var self = this;
      return {
        id: this.config.id || "",
        title: this.config.title || "",
        version: this.config.version || "",
        pages: this.pages.map(function (page) {
          return {
            id: page.id,
            title: page.title,
            description: page.description,
            questions: self.questions.filter(function (question) {
              return question.page_id === page.id;
            })
          };
        })
      };
    }
    return {
      config: deepClone(this.config),
      pages: deepClone(this.pages),
      questions: deepClone(this.questions)
    };
  };

  QuestionnaireV2App.prototype.loadJson = function (jsonTextOrObject) {
    var data = typeof jsonTextOrObject === "string" ? JSON.parse(jsonTextOrObject) : jsonTextOrObject;
    this.loadData(data);
  };

  QuestionnaireV2App.prototype.saveJsonFile = function (filename) {
    downloadText(filename || ((this.config.id || "questionnaire") + ".json"), "application/json", JSON.stringify(this.exportJson({ format: "full" }), null, 2));
  };

  QuestionnaireV2App.prototype.saveCsvFile = function (filename) {
    downloadText(filename || ((this.config.id || "questions") + ".csv"), "text/csv", this.exportCsv());
  };

  QuestionnaireV2App.prototype.saveHtmlFile = function (filename) {
    var clone = document.documentElement.cloneNode(true);
    var data = clone.querySelector("#questionnaire-v2-data");
    if (!data) {
      data = document.createElement("script");
      data.id = "questionnaire-v2-data";
      data.type = "application/json";
      clone.querySelector("body").appendChild(data);
    }
    data.textContent = "\n" + escapeScriptData(JSON.stringify(this.exportJson({ format: "full" }), null, 2)) + "\n";
    downloadText(filename || ((this.config.id || "questionnaire") + ".html"), "text/html", serializeDoctype(document.doctype) + "\n" + clone.outerHTML);
  };

  QuestionnaireV2App.prototype.refreshVisibility = function () {
    this.render();
  };

  QuestionnaireV2App.prototype.validate = function () {
    var self = this;
    var errors = {};
    this.questions.forEach(function (question) {
      if (question.required && self.isQuestionVisible(question) && !self.questionValue(question)) {
        errors[question.id] = "This question is required.";
      }
    });
    this.validationErrors = errors;
    return errors;
  };

  window.QuestionnaireV2 = {
    create: function (config) {
      return new QuestionnaireV2App(config || {});
    },
    parseCsv: parseCsv,
    stringifyCsv: stringifyCsv
  };
}());
