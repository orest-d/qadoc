(function () {
  "use strict";

  var REVIEW_STATUSES = ["pending", "satisfactory", "partial", "unsatisfactory"];

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value)
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

  function ensureQuestionDefaults(question) {
    if (!Object.prototype.hasOwnProperty.call(question, "prompt")) {
      question.prompt = "";
    }
    if (!Object.prototype.hasOwnProperty.call(question, "help")) {
      question.help = "";
    }
    if (!Object.prototype.hasOwnProperty.call(question, "description")) {
      question.description = "";
    }
    if (!Object.prototype.hasOwnProperty.call(question, "default")) {
      question.default = question.type === "checkbox" ? false : "";
    }
    if (!Object.prototype.hasOwnProperty.call(question, "allow_freetext")) {
      question.allow_freetext = false;
    }
    if (!Object.prototype.hasOwnProperty.call(question, "reviewer_question")) {
      question.reviewer_question = false;
    }
    if (!Object.prototype.hasOwnProperty.call(question, "answer")) {
      question.answer = null;
    }
    if (!Object.prototype.hasOwnProperty.call(question, "review_status")) {
      question.review_status = "pending";
    }
    if (!Object.prototype.hasOwnProperty.call(question, "review_status_by_rule")) {
      question.review_status_by_rule = false;
    }
    if (!Object.prototype.hasOwnProperty.call(question, "reviewer_comment")) {
      question.reviewer_comment = "";
    }
  }

  function getQuestionBaseValue(question) {
    if (question.answer === null || typeof question.answer === "undefined" || question.answer === "") {
      return question.default;
    }
    if (question.allow_freetext && question.answer && typeof question.answer === "object" && Object.prototype.hasOwnProperty.call(question.answer, "value")) {
      return question.answer.value;
    }
    return question.answer;
  }

  function getQuestionFreeText(question) {
    if (question.allow_freetext && question.answer && typeof question.answer === "object") {
      return question.answer.freetext || "";
    }
    return "";
  }

  function getTextareaRows(question) {
    var rows = parseInt(question.textarea_rows, 10);
    if (isNaN(rows)) {
      return 4;
    }
    return Math.max(1, Math.min(rows, 30));
  }

  function renderFreeTextControl(question, label, value, disabled) {
    var questionId = escapeHtml(question.id);
    if (question.multiline) {
      return '<label class="q-subfield"><span>' + escapeHtml(label) + '</span><textarea data-action="freetext" data-question-id="' + questionId + '" rows="' + getTextareaRows(question) + '"' + disabled + ">" + escapeHtml(value) + "</textarea></label>";
    }
    return '<label class="q-subfield"><span>' + escapeHtml(label) + '</span><input type="text" data-action="freetext" data-question-id="' + questionId + '" value="' + escapeHtml(value) + '"' + disabled + "></label>";
  }

  function setQuestionAnswer(question, value, freetext) {
    if (question.allow_freetext && (question.type === "checkbox" || question.type === "radio" || question.type === "dropdown")) {
      question.answer = {
        value: value,
        freetext: freetext || ""
      };
      return;
    }
    question.answer = value;
  }

  function questionHasMeaningfulValue(question) {
    var value = getQuestionBaseValue(question);
    if (question.type === "checkbox") {
      return value === true || value === false;
    }
    if (question.type === "text" || question.type === "editable_predefined_text") {
      return String(value || "").trim().length > 0;
    }
    if (question.type === "radio" || question.type === "dropdown") {
      return String(value || "").trim().length > 0;
    }
    return value !== null && typeof value !== "undefined";
  }

  function getSelectedOptionNeedsFreeText(question, value) {
    if (!Array.isArray(question.options)) {
      return false;
    }
    for (var i = 0; i < question.options.length; i += 1) {
      if (question.options[i].value === value) {
        return !!question.options[i].isOther;
      }
    }
    return false;
  }

  function questionHasReviewRule(question) {
    return Object.prototype.hasOwnProperty.call(question, "rule_on_value") && REVIEW_STATUSES.indexOf(question.rule_status) !== -1;
  }

  function valuesMatch(left, right) {
    return left === right;
  }

  function applyReviewRule(question) {
    var previousStatus = question.review_status;
    var previousByRule = !!question.review_status_by_rule;
    if (!questionHasReviewRule(question)) {
      question.review_status_by_rule = false;
      return previousStatus !== question.review_status || previousByRule !== !!question.review_status_by_rule;
    }
    var matches = valuesMatch(getQuestionBaseValue(question), question.rule_on_value);
    if (question.review_status_by_rule && !matches) {
      question.review_status = "pending";
      question.review_status_by_rule = false;
      return previousStatus !== question.review_status || previousByRule !== !!question.review_status_by_rule;
    }
    if (matches && (question.review_status === "pending" || question.review_status_by_rule) && question.rule_status !== "pending") {
      question.review_status = question.rule_status;
      question.review_status_by_rule = true;
      return previousStatus !== question.review_status || previousByRule !== !!question.review_status_by_rule;
    }
    question.review_status_by_rule = false;
    return previousStatus !== question.review_status || previousByRule !== !!question.review_status_by_rule;
  }

  function evaluateCondition(condition, questionsById) {
    if (!condition) {
      return true;
    }
    if (Array.isArray(condition.all)) {
      return condition.all.every(function (item) {
        return evaluateCondition(item, questionsById);
      });
    }
    if (Array.isArray(condition.any)) {
      return condition.any.some(function (item) {
        return evaluateCondition(item, questionsById);
      });
    }
    var question = questionsById[condition.questionId];
    if (!question) {
      return false;
    }
    var value = getQuestionBaseValue(question);
    if (Object.prototype.hasOwnProperty.call(condition, "equals")) {
      return value === condition.equals;
    }
    if (Object.prototype.hasOwnProperty.call(condition, "notEquals")) {
      return value !== condition.notEquals;
    }
    if (Object.prototype.hasOwnProperty.call(condition, "contains")) {
      return String(value || "").indexOf(String(condition.contains)) !== -1;
    }
    return false;
  }

  function QuestionnaireApp(config) {
    this.container = config.container;
    this.role = config.role || "interviewed";
    this.spec = deepClone(config.spec);
    this.currentPageIndex = 0;
    this.validationErrors = {};
    this.flashMessage = "";
    this.flashMessageType = "";
    this.questionsById = {};
    this.initialize();
  }

  QuestionnaireApp.prototype.initialize = function () {
    this.validateAndNormalize(this.spec);
    this.rebuildQuestionIndex();
    this.applyReviewRules();
    this.render();
  };

  QuestionnaireApp.prototype.rebuildQuestionIndex = function () {
    this.questionsById = {};
    var pages = this.spec.pages || [];
    for (var i = 0; i < pages.length; i += 1) {
      var questions = pages[i].questions || [];
      for (var j = 0; j < questions.length; j += 1) {
        this.questionsById[questions[j].id] = questions[j];
      }
    }
  };

  QuestionnaireApp.prototype.applyReviewRules = function () {
    var pages = this.spec.pages || [];
    for (var i = 0; i < pages.length; i += 1) {
      var questions = pages[i].questions || [];
      for (var j = 0; j < questions.length; j += 1) {
        applyReviewRule(questions[j]);
      }
    }
  };

  QuestionnaireApp.prototype.validateAndNormalize = function (spec) {
    if (!spec || typeof spec !== "object") {
      throw new Error("Questionnaire spec must be an object.");
    }
    if (!Object.prototype.hasOwnProperty.call(spec, "id")) {
      spec.id = "";
    }
    if (!Object.prototype.hasOwnProperty.call(spec, "title")) {
      spec.title = "";
    }
    if (!Object.prototype.hasOwnProperty.call(spec, "version")) {
      spec.version = "";
    }
    if (!Array.isArray(spec.pages)) {
      throw new Error("Questionnaire spec must contain a pages array.");
    }
    var seenIds = {};
    var generatedQuestionCounter = 0;
    for (var i = 0; i < spec.pages.length; i += 1) {
      var page = spec.pages[i];
      if (!Object.prototype.hasOwnProperty.call(page, "id")) {
        page.id = "page-" + (i + 1);
      }
      if (!Object.prototype.hasOwnProperty.call(page, "title")) {
        page.title = "";
      }
      if (!Object.prototype.hasOwnProperty.call(page, "description")) {
        page.description = "";
      }
      if (!Array.isArray(page.questions)) {
        page.questions = [];
      }
      for (var j = 0; j < page.questions.length; j += 1) {
        var question = page.questions[j];
        if (!question.id) {
          generatedQuestionCounter += 1;
          question.id = "Q" + generatedQuestionCounter;
        }
        if (seenIds[question.id]) {
          throw new Error("Duplicate question id: " + question.id);
        }
        seenIds[question.id] = true;
        if (["radio", "dropdown"].indexOf(question.type) !== -1 && !Array.isArray(question.options)) {
          throw new Error("Question " + question.id + " must define options.");
        }
        if (question.type === "editable_predefined_text" && !Object.prototype.hasOwnProperty.call(question, "predefinedText")) {
          question.predefinedText = question.default || "";
        }
        ensureQuestionDefaults(question);
        if (REVIEW_STATUSES.indexOf(question.review_status) === -1) {
          question.review_status = "pending";
          question.review_status_by_rule = false;
        }
        if (question.review_status_by_rule && !questionHasReviewRule(question)) {
          question.review_status_by_rule = false;
        }
      }
    }
    for (var pageIndex = 0; pageIndex < spec.pages.length; pageIndex += 1) {
      var questions = spec.pages[pageIndex].questions || [];
      for (var questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
        this.validateConditionReferences(questions[questionIndex].visibleIf, seenIds, questions[questionIndex].id);
      }
    }
  };

  QuestionnaireApp.prototype.validateConditionReferences = function (condition, seenIds, currentId) {
    if (!condition) {
      return;
    }
    if (Array.isArray(condition.all)) {
      for (var i = 0; i < condition.all.length; i += 1) {
        this.validateConditionReferences(condition.all[i], seenIds, currentId);
      }
      return;
    }
    if (Array.isArray(condition.any)) {
      for (var j = 0; j < condition.any.length; j += 1) {
        this.validateConditionReferences(condition.any[j], seenIds, currentId);
      }
      return;
    }
    if (condition.questionId && !seenIds[condition.questionId]) {
      throw new Error("Question " + currentId + " references missing question id " + condition.questionId + ".");
    }
  };

  QuestionnaireApp.prototype.isQuestionVisible = function (question) {
    if (question.reviewer_question && this.role !== "reviewer") {
      return false;
    }
    return evaluateCondition(question.visibleIf, this.questionsById);
  };

  QuestionnaireApp.prototype.getCurrentPage = function () {
    return this.spec.pages[this.currentPageIndex] || { questions: [] };
  };

  QuestionnaireApp.prototype.collectPageValidationErrors = function (pageIndex) {
    var errors = {};
    var page = this.spec.pages[pageIndex];
    if (!page) {
      return errors;
    }
    var questions = page.questions || [];
    for (var i = 0; i < questions.length; i += 1) {
      var question = questions[i];
      if (!this.isQuestionVisible(question)) {
        continue;
      }
      if (question.required && !questionHasMeaningfulValue(question)) {
        errors[question.id] = "This question is required.";
      } else if (question.allow_freetext && (question.type === "radio" || question.type === "dropdown")) {
        var baseValue = getQuestionBaseValue(question);
        var freeText = getQuestionFreeText(question);
        if (getSelectedOptionNeedsFreeText(question, baseValue) && !String(freeText).trim()) {
          errors[question.id] = "Please provide additional details.";
        }
      }
    }
    return errors;
  };

  QuestionnaireApp.prototype.setRole = function (role) {
    this.role = role;
    this.render();
  };

  QuestionnaireApp.prototype.setFlashMessage = function (message, type) {
    this.flashMessage = message || "";
    this.flashMessageType = type || "";
  };

  QuestionnaireApp.prototype.handleQuestionInput = function (questionId, payload) {
    var question = this.questionsById[questionId];
    if (!question) {
      return;
    }
    if (question.type === "checkbox") {
      setQuestionAnswer(question, !!payload.value, payload.freetext || "");
    } else if (question.type === "radio" || question.type === "dropdown") {
      setQuestionAnswer(question, payload.value, payload.freetext || "");
    } else {
      question.answer = payload.value;
    }
    applyReviewRule(question);
    delete this.validationErrors[questionId];
    this.render();
  };

  QuestionnaireApp.prototype.handleReviewInput = function (questionId, field, value) {
    var question = this.questionsById[questionId];
    if (!question) {
      return;
    }
    question[field] = value;
    if (field === "review_status") {
      question.review_status_by_rule = false;
      this.render();
    }
  };

  QuestionnaireApp.prototype.handleLiveTextInput = function (questionId, payload) {
    var question = this.questionsById[questionId];
    if (!question) {
      return;
    }
    if (payload.kind === "freetext") {
      setQuestionAnswer(question, getQuestionBaseValue(question), payload.value);
    } else if (payload.kind === "reviewer_comment") {
      question.reviewer_comment = payload.value;
    } else {
      question.answer = payload.value;
    }
    var ruleChanged = applyReviewRule(question);
    if (ruleChanged && payload.kind !== "reviewer_comment") {
      this.render();
    }
  };

  QuestionnaireApp.prototype.nextPage = function () {
    this.validationErrors = this.collectPageValidationErrors(this.currentPageIndex);
    if (Object.keys(this.validationErrors).length > 0) {
      this.render();
      return;
    }
    if (this.currentPageIndex < this.spec.pages.length - 1) {
      this.currentPageIndex += 1;
      this.render();
    }
  };

  QuestionnaireApp.prototype.previousPage = function () {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex -= 1;
      this.render();
    }
  };

  QuestionnaireApp.prototype.downloadState = function () {
    var json = JSON.stringify(this.spec, null, 2);
    downloadText((this.spec.id || "questionnaire") + ".json", "application/json", json);
    this.setFlashMessage("Questionnaire saved as JSON.", "success");
    this.render();
  };

  QuestionnaireApp.prototype.downloadHtml = function () {
    var clone = document.documentElement.cloneNode(true);
    var dataElement = clone.querySelector("#questionnaire-data");
    if (!dataElement) {
      this.setFlashMessage("Unable to save HTML: questionnaire data block was not found.", "error");
      this.render();
      return;
    }
    dataElement.textContent = "\n" + escapeScriptData(JSON.stringify(this.spec, null, 2)) + "\n    ";
    var html = serializeDoctype(document.doctype) + "\n" + clone.outerHTML;
    downloadText((this.spec.id || "questionnaire") + ".html", "text/html", html);
    this.setFlashMessage("Questionnaire saved as HTML.", "success");
    this.render();
  };

  QuestionnaireApp.prototype.loadStateFromText = function (text) {
    try {
      var loaded = JSON.parse(text);
      this.validateAndNormalize(loaded);
      this.spec = loaded;
      this.currentPageIndex = 0;
      this.validationErrors = {};
      this.rebuildQuestionIndex();
      this.applyReviewRules();
      this.setFlashMessage("Questionnaire JSON loaded successfully.", "success");
      this.render();
    } catch (error) {
      this.setFlashMessage("Unable to load JSON: " + error.message, "error");
      this.render();
    }
  };

  QuestionnaireApp.prototype.renderFlashMessage = function () {
    if (!this.flashMessage) {
      return "";
    }
    return '<div class="q-flash q-flash-' + escapeHtml(this.flashMessageType || "info") + '">' + escapeHtml(this.flashMessage) + "</div>";
  };

  QuestionnaireApp.prototype.renderQuestion = function (question) {
    var visible = this.isQuestionVisible(question);
    if (!visible) {
      return "";
    }
    var isReviewer = this.role === "reviewer";
    var answerDisabled = isReviewer && !question.reviewer_question ? " disabled" : "";
    var value = getQuestionBaseValue(question);
    var freeText = getQuestionFreeText(question);
    var requiredBadge = question.required ? '<span class="q-required">Required</span>' : "";
    var help = question.help ? '<p class="q-help">' + escapeHtml(question.help) + "</p>" : "";
    var error = this.validationErrors[question.id] ? '<p class="q-error">' + escapeHtml(this.validationErrors[question.id]) + "</p>" : "";
    var answerMarkup = "";

    if (question.type === "checkbox") {
      var checked = value === true ? " checked" : "";
      answerMarkup += '<label class="q-choice"><input type="checkbox" data-action="answer" data-question-id="' + escapeHtml(question.id) + '"' + checked + answerDisabled + '> <span>' + escapeHtml(question.prompt) + "</span></label>";
      if (question.allow_freetext && value !== true) {
        answerMarkup += renderFreeTextControl(question, "Explanation", freeText, answerDisabled);
      }
    } else if (question.type === "radio") {
      answerMarkup += '<fieldset class="q-fieldset"><legend class="sr-only">' + escapeHtml(question.prompt) + "</legend>";
      question.options.forEach(function (option) {
        var optionChecked = value === option.value ? " checked" : "";
        answerMarkup += '<label class="q-choice"><input type="radio" name="' + escapeHtml(question.id) + '" data-action="answer" data-question-id="' + escapeHtml(question.id) + '" value="' + escapeHtml(option.value) + '"' + optionChecked + answerDisabled + '> <span>' + escapeHtml(option.label) + "</span></label>";
      });
      answerMarkup += "</fieldset>";
      if (question.allow_freetext && getSelectedOptionNeedsFreeText(question, value)) {
        answerMarkup += renderFreeTextControl(question, "Other details", freeText, answerDisabled);
      }
    } else if (question.type === "dropdown") {
      answerMarkup += '<label class="q-subfield"><span class="sr-only">' + escapeHtml(question.prompt) + '</span><select data-action="answer" data-question-id="' + escapeHtml(question.id) + '"' + answerDisabled + ">";
      answerMarkup += '<option value="">Select an option</option>';
      question.options.forEach(function (option) {
        var selected = value === option.value ? " selected" : "";
        answerMarkup += '<option value="' + escapeHtml(option.value) + '"' + selected + ">" + escapeHtml(option.label) + "</option>";
      });
      answerMarkup += "</select></label>";
      if (question.allow_freetext && getSelectedOptionNeedsFreeText(question, value)) {
        answerMarkup += renderFreeTextControl(question, "Other details", freeText, answerDisabled);
      }
    } else if (question.type === "text" || question.type === "editable_predefined_text") {
      var textValue = value || "";
      if (question.multiline || question.type === "editable_predefined_text") {
        answerMarkup += '<label class="q-subfield"><span class="sr-only">' + escapeHtml(question.prompt) + '</span><textarea data-action="answer" data-question-id="' + escapeHtml(question.id) + '" rows="' + getTextareaRows(question) + '"' + answerDisabled + ">" + escapeHtml(textValue) + "</textarea></label>";
      } else {
        answerMarkup += '<label class="q-subfield"><span class="sr-only">' + escapeHtml(question.prompt) + '</span><input type="text" data-action="answer" data-question-id="' + escapeHtml(question.id) + '" value="' + escapeHtml(textValue) + '"' + answerDisabled + "></label>";
      }
      if (question.type === "editable_predefined_text" && question.predefinedText) {
        answerMarkup += '<p class="q-help">Default text: ' + escapeHtml(question.predefinedText) + "</p>";
      }
    } else {
      answerMarkup += '<p class="q-error">Unsupported question type: ' + escapeHtml(question.type) + "</p>";
    }
    var cardClass = "q-card" + (question.reviewer_question ? " is-reviewer-question" : "");

    return [
      '<section class="' + cardClass + '" data-question="' + escapeHtml(question.id) + '">',
      '<div class="q-card-head">',
      '<h3 class="q-prompt">' + escapeHtml(question.prompt) + "</h3>",
      requiredBadge,
      "</div>",
      help,
      '<div class="q-answer-block">' + answerMarkup + "</div>",
      error,
      this.renderReviewControls(question),
      "</section>"
    ].join("");
  };

  QuestionnaireApp.prototype.renderReviewControls = function (question) {
    if (this.role !== "reviewer") {
      return "";
    }
    var disabled = this.role === "reviewer" ? "" : " disabled";
    var statusClass = "q-review-status q-review-status-" + escapeHtml(question.review_status || "pending");
    var panelClass = "q-review-panel" + (question.review_status_by_rule ? " is-rule-applied" : "");
    var options = REVIEW_STATUSES.map(function (status) {
      var selected = question.review_status === status ? " selected" : "";
      return '<option value="' + escapeHtml(status) + '"' + selected + ">" + escapeHtml(status) + "</option>";
    }).join("");
    return [
      '<div class="' + panelClass + '">',
      '<label class="q-review-field"><span>Review status</span><select class="' + statusClass + '" data-action="review-status" data-question-id="' + escapeHtml(question.id) + '"' + disabled + ">" + options + "</select></label>",
      '<label class="q-review-field"><span>Reviewer comment</span><textarea data-action="review-comment" data-question-id="' + escapeHtml(question.id) + '"' + disabled + ">" + escapeHtml(question.reviewer_comment || "") + "</textarea></label>",
      "</div>"
    ].join("");
  };

  QuestionnaireApp.prototype.renderPageTabs = function () {
    var self = this;
    return (this.spec.pages || []).map(function (page, index) {
      var current = index === self.currentPageIndex ? " is-current" : "";
      return '<button type="button" class="q-page-tab' + current + '" data-action="go-page" data-page-index="' + index + '">' + escapeHtml((index + 1) + ". " + page.title) + "</button>";
    }).join("");
  };

  QuestionnaireApp.prototype.render = function () {
    var page = this.getCurrentPage();
    var questionsMarkup = (page.questions || []).map(this.renderQuestion.bind(this)).join("");
    var description = page.description ? '<p class="q-page-description">' + escapeHtml(page.description) + "</p>" : "";
    this.container.innerHTML = [
      '<div class="q-shell">',
      '<header class="q-header">',
      '<div>',
      '<p class="q-kicker">Questionnaire</p>',
      '<h1>' + escapeHtml(this.spec.title || "Untitled Questionnaire") + "</h1>",
      '<p class="q-subtitle">Version ' + escapeHtml(this.spec.version || "1.0") + "</p>",
      "</div>",
      '<div class="q-toolbar">',
      '<label><span>Role</span><select data-action="role-switch"><option value="interviewed"' + (this.role === "interviewed" ? " selected" : "") + '>Interviewed</option><option value="reviewer"' + (this.role === "reviewer" ? " selected" : "") + ">Reviewer</option></select></label>",
      '<div class="q-toolbar-actions">',
      '<button type="button" class="q-toolbar-action" data-action="save">Save JSON</button>',
      '<button type="button" class="q-toolbar-action" data-action="save-html">Save HTML</button>',
      '<label class="q-toolbar-action q-load-button"><span>Load JSON</span><input type="file" accept="application/json,.json" data-action="load-file"></label>',
      "</div>",
      "</div>",
      "</header>",
      this.renderFlashMessage(),
      '<nav class="q-page-nav">' + this.renderPageTabs() + "</nav>",
      '<main class="q-main">',
      '<section class="q-page-intro">',
      '<div>',
      '<p class="q-page-count">Page ' + (this.currentPageIndex + 1) + " of " + this.spec.pages.length + "</p>",
      '<h2>' + escapeHtml(page.title || "Untitled Page") + "</h2>",
      description,
      "</div>",
      "</section>",
      '<section class="q-questions">' + questionsMarkup + "</section>",
      "</main>",
      '<footer class="q-footer">',
      '<button type="button" data-action="prev"' + (this.currentPageIndex === 0 ? " disabled" : "") + ">Previous</button>",
      '<button type="button" data-action="next">' + (this.currentPageIndex === this.spec.pages.length - 1 ? "Finish" : "Next") + "</button>",
      "</footer>",
      "</div>"
    ].join("");
    this.bindEvents();
  };

  QuestionnaireApp.prototype.bindEvents = function () {
    var self = this;
    this.container.querySelectorAll("[data-action]").forEach(function (element) {
      var action = element.getAttribute("data-action");
      if (action === "answer") {
        element.addEventListener("change", function (event) {
          var questionId = event.target.getAttribute("data-question-id");
          var question = self.questionsById[questionId];
          var payload = { value: event.target.value };
          if (question.type === "checkbox") {
            payload.value = event.target.checked;
            payload.freetext = getQuestionFreeText(question);
          } else if (question.type === "radio" || question.type === "dropdown") {
            payload.freetext = getQuestionFreeText(question);
          }
          self.handleQuestionInput(questionId, payload);
        });
        if (element.tagName === "TEXTAREA" || (element.tagName === "INPUT" && element.type === "text")) {
          element.addEventListener("input", function (event) {
            self.handleLiveTextInput(event.target.getAttribute("data-question-id"), {
              kind: "answer",
              value: event.target.value
            });
          });
        }
      } else if (action === "freetext") {
        element.addEventListener("input", function (event) {
          self.handleLiveTextInput(event.target.getAttribute("data-question-id"), {
            kind: "freetext",
            value: event.target.value
          });
        });
      } else if (action === "review-status") {
        element.addEventListener("change", function (event) {
          self.handleReviewInput(event.target.getAttribute("data-question-id"), "review_status", event.target.value);
        });
      } else if (action === "review-comment") {
        element.addEventListener("input", function (event) {
          self.handleLiveTextInput(event.target.getAttribute("data-question-id"), {
            kind: "reviewer_comment",
            value: event.target.value
          });
        });
      } else if (action === "prev") {
        element.addEventListener("click", function () {
          self.previousPage();
        });
      } else if (action === "next") {
        element.addEventListener("click", function () {
          self.nextPage();
        });
      } else if (action === "save") {
        element.addEventListener("click", function () {
          self.downloadState();
        });
      } else if (action === "save-html") {
        element.addEventListener("click", function () {
          self.downloadHtml();
        });
      } else if (action === "load-file") {
        element.addEventListener("change", function (event) {
          var file = event.target.files && event.target.files[0];
          if (!file) {
            return;
          }
          var reader = new FileReader();
          reader.onerror = function () {
            self.setFlashMessage("Unable to read the selected file.", "error");
            self.render();
          };
          reader.onload = function (loadEvent) {
            self.loadStateFromText(loadEvent.target.result);
          };
          reader.readAsText(file);
          event.target.value = "";
        });
      } else if (action === "role-switch") {
        element.addEventListener("change", function (event) {
          self.setRole(event.target.value);
        });
      } else if (action === "go-page") {
        element.addEventListener("click", function (event) {
          self.currentPageIndex = Number(event.target.getAttribute("data-page-index"));
          self.render();
        });
      }
    });
  };

  window.QuestionnaireRenderer = {
    render: function (config) {
      if (!config || !config.container || !config.spec) {
        throw new Error("render() requires container and spec.");
      }
      return new QuestionnaireApp(config);
    }
  };
}());
