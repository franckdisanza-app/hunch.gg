import { expect, test } from "@playwright/test";
import { expectNoSeriousAxeViolations, watchConsole } from "./helpers";

const PAGES = [
  { path: "/", status: 200, heading: "plimp" },
  { path: "/about", status: 200, heading: "About Plimp" },
  { path: "/privacy", status: 200, heading: "Privacy" },
  { path: "/this-page-does-not-exist", status: 404, heading: "Nothing here" },
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} scheme`, () => {
    test.use({ colorScheme: scheme });

    for (const { path, status, heading } of PAGES) {
      test(`${path} loads in the frame with no serious axe violations`, async ({ page }) => {
        const errors = watchConsole(page);
        const response = await page.goto(path);
        expect(response?.status()).toBe(status);
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
        await expect(page.getByRole("banner").getByRole("link", { name: /Plimp/ })).toBeVisible();
        await expectNoSeriousAxeViolations(page);
        // The 404 page itself logs the failed document request; nothing else may error.
        expect(errors.filter((e) => !(status === 404 && e.includes("404")))).toEqual([]);
      });
    }
  });
}

test("the shelf shows the live games", async ({ page }) => {
  await page.goto("/");
  const tile = page.getByRole("link", { name: /Sticker Shock/ });
  await expect(tile).toBeVisible();
  await expect(tile).toHaveAttribute("href", "/sticker-shock");
  await expect(page.getByRole("heading", { name: "The first game is coming soon" })).toHaveCount(0);
});

test("the theme choice is saved and applied before the page paints", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  const sheet = page.getByRole("dialog", { name: "Settings" });
  await sheet.getByText("Dark", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // After a reload the inline bootstrap script sets the theme before any bundle runs.
  await page.reload({ waitUntil: "commit" });
  await page.waitForSelector("html[data-theme='dark']", { state: "attached" });
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(14, 14, 16)");
});

test("?ref=share is removed from the address bar", async ({ page }) => {
  await page.goto("/about?ref=share");
  await expect(page).toHaveURL(/\/about$/);
});

test("pages send the security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["set-cookie"]).toBeUndefined();
});

test("manifest, robots and sitemap are served", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("Plimp");
  expect(manifest.icons.length).toBeGreaterThan(0);
  expect((await request.get(manifest.icons[0].src)).headers()["content-type"]).toBe("image/png");

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /dev");
  expect(robots).toContain("/sitemap.xml");

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/about</loc>");
});
