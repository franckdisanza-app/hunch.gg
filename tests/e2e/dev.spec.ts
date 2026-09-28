import { expect, test } from "@playwright/test";
import { expectNoSeriousAxeViolations, watchConsole } from "./helpers";

// The e2e build sets ENABLE_DEV_ROUTES=1 (playwright.config.ts), so /dev renders as it does in
// development. Without the flag it is a 404; see src/lib/dev-routes.ts and the unit tests.

test("/dev shows every shared component in light and dark", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/dev");
  await expect(page.getByRole("heading", { level: 1, name: "Component gallery" })).toBeVisible();
  for (const scope of ["light", "dark"]) {
    const column = page.locator(`[data-theme-scope="${scope}"]`);
    await expect(column).toBeVisible();
    for (const title of [
      "TopBar",
      "Button",
      "Mascot",
      "RevealCard and ReportDialog",
      "ResultsScreen",
    ]) {
      await expect(column.getByRole("heading", { name: title, exact: true })).toBeVisible();
    }
  }
  await expectNoSeriousAxeViolations(page);
  expect(errors).toEqual([]);
});

test("dialogs close with Escape and return focus", async ({ page }) => {
  await page.goto("/dev");
  const light = page.locator('[data-theme-scope="light"]');
  const opener = light.getByRole("button", { name: "Open dialog" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Placeholder dialog" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("the report dialog sends a report", async ({ page }) => {
  await page.goto("/dev");
  const light = page.locator('[data-theme-scope="light"]');
  await light.getByRole("button", { name: "Report a mistake" }).click();
  const dialog = page.getByRole("dialog", { name: "Report a mistake" });
  await dialog.getByLabel("Your message").fill("A fake report from the e2e suite.");
  // The placeholder game is not in the registry, so the API answers 404 and the frame says so.
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByRole("status")).toContainText("Could not send the report");
});

test("an empty GameShell opens how to play on the first visit only", async ({ page }) => {
  await page.goto("/dev/game-shell");
  const help = page.getByRole("dialog", { name: "How to play" });
  await expect(help).toBeVisible();
  await help.getByRole("button", { name: "Got it" }).click();
  await expect(help).toBeHidden();
  await expectNoSeriousAxeViolations(page);
  await page.reload();
  await expect(page.getByText("An empty game world.")).toBeVisible();
  await expect(help).toBeHidden();
});
