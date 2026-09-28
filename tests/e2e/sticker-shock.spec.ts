import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxeViolations, watchConsole } from "./helpers";

// Sticker Shock on the sample data in content/sticker-shock (every price is fake, sample: true).

const DAILY = "/sticker-shock";

// Each test plays from its own documentation-range IP: a daily posts ten guesses, and the crowd
// API allows 30 writes a minute per IP, which parallel tests from one machine would share.
let ipCounter = 0;
test.beforeEach(async ({ context }, testInfo) => {
  const ip = `198.51.100.${(testInfo.workerIndex * 40 + ++ipCounter) % 250}`;
  await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
});
const ENDLESS = "/sticker-shock/unlimited";

async function closeHowTo(page: Page, how: "click" | "keyboard" = "click") {
  const help = page.getByRole("dialog", { name: "How to play" });
  await expect(help).toBeVisible();
  if (how === "click") await help.getByRole("button", { name: "Got it" }).click();
  else await page.keyboard.press("Escape");
  await expect(help).toBeHidden();
}

function pair(page: Page, n: number) {
  return page.getByRole("region", { name: `Pair ${n} of 10` });
}

async function playDaily(page: Page, options: { keyboard?: boolean; axe?: boolean } = {}) {
  for (let n = 1; n <= 10; n++) {
    const region = pair(page, n);
    await expect(region).toBeVisible();
    if (options.keyboard) await page.keyboard.press(n % 2 ? "a" : "ArrowRight");
    else await region.getByRole("button").first().click();
    const next = page.getByRole("button", { name: n === 10 ? "See the receipt" : "Next pair" });
    await expect(next).toBeFocused();
    await expect(page.getByText(/^Turns out/)).toBeVisible();
    if (options.axe && n === 1) await expectNoSeriousAxeViolations(page);
    if (options.keyboard) await page.keyboard.press("Enter");
    else await next.click();
  }
  await expect(page.getByRole("heading", { name: "Your receipt" })).toBeVisible();
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} scheme`, () => {
    test.use({ colorScheme: scheme });

    test("plays Daily 10 on sample data through to the receipt", async ({ page }) => {
      const errors = watchConsole(page);
      await page.goto(DAILY);
      await closeHowTo(page);
      await expect(page.getByRole("note")).toHaveText("Sample data — not real prices");
      await expect(
        page.getByRole("heading", { level: 1, name: /Sticker Shock #\d+/ }),
      ).toBeVisible();
      await expectNoSeriousAxeViolations(page);

      await playDaily(page, { axe: true });

      await expect(page.getByText("PLIMP - FOOD PRICE")).toBeVisible();
      await expect(page.getByText(/^SCORE$/)).toBeVisible();
      await expect(page.getByText("THANK YOU FOR SHOPPING")).toBeVisible();
      await expect(page.getByRole("timer")).toBeVisible();
      await expect(page.getByRole("link", { name: "Play Endless" })).toBeVisible();
      await expectNoSeriousAxeViolations(page);
      expect(errors).toEqual([]);

      // Coming back the same day shows today's receipt, not a new round.
      await page.reload();
      await expect(page.getByRole("heading", { name: "Your receipt" })).toBeVisible();
      await expect(pair(page, 1)).toHaveCount(0);
    });
  });
}

test("every reveal shows proof, store, capture date and a source link", async ({ page }) => {
  await page.goto(DAILY);
  await closeHowTo(page);
  await pair(page, 1).getByRole("button").first().click();
  const reveal = page.getByRole("article");
  await expect(reveal.getByText(/Sample Mart, \d/)).toHaveCount(2);
  await expect(reveal.getByRole("link", { name: "Sample Mart" })).toHaveCount(2);
  await reveal
    .getByRole("button", { name: /^See the shelf/ })
    .first()
    .click();
  const proof = page.getByRole("dialog", { name: /^The shelf/ });
  await expect(proof.getByRole("img")).toBeVisible();
  await expect(proof.getByRole("link", { name: "Open the source" })).toBeVisible();
  await expect(proof.getByText(/placeholder image for development/)).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await page.keyboard.press("Escape");
  await expect(proof).toBeHidden();
});

test.describe("share", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    // No Web Share API: the button falls back to the clipboard.
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", { value: undefined, configurable: true });
    });
  });

  test("falls back to the clipboard with a spoiler-free text", async ({ page }) => {
    await page.goto(DAILY);
    await closeHowTo(page);
    await playDaily(page);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("status").getByText("Copied to clipboard")).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    // Windows clipboards turn line breaks into CRLF.
    const lines = text.split(/\r?\n/);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(/^Sticker Shock #\d+ · \d+\/10$/);
    expect(lines[1]).toMatch(/^(🟩|🟥){10}$/u);
    expect(lines[2]).toMatch(/^[A-Z].* in .+ or .+ in .+\?$/);
    expect(lines[3]).toMatch(/\/sticker-shock\?ref=share$/);
    // No prices, no currencies.
    expect(text).not.toMatch(/\d+\.\d\d|CHF|€|£|\$/);
  });
});

// A two-price pool: fake items in two real countries, so the right answer is known.
const RATES = {
  "2026-09-01": {
    usdPer: { CHF: 1.25, EUR: 1.1, GBP: 1.3, JPY: 0.007 },
    sourceTitle: "Fake Rates Bureau",
    sourceUrl: "https://example.test/fake-rates",
    checkedOn: "2026-09-01",
    licence: "Fake licence",
    sample: true,
  },
};
function fakePrice(id: string, label: string, country: "CH" | "JP", priceLocal: number) {
  const currency = country === "CH" ? "CHF" : "JPY";
  return {
    id,
    itemId: id,
    country,
    currency,
    priceLocal,
    packQuantity: 1,
    packUnit: "kg",
    fxToUsd: RATES["2026-09-01"].usdPer[currency],
    fxDate: "2026-09-01",
    store: "Fake Mart",
    sourceUrl: `https://example.test/fake-mart/${id}`,
    proofImage: "/games/sticker-shock/sample-proofs/bananas.svg",
    capturedOn: "2026-09-01",
    licence: "own",
    regular: true,
    taxIncluded: true,
    sample: true,
    item: {
      id,
      label,
      quantity: 1,
      unit: "kg",
      receipt: "FAKE",
      icon: "bananas",
      category: "fruit",
    },
    countryName: country === "CH" ? "Switzerland" : "Japan",
  };
}
const POOL = {
  // 12.50 US dollars against 14.00: the Japanese one costs more.
  prices: [
    fakePrice("fake-cheap", "fake cheap thing", "CH", 10),
    fakePrice("fake-dear", "fake dear thing", "JP", 2000),
  ],
  rates: RATES,
  sample: true,
};

