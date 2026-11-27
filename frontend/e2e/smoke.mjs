// Browser smoke test: opens the built app in real Chrome and clicks through the main paths.
//
//   BASE_URL=http://localhost:4173 CHROME_PATH=/usr/bin/google-chrome npm run e2e
//   (add E2E_SEND_CONTACT=1 only against a backend WITHOUT real email/Telegram keys: it sends a test message)
//
// The app must already be served (npm run build, then npm run preview) with a backend running on the
// address it was built for. No AI keys are needed: these checks cover the screens and buttons, not the
// quality of the answers (the evals do that).

import fs from "node:fs";
import puppeteer from "puppeteer-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:4173";
const CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const executablePath = CANDIDATES.find((path) => fs.existsSync(path));
if (!executablePath) {
  console.error("No Chrome found. Set CHROME_PATH.");
  process.exit(2);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];

async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}\n      ${error.message}`);
  }
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

async function openPage({ width = 1000, height = 820, mobile = false, voiceSupport = true } = {}) {
  const page = await browser.newPage();
  page.errors = [];
  page.on("pageerror", (error) => page.errors.push(error.message));
  if (voiceSupport) {
    // headless Chrome has no speech recognition; a stand-in lets the voice screen start
    await page.evaluateOnNewDocument(() => {
      window.SpeechRecognition = window.webkitSpeechRecognition = class {
        start() {}
        abort() {}
        stop() {}
      };
    });
  }
  await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
  await page.goto(`${BASE_URL}/?theme=dark`, { waitUntil: "networkidle0" });
  await sleep(500);
  return page;
}

const text = (page) => page.evaluate(() => document.body.innerText.toLowerCase());
async function clickButton(page, label) {
  const handle = await page.evaluateHandle((wanted) => [...document.querySelectorAll("button, a")].find((el) => el.textContent.includes(wanted)), label);
  check(handle.asElement(), `no button or link says "${label}"`);
  await handle.asElement().click();
  await sleep(300);
}
const dialogText = (page) => page.evaluate(() => (document.querySelector("[role=dialog]")?.innerText || "").toLowerCase());

await step("start screen shows the pitch, Resume, Contact and the live projects", async () => {
  const page = await openPage();
  const body = await text(page);
  check(body.includes("resume pdf") && body.includes("contact akash"), "resume and contact buttons are missing");
  const live = await page.$$eval("[aria-label='Live projects'] a", (links) => links.map((a) => a.textContent.trim()));
  check(live.length === 3 && live.every((name) => name.endsWith("Live")), `expected three live projects, got ${JSON.stringify(live)}`);
  check(page.errors.length === 0, `page errors: ${page.errors.join(" | ")}`);
  await page.close();
});

await step("Contact Akash opens from the start screen and a message can be sent", async () => {
  const page = await openPage();
  await clickButton(page, "Contact Akash");
  check((await dialogText(page)).includes("message"), "the contact window did not open");
  if (process.env.E2E_SEND_CONTACT !== "1") {
    // Sending would email and message the real owner if the backend has real notification keys.
    // CI has none, so it sets E2E_SEND_CONTACT=1; on your own machine this step stops at "the form opens".
    await page.close();
    return;
  }
  await page.type("[role=dialog] input[autocomplete=name]", "E2E Tester");
  await page.type("[role=dialog] input[type=email]", "e2e@example.com");
  await page.type("[role=dialog] textarea", "This is an automated test message.");
  await page.evaluate(() => document.querySelector("[role=dialog] button[type=submit]").click());
  await sleep(1500);
  check((await dialogText(page)).includes("message sent"), `no confirmation after sending: ${(await dialogText(page)).slice(0, 120)}`);
  await page.close();
});

await step("text chat: welcome panel, projects, settings, accent colour and shortcuts", async () => {
  const page = await openPage();
  await clickButton(page, "Use text chat instead");
  await page.waitForSelector("input[type=text]");
  check((await text(page)).includes("hi, i'm chikki"), "the welcome panel is missing");
  await clickButton(page, "More");
  await clickButton(page, "Projects");
  const cards = await page.$$eval("[role=dialog] .project-card", (nodes) => nodes.length);
  check(cards >= 5, `expected the projects window to list the projects, got ${cards}`);
  await page.keyboard.press("Escape");
  await sleep(200);
  await clickButton(page, "More");
  await clickButton(page, "Settings");
  await clickButton(page, "Teal");
  check((await page.evaluate(() => document.documentElement.dataset.accent)) === "teal", "the accent colour did not change");
  await page.keyboard.press("Escape");
  await sleep(200);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.down("Shift");
  await page.keyboard.press("Slash");
  await page.keyboard.up("Shift");
  await sleep(300);
  check((await dialogText(page)).includes("keyboard shortcuts"), "the shortcuts list did not open with ?");
  check(page.errors.length === 0, `page errors: ${page.errors.join(" | ")}`);
  await page.close();
});

await step("interview mode starts and shows its progress bar", async () => {
  const page = await openPage();
  await clickButton(page, "Use text chat instead");
  await page.waitForSelector("input[type=text]");
  await clickButton(page, "More");
  await clickButton(page, "Interview mode");
  await clickButton(page, "Start interview");
  await sleep(600);
  check((await text(page)).includes("interview: ai engineer"), "the interview bar did not appear");
  await page.close();
});

await step("voice screen starts and its menus open (Settings, Projects, Interview)", async () => {
  const page = await openPage();
  await clickButton(page, "Click to start");
  await sleep(1200);
  check((await text(page)).includes("ask about akash"), "the voice screen did not appear");
  for (const [entry, expected] of [["Settings", "settings"], ["Projects", "projects"], ["Interview mode", "interview mode"]]) {
    await clickButton(page, "More");
    await clickButton(page, entry);
    check((await dialogText(page)).includes(expected), `"${entry}" did not open in voice mode`);
    await page.keyboard.press("Escape");
    await sleep(250);
  }
  check((await text(page)).includes("tap to talk") === false, "the tap button should stay hidden until voice needs help");
  check(page.errors.length === 0, `page errors: ${page.errors.join(" | ")}`);
  await page.close();
});

await step("phone layout puts the main actions in a bottom bar", async () => {
  const page = await openPage({ width: 390, height: 844, mobile: true });
  await clickButton(page, "Use text chat instead");
  await page.waitForSelector("input[type=text]");
  const bar = await page.evaluate(() =>
    [...document.querySelectorAll("div")].some((d) => d.className.includes("sm:hidden") && getComputedStyle(d).display !== "none" && d.innerText.includes("Resume PDF")),
  );
  check(bar, "the bottom action bar is not visible on a phone");
  const scrolls = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  check(scrolls <= 2, `the page itself scrolls by ${scrolls}px; only the chat should scroll`);
  await page.close();
});

await step("the app can be installed (manifest and service worker)", async () => {
  const page = await openPage();
  const manifest = await page.evaluate(async () => (await fetch("/manifest.webmanifest")).ok);
  check(manifest, "the manifest does not load");
  await sleep(800);
  const worker = await page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration()));
  check(worker, "the service worker did not register");
  await page.close();
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
