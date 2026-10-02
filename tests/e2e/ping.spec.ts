import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxeViolations, watchConsole } from "./helpers";

// Ping on draft data: the committed questions (content/ping, real records still marked sample:
// true until verified), and fake days served through route interception where a test needs to
// know the answers. Nothing a test asserts depends on a real fact.

const DAILY = "/ping";
const PRACTICE = "/ping/unlimited";

// Each test plays from its own documentation-range IP: every question posts a crowd guess, and
// the crowd API allows 30 writes a minute per IP, which parallel tests would share.
let ipCounter = 0;
test.beforeEach(async ({ context }, testInfo) => {
  const ip = `203.0.113.${(testInfo.workerIndex * 40 + ++ipCounter) % 250}`;
  await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
});

async function closeHowTo(page: Page, how: "click" | "keyboard" = "click") {
  const help = page.getByRole("dialog", { name: "How to play" });
  await expect(help).toBeVisible();
  if (how === "click") await help.getByRole("button", { name: "Got it" }).click();
  else await page.keyboard.press("Escape");
  await expect(help).toBeHidden();
}

function globe(page: Page) {
  return page.getByRole("application", { name: "Globe" });
}

/** Drops pins with Enter on the focused globe until the answer card shows. */
async function playQuestion(page: Page) {
  await globe(page).focus();
  const next = page.getByRole("button", { name: /^(Next question|See results)$/ });
  for (let pin = 0; pin < 3 && !(await next.isVisible()); pin++) {
    await page.keyboard.press("Enter");
    await page.keyboard.press("Shift+ArrowRight");
  }
  await expect(next).toBeVisible({ timeout: 10_000 });
  await expect(next).toBeFocused();
  await expect(page.getByText(/^Turns out/)).toBeVisible();
  return next;
}

/** A made-up day: three world questions whose official answers sit where the test says. */
function fakeDay(
  puzzle: number,
  answers: { lat: number; lon: number; contender?: [number, number] }[],
) {
  const categories = ["heat", "rain", "wind"] as const;
  return {
    puzzle,
    sample: true,
    questions: answers.map((a, i) => ({
      id: `fake-${i + 1}`,
      category: categories[i],
      prompt: `Fake question ${i + 1}: where is the made-up spot?`,
      teaser: `Where is made-up spot ${i + 1}?`,
      scope: { level: "world", name: "the world" },
      targets: [
        {
          lat: a.lat,
          lon: a.lon,
          label: `Fakeplace ${i + 1}`,
          official: true,
          value: 1,
          unit: "fake units",
        },
        ...(a.contender
          ? [
              {
                lat: a.contender[0],
                lon: a.contender[1],
                label: `Fake rival ${i + 1}`,
                official: false,
                value: 2,
                unit: "fake units",
              },
            ]
          : []),
      ],
      authority: "Fake Authority",
      turnsOut: "this is a made-up test answer.",
      sourceTitle: "Fake Source",
      sourceUrl: `https://example.test/fake-${i + 1}`,
      checkedOn: "2026-09-01",
      licence: "Fake licence",
      sample: true,
      surface: "land",
    })),
  };
}

/** Serves a fake day for whatever puzzle number the page asks for. */
async function serveFakeDay(page: Page, answers: Parameters<typeof fakeDay>[1]) {
  await page.route("**/api/puzzle/ping/*", (route) => {
    const n = Number(new URL(route.request().url()).pathname.split("/").pop());
    return route.fulfill({ json: fakeDay(n, answers) });
  });
}

