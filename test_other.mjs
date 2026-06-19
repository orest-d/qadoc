import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/orest/.nvm/versions/node/v16.20.2/lib/node_modules/playwright");

const BASE = "http://localhost:8765/example-questionnaire-v3.html";
let passed = 0, failed = 0;

function check(desc, actual, expected) {
  const ok = actual === expected;
  console.log((ok ? "PASS" : "FAIL") + ": " + desc +
    (ok ? "" : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`));
  if (ok) passed++; else failed++;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(BASE);
  await page.waitForSelector("#role-select");
  await page.waitForTimeout(500);

  // === RADIO with is_other ===
  console.log("\n--- Radio with is_other ---");
  // q_project_role has options: lead, contributor, advisor, other(is_other)
  const radioCard = '[data-question-id="q_project_role"]';

  // Select "Other"
  await page.click(radioCard + ' input[data-other][data-is-other="1"]');
  await page.waitForTimeout(500);

  let answer = await page.evaluate(() => window.questionnaireV3App.getAnswer("q_project_role"));
  check("Radio: selecting Other sets answer to 'other'", answer, "other");

  let otherTextVisible = await page.$eval(radioCard + ' .q-other-text', el => !el.hidden);
  check("Radio: Other text field visible", otherTextVisible, true);

  // Type custom text
  await page.fill(radioCard + ' [data-other-text]', 'Manager');
  await page.waitForTimeout(500);
  answer = await page.evaluate(() => window.questionnaireV3App.getAnswer("q_project_role"));
  check("Radio: typing in Other sets answer to custom text", answer, "Manager");

  // Now select "Contributor" — should deselect Other
  await page.click(radioCard + ' input[data-other][value="contributor"]');
  await page.waitForTimeout(500);
  answer = await page.evaluate(() => window.questionnaireV3App.getAnswer("q_project_role"));
  check("Radio: selecting Contributor sets answer to 'contributor'", answer, "contributor");

  let checkedValue = await page.$eval(radioCard + ' input[data-other]:checked', el => el.value);
  check("Radio: Contributor radio is checked", checkedValue, "contributor");

  otherTextVisible = await page.$eval(radioCard + ' .q-other-text', el => !el.hidden);
  check("Radio: Other text field hidden after selecting known option", otherTextVisible, false);

  // Select "Other" again, then select "Project Lead"
  await page.click(radioCard + ' input[data-other][data-is-other="1"]');
  await page.waitForTimeout(500);
  await page.click(radioCard + ' input[data-other][value="lead"]');
  await page.waitForTimeout(500);
  answer = await page.evaluate(() => window.questionnaireV3App.getAnswer("q_project_role"));
  check("Radio: selecting Lead after Other sets answer to 'lead'", answer, "lead");
  checkedValue = await page.$eval(radioCard + ' input[data-other]:checked', el => el.value);
  check("Radio: Lead radio is checked", checkedValue, "lead");

  // === DROPDOWN with is_other ===
  console.log("\n--- Dropdown with is_other ---");
  const dropCard = '[data-question-id="q_employment"]';

  // Select "other"
  await page.selectOption(dropCard + ' select[data-other]', 'other');
  await page.waitForTimeout(500);
  answer = await page.evaluate(() => window.questionnaireV3App.getAnswer("q_employment"));
  check("Dropdown: selecting Other sets answer to 'other'", answer, "other");

  otherTextVisible = await page.$eval(dropCard + ' .q-other-text', el => !el.hidden);
  check("Dropdown: Other text field visible", otherTextVisible, true);

  // Type custom text
  await page.fill(dropCard + ' [data-other-text]', 'Retired');
  await page.waitForTimeout(500);
  answer = await page.evaluate(() => window.questionnaireV3App.getAnswer("q_employment"));
  check("Dropdown: typing in Other sets answer to custom text", answer, "Retired");

  // Select "employed" — should deselect Other
  await page.selectOption(dropCard + ' select[data-other]', 'employed');
  await page.waitForTimeout(500);
  answer = await page.evaluate(() => window.questionnaireV3App.getAnswer("q_employment"));
  check("Dropdown: selecting Employed sets answer to 'employed'", answer, "employed");

  let selectedValue = await page.$eval(dropCard + ' select[data-other]', el => el.value);
  check("Dropdown: Employed is selected in dropdown", selectedValue, "employed");

  otherTextVisible = await page.$eval(dropCard + ' .q-other-text', el => !el.hidden);
  check("Dropdown: Other text field hidden after selecting known option", otherTextVisible, false);

  // === yes_or_text ===
  console.log("\n--- yes_or_text ---");
  await page.evaluate(() => window.questionnaireV3App.setCategory("governance"));
  await page.waitForTimeout(500);
  const yotCard = '[data-question-id="q_docs_complete"]';

  // Click No — should show text field
  await page.click(yotCard + ' input[data-yesno][value="no"]');
  await page.waitForTimeout(500);
  let textVisible = await page.$eval(yotCard + ' .q-yesno-text', el => !el.hidden);
  check("yes_or_text: text field visible after No", textVisible, true);

  // Type text
  await page.fill(yotCard + ' [data-yesno-text]', 'Missing docs');
  await page.waitForTimeout(500);
  answer = await page.evaluate(() => window.questionnaireV3App.getAnswer("q_docs_complete"));
  check("yes_or_text: answer is custom text", answer, "Missing docs");

  // Click Yes — should hide text field and set answer to true
  await page.click(yotCard + ' input[data-yesno][value="yes"]');
  await page.waitForTimeout(500);
  answer = await page.evaluate(() => window.questionnaireV3App.getAnswer("q_docs_complete"));
  check("yes_or_text: clicking Yes sets answer to true", answer, true);
  textVisible = await page.$eval(yotCard + ' .q-yesno-text', el => !el.hidden);
  check("yes_or_text: text field hidden after Yes", textVisible, false);

  // Click No again — should re-show text
  await page.click(yotCard + ' input[data-yesno][value="no"]');
  await page.waitForTimeout(500);
  textVisible = await page.$eval(yotCard + ' .q-yesno-text', el => !el.hidden);
  check("yes_or_text: text field visible again after No", textVisible, true);

  // === no_or_text ===
  console.log("\n--- no_or_text ---");
  // q_conflict_details is no_or_text, visible when q_has_conflicts=true
  await page.evaluate(() => window.questionnaireV3App.setAnswer("q_has_conflicts", true));
  await page.waitForTimeout(500);
  const notCard = '[data-question-id="q_conflict_details"]';

  // Click Yes — should show text field (no_or_text shows text on Yes)
  await page.click(notCard + ' input[data-yesno][value="yes"]');
  await page.waitForTimeout(500);
  textVisible = await page.$eval(notCard + ' .q-yesno-text', el => !el.hidden);
  check("no_or_text: text field visible after Yes", textVisible, true);

  // Click No — should hide text field
  await page.click(notCard + ' input[data-yesno][value="no"]');
  await page.waitForTimeout(500);
  answer = await page.evaluate(() => window.questionnaireV3App.getAnswer("q_conflict_details"));
  check("no_or_text: clicking No sets answer to false", answer, false);
  textVisible = await page.$eval(notCard + ' .q-yesno-text', el => !el.hidden);
  check("no_or_text: text field hidden after No", textVisible, false);

  console.log(`\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