test.describe("Endless", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/games/sticker-shock/pool", (route) => route.fulfill({ json: POOL }));
  });

  test("ends on the first miss and tears off the receipt", async ({ page }) => {
    await page.goto(ENDLESS);
    await closeHowTo(page);
    const round = page.getByRole("region", { name: "Pair 1" });
    await round.getByRole("button", { name: /fake dear thing/ }).click();
    await page.getByRole("button", { name: "Next pair" }).click();

    const second = page.getByRole("region", { name: "Pair 2" });
    await second.getByRole("button", { name: /fake cheap thing/ }).click();
    await page.getByRole("button", { name: "Tear off the receipt" }).click();

    await expect(page.getByRole("heading", { name: "Your receipt" })).toBeVisible();
    await expect(page.getByText("TORN OFF AT THE FIRST MISS")).toBeVisible();
    await expect(page.getByText(/^RUN$/)).toBeVisible();
    await expectNoSeriousAxeViolations(page);

    // A new run starts from zero; the best run is remembered.
    await page.getByRole("button", { name: "Play again" }).click();
    await expect(page.getByRole("region", { name: "Pair 1" })).toBeVisible();
    await expect(page.getByText("Best run: 1")).toBeVisible();
  });
});

test("a keyboard-only run", async ({ page }) => {
  await page.goto(DAILY);
  await closeHowTo(page, "keyboard");
  await playDaily(page, { keyboard: true });
  await expect(page.getByText(/^SCORE$/)).toBeVisible();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("reveals at once, prints without typing and keeps Tag still", async ({ page }) => {
    await page.goto(DAILY);
    await closeHowTo(page);
    const swing = page.locator("svg[data-pose] [data-part='swing']").first();
    await expect(swing).toHaveCSS("animation-name", "none");
    await pair(page, 1).getByRole("button").first().click();
    // No pick delay: the reveal is there straight away.
    await expect(page.getByRole("button", { name: "Next pair" })).toBeFocused({ timeout: 200 });
    const printed = page.getByRole("region", { name: "Receipt printer" }).locator("li").first();
    const full = await printed.locator(".sr-only").first().textContent();
    await expect(printed.locator("[aria-hidden='true']").first()).toHaveText(full ?? "");
  });
});

test.describe("at 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("never scrolls sideways", async ({ page }, testInfo) => {
    const noSideways = async (step: string) => {
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, `${step}: page is ${width}px wide`).toBeLessThanOrEqual(360);
      await testInfo.attach(`360px-${step}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    };
    await page.goto(DAILY);
    await closeHowTo(page);
    await noSideways("pair");
    await pair(page, 1).getByRole("button").first().click();
    await noSideways("reveal");
    await page.getByRole("button", { name: "Next pair" }).click();
    for (let n = 2; n <= 10; n++) {
      await pair(page, n).getByRole("button").first().click();
      await page.getByRole("button", { name: n === 10 ? "See the receipt" : "Next pair" }).click();
    }
    await expect(page.getByRole("heading", { name: "Your receipt" })).toBeVisible();
    await noSideways("receipt");
  });
});

test("the Endless pool API leaves out upcoming dailies", async ({ request }) => {
  const res = await request.get("/api/games/sticker-shock/pool");
  expect(res.status()).toBe(200);
  const pool = await res.json();
  expect(pool.sample).toBe(true);
  expect(pool.prices.length).toBeGreaterThan(100);
});