// The globe starts on the world at 20° N, 10° E: an answer there is a bullseye first time; one
// at the far side of the world is a sure miss.
const UNDER_CROSSHAIR = { lat: 20, lon: 10 };
const FAR_AWAY = { lat: -20, lon: -170 };

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} scheme`, () => {
    test.use({ colorScheme: scheme });

    test("plays a daily round on the draft set through to the results", async ({ page }) => {
      test.setTimeout(90_000);
      const errors = watchConsole(page);
      await page.goto(DAILY);
      await closeHowTo(page);
      await expect(page.getByRole("note")).toHaveText("Draft content — facts not yet verified");
      await expect(page.getByRole("heading", { level: 1, name: /^Ping #\d+$/ })).toBeVisible();
      await expect(globe(page)).toBeVisible();
      await expectNoSeriousAxeViolations(page);

      for (let q = 1; q <= 3; q++) {
        const next = await playQuestion(page);
        if (q === 1) await expectNoSeriousAxeViolations(page);
        await expect(next).toHaveText(q === 3 ? "See results" : "Next question");
        await next.click();
      }

      await expect(page.getByRole("heading", { name: "Today's pings" })).toBeVisible();
      await expect(page.getByText(/^\d{1,3}(,\d{3})?\/3,000$/)).toBeVisible();
      await expect(page.getByRole("timer")).toBeVisible();
      await expect(page.getByRole("link", { name: "Play Practice" })).toBeVisible();
      await expectNoSeriousAxeViolations(page);
      expect(errors).toEqual([]);

      // Coming back the same day shows today's results, not a new round.
      await page.reload();
      await expect(page.getByRole("heading", { name: "Today's pings" })).toBeVisible();
      await expect(globe(page)).toHaveCount(0);
    });
  });
}

test.describe("known answers", () => {
  test.use({ reducedMotion: "reduce" });

  test("a perfect first pin solves the question at once for 1,000 points", async ({ page }) => {
    await serveFakeDay(page, [UNDER_CROSSHAIR, FAR_AWAY, FAR_AWAY]);
    await page.goto(DAILY);
    await closeHowTo(page);
    await expect(globe(page)).toBeVisible();
    await page.getByRole("button", { name: "Drop pin" }).click();
    const card = page.getByRole("article");
    await expect(card.getByText("Bullseye · 1,000 points")).toBeVisible();
    await expect(card.getByText("Fakeplace 1")).toBeVisible();
    await expect(card.getByRole("link", { name: "Fake Source" })).toBeVisible();
    // No sweep under reduced motion: the pin and the answer are read out together.
    await expect(
      page.getByText("Pin 1: bullseye! The answer: Fakeplace 1. You score 1,000 points."),
    ).toBeAttached();
  });

  test("three misses give three pings, then every contender", async ({ page }) => {
    await serveFakeDay(page, [{ ...FAR_AWAY, contender: [-30, 150] }, FAR_AWAY, FAR_AWAY]);
    await page.goto(DAILY);
    await closeHowTo(page);
    await expect(globe(page)).toBeVisible();
    const drop = page.getByRole("button", { name: "Drop pin" });
    await drop.click();
    // The first hint is the way to the answer, nothing about how far.
    const log = page.getByRole("list", { name: "Pings" });
    await expect(log.getByText(/^Answer to the (north|south)?-?(east|west)?$/)).toBeAttached();
    await expect(log.getByText(/(km|mi) · /)).toHaveCount(0);
    await expect(page.getByText("2 pins left", { exact: true })).toBeVisible();
    await drop.click();
    // The second: the distance and a heat word, never colour alone.
    await expect(log.getByText(/^\d{1,3}(,\d{3})* (km|mi) · Freezing$/)).toBeVisible();
    await drop.click();

    const card = page.getByRole("article");
    await expect(card.getByText("Every contender")).toBeVisible();
    await expect(card.getByText("Official record")).toBeVisible();
    await expect(card.getByText("Contender", { exact: true })).toBeVisible();
    await expect(card.getByText(/away · \d+ points$/)).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });
});

test("a keyboard-only run, with what screen readers hear", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serveFakeDay(page, [FAR_AWAY, UNDER_CROSSHAIR, FAR_AWAY]);
  await page.goto(DAILY);
  await closeHowTo(page, "keyboard");
  await expect(globe(page)).toBeVisible();

  // Tab to the globe: it has a name and says how to use it.
  for (
    let i = 0;
    i < 12 && !(await globe(page).evaluate((el) => el === document.activeElement));
    i++
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(globe(page)).toBeFocused();
  await expect(globe(page)).toHaveAccessibleDescription(/arrow keys turn it/);

  // Turning the globe reads out where the crosshair is.
  await page.keyboard.press("ArrowRight");
  await expect(globe(page).locator("[aria-live=polite]")).toHaveText(
    /^Crosshair on \d+\.\d\d° [NS], \d+\.\d\d° [EW], .+\.$/,
  );
  await page.keyboard.press("ArrowLeft");

  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/^Pin 1: the answer lies to the [a-z-]+\. 2 pins left\.$/),
  ).toBeAttached();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/^Pin 2: .+ off\. Freezing\. 1 pin left\.$/)).toBeAttached();
  await page.keyboard.press("Enter");
  const next = page.getByRole("button", { name: "Next question" });
  await expect(next).toBeFocused();
  await expect(
    page.getByText(
      /^Pin 3: .+ off\. Freezing\. 0 pins left\. The answer: Fakeplace 1\. You score \d+ points\.$/,
    ),
  ).toBeAttached();
  await page.keyboard.press("Enter");

  // The next question starts on the globe again; the answer sits under the crosshair.
  await expect(globe(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  const results = page.getByRole("button", { name: "See results" });
  await expect(results).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Today's pings" })).toBeVisible();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("keeps Sonde still and reveals at once", async ({ page }) => {
    await serveFakeDay(page, [UNDER_CROSSHAIR, FAR_AWAY, FAR_AWAY]);
    await page.goto(DAILY);
    await closeHowTo(page);
    const float = page.locator("svg[data-pose] g").first();
    await expect(float).toHaveCSS("animation-name", "none");
    await expect(globe(page)).toBeVisible();
    await page.getByRole("button", { name: "Drop pin" }).click();
    await expect(page.getByRole("button", { name: "Next question" })).toBeFocused({ timeout: 500 });
    await expect(page.getByText(/^Turns out/)).toBeVisible({ timeout: 500 });
  });
});

test.describe("the play screen fits the screen", () => {
  test.use({ reducedMotion: "reduce" });

  /** The page never scrolls: no taller and no wider than the window. */
  async function expectFits(page: Page, step: string) {
    const size = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
      windowHeight: window.innerHeight,
      windowWidth: window.innerWidth,
    }));
    expect(size.height, `${step}: page height`).toBeLessThanOrEqual(size.windowHeight);
    expect(size.width, `${step}: page width`).toBeLessThanOrEqual(size.windowWidth);
  }

  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [844, 390],
    [768, 1024],
    [1440, 900],
    [1920, 1080],
  ] as const) {
    test(`never scrolls while playing at ${width}×${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await serveFakeDay(page, [FAR_AWAY, FAR_AWAY, FAR_AWAY]);
      await page.goto(DAILY);
      await closeHowTo(page);
      await expect(globe(page)).toBeVisible();
      await expectFits(page, "question");
      const drop = page.getByRole("button", { name: "Drop pin" });
      await expect(drop).toBeInViewport();
      await drop.click();
      await expectFits(page, "first hint");
      await drop.click();
      await drop.click();
      // The answer card scrolls inside its panel if it must; the page does not.
      await expect(page.getByRole("article")).toBeVisible();
      await expect(page.getByRole("button", { name: "Next question" })).toBeInViewport();
      await expectFits(page, "answer card");
    });
  }

  test("gives the globe most of a desktop screen", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await serveFakeDay(page, [FAR_AWAY, FAR_AWAY, FAR_AWAY]);
    await page.goto(DAILY);
    await closeHowTo(page);
    const box = (await globe(page).boundingBox())!;
    expect(box.width).toBeGreaterThan(900);
    expect(box.height).toBeGreaterThan(780);
  });
});

