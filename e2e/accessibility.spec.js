import { test, expect, loginAs } from "./fixtures";

test.describe("accessibility smoke @a11y", () => {
  test("primary shell landmarks and keyboard navigation remain reachable", async ({ page }) => {
    await loginAs(page, "analyst");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();

    const navigation = page.getByRole("navigation", { name: "Workspaces" });
    const today = navigation.getByLabel("Open Today workspace");
    await today.focus();
    await expect(today).toBeFocused();
    await today.press("ArrowDown");
    await expect(navigation.getByLabel("Open Pipeline workspace")).toBeFocused();
  });

  test("approval drawer closes with Escape and restores a safe page state", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/approvals");
    const item = page.getByRole("button", { name: /Offer ready for review/ });
    await item.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Approvals" })).toBeVisible();
  });

  test("Inbox composer has status text and no keyboard trap", async ({ page }) => {
    await loginAs(page, "analyst");
    await page.goto("/inbox");
    await page.getByRole("button", { name: /Open conversation with Alex Seller/ }).click();
    const composer = page.getByRole("textbox", { name: "Message", exact: true });
    await composer.focus();
    await expect(composer).toBeFocused();
    await composer.press("Tab");
    await expect(page.getByRole("button", { name: "Send SMS" })).toBeFocused();
  });
});
