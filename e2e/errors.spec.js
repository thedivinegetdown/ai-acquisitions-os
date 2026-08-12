import { test, expect, loginAs } from "./fixtures";

test.describe("safe browser error states", () => {
  test("missing deal, empty pipeline, and empty inbox fail safely", async ({ page, e2eState }) => {
    e2eState.dealsOverride = [];
    e2eState.messagesOverride = [];
    await loginAs(page, "analyst");

    await page.goto("/deals/missing-deal");
    await expect(page.getByRole("heading", { name: "Deal not found" })).toBeVisible();

    await page.goto("/pipeline");
    await expect(page.getByText("Pipeline is empty")).toBeVisible();

    await page.goto("/inbox");
    await expect(page.getByText("No conversations yet")).toBeVisible();
  });

  test("malformed repository response becomes a bounded app error without stack leakage", async ({
    page,
    e2eState,
  }) => {
    e2eState.malformedTable = "deals";
    await loginAs(page, "analyst");
    await expect(page.getByText(/Some Today sources are incomplete/i)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/TypeError:|at Object\.|node_modules/i);
  });

  test("500 and malformed API responses preserve drafts and expose safe messages", async ({
    page,
    e2eState,
  }) => {
    await loginAs(page, "analyst");
    await page.goto("/inbox");
    await page.getByRole("button", { name: /Open conversation with Alex Seller/ }).click();
    const composer = page.getByRole("textbox", { name: "Message", exact: true });

    e2eState.apiMode = "server-error";
    e2eState.failuresRemaining = 2;
    await composer.fill("Server error draft");
    await page.getByRole("button", { name: "Send SMS" }).click();
    await expect(page.getByText(/draft is preserved/i)).toBeVisible();
    await expect(composer).toHaveValue("Server error draft");

    e2eState.apiMode = "malformed";
    e2eState.failuresRemaining = 2;
    await page.getByRole("button", { name: "Send SMS" }).click();
    await expect(page.getByText(/draft is preserved/i)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/SyntaxError:|stack|node_modules/i);
  });
});