test("cities and roads load only once the player zooms in", async ({ page }) => {
  const mapData: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/map/")) mapData.push(pathname);
  });
  await serveFakeDay(page, [FAR_AWAY, FAR_AWAY, FAR_AWAY]);
  await page.goto(DAILY);
  await closeHowTo(page);
  await expect(globe(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(mapData).toEqual([]);
  await globe(page).focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("+");
  await expect.poll(() => mapData).toContain("/map/v1/places-1.json");
});

test.describe("at 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 }, reducedMotion: "reduce" });

  test("never scrolls sideways", async ({ page }, testInfo) => {
    const noSideways = async (step: string) => {
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, `${step}: page is ${width}px wide`).toBeLessThanOrEqual(360);
      await testInfo.attach(`360px-${step}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    };
    await serveFakeDay(page, [FAR_AWAY, FAR_AWAY, FAR_AWAY]);
    await page.goto(DAILY);
    await closeHowTo(page);
    await expect(globe(page)).toBeVisible();
    await noSideways("question");
    // Drop pin stays on screen without scrolling.
    await expect(page.getByRole("button", { name: "Drop pin" })).toBeInViewport();
    for (let q = 1; q <= 3; q++) {
      const next = await playQuestion(page);
      if (q === 1) await noSideways("reveal");
      await next.click();
    }
    await expect(page.getByRole("heading", { name: "Today's pings" })).toBeVisible();
    await noSideways("results");
  });
});

test.describe("share", () => {
  test.use({ reducedMotion: "reduce" });
  test.beforeEach(async ({ context, page }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", { value: undefined, configurable: true });
    });
  });

  test("copies one line per question and a spoiler-free teaser", async ({ page }) => {
    await serveFakeDay(page, [UNDER_CROSSHAIR, FAR_AWAY, FAR_AWAY]);
    await page.goto(DAILY);
    await closeHowTo(page);
    for (let q = 1; q <= 3; q++) await (await playQuestion(page)).click();
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("status").getByText("Copied to clipboard")).toBeVisible();
    const lines = (await page.evaluate(() => navigator.clipboard.readText())).split(/\r?\n/);
    expect(lines).toHaveLength(6);
    expect(lines[0]).toMatch(/^Ping #\d+ · \d{1,3}(,\d{3})?\/3,000$/);
    expect(lines[1]).toBe("🌡️ 🎯");
    expect(lines[2]).toBe("🌧️ 🟥🟥🟥");
    expect(lines[3]).toBe("🌬️ 🟥🟥🟥");
    expect(lines[4]).toMatch(/^Where is made-up spot \d\?$/);
    expect(lines[5]).toMatch(/\/ping\?ref=share$/);
    expect(lines.join("\n")).not.toMatch(/Fakeplace/);
  });
});

test("the missing day shows the radar recalibrating and offers Practice", async ({ page }) => {
  await page.route("**/api/puzzle/ping/*", (route) => route.fulfill({ status: 404, json: {} }));
  await page.goto(DAILY);
  await closeHowTo(page);
  await expect(page.getByRole("heading", { name: "The radar is recalibrating" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Practise on past questions" })).toBeVisible();
});

test("Practice plays past questions and never touches the daily", async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PRACTICE);
  await closeHowTo(page);
  await expect(page.getByRole("heading", { level: 1, name: "Ping Practice" })).toBeVisible();
  for (let q = 1; q <= 3; q++) await (await playQuestion(page)).click();
  await expect(page.getByRole("heading", { name: "Round over" })).toBeVisible();
  await expect(page.getByText(/^Best round: /)).toBeVisible();
  await page.getByRole("button", { name: "Another round" }).click();
  await expect(globe(page)).toBeVisible();
  const stats = await page.evaluate(() => localStorage.getItem("plimp:v1:ping:stats"));
  expect(stats === null || JSON.parse(stats).played === 0).toBe(true);
});

test("the shelf ships no globe code; the game loads it on demand", async ({ page }) => {
  const urls = new Set<string>();
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/_next/") && url.endsWith(".js")) urls.add(url);
  });
  // d3-geo's projection API (property names survive minification) and world-atlas's shapes.
  const globeCode = (text: string) =>
    text.includes("clipAngle") || text.includes('"name":"Antarctica"');
  const loaded = async () => {
    const texts = await Promise.all(
      [...urls].map(async (url) => (await page.request.get(url)).text()),
    );
    urls.clear();
    return texts;
  };

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const shelf = await loaded();
  expect(shelf.length).toBeGreaterThan(0);
  expect(shelf.filter(globeCode)).toEqual([]);

  await page.goto(DAILY);
  await closeHowTo(page);
  await expect(globe(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect((await loaded()).some(globeCode)).toBe(true);
});

/** Whether the globe's canvas has anything drawn on it. */
async function canvasPainted(page: Page): Promise<boolean> {
  return globe(page)
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
      return false;
    });
}

test("on a world question the canvas leaves the globe picture showing until the globe moves", async ({
  page,
}) => {
  await serveFakeDay(page, [FAR_AWAY, FAR_AWAY, FAR_AWAY]);
  await page.goto(DAILY);
  await closeHowTo(page);
  await expect(globe(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
  // The picture underneath already shows this view: nothing is drawn over it yet.
  await expect(page.locator('img[src="/games/ping/globe-light.svg"]').first()).toBeVisible();
  expect(await canvasPainted(page)).toBe(false);
  await globe(page).focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => canvasPainted(page)).toBe(true);
});

test("a theme that differs from the system's hides the picture and draws the globe at once", async ({
  page,
}) => {
  await serveFakeDay(page, [FAR_AWAY, FAR_AWAY, FAR_AWAY]);
  // The system is light (Playwright's default); pick dark in the settings.
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog", { name: "Settings" }).getByText("Dark", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.goto(DAILY);
  await closeHowTo(page);
  await expect(globe(page)).toBeVisible();
  await expect(page.locator('img[src="/games/ping/globe-light.svg"]').first()).toBeHidden();
  await expect.poll(() => canvasPainted(page)).toBe(true);
});

test("a question that opens zoomed in loads the detailed map only once the player moves", async ({
  page,
}) => {
  const urls = new Set<string>();
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/_next/") && url.endsWith(".js")) urls.add(url);
  });
  // Andorra is in the 1:50m shapes only.
  const detailed = async () => {
    const texts = await Promise.all(
      [...urls].map(async (url) => (await page.request.get(url)).text()),
    );
    return texts.some((text) => text.includes('"name":"Andorra"'));
  };
  await page.route("**/api/puzzle/ping/*", (route) => {
    const n = Number(new URL(route.request().url()).pathname.split("/").pop());
    const day = fakeDay(n, [{ lat: 46.5, lon: 8 }, FAR_AWAY, FAR_AWAY]);
    day.questions[0]!.scope = {
      level: "region",
      name: "Fake Region",
      bbox: [5, 44, 12, 49],
    } as (typeof day.questions)[number]["scope"];
    return route.fulfill({ json: day });
  });

  await page.goto(DAILY);
  await closeHowTo(page);
  await expect(globe(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(await detailed()).toBe(false);

  await globe(page).focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(detailed, { timeout: 15_000 }).toBe(true);
});

test("the practice API never serves today's or a future day", async ({ request }) => {
  const res = await request.get("/api/games/ping/practice");
  expect(res.status()).toBe(200);
  const pool = await res.json();
  expect(pool.sample).toBe(true);
  expect(pool.questions.length).toBeGreaterThan(0);
  const future = await request.get("/api/puzzle/ping/9999");
  expect(future.status()).toBe(404);
});
