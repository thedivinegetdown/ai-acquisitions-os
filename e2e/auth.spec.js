import { test, expect, loginAs } from "./fixtures";

test.describe("authentication and organization context", () => {
  test("protected shell requires authentication", async ({ page }) => {
    await page.goto("/today");
    await expect(page.getByRole("heading", { name: "AI Acquisitions OS" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Workspaces" })).toHaveCount(0);
  });

  test("valid test authentication enters the app and resolves one active organization", async ({
    page,
    e2eState,
  }) => {
    await loginAs(page, "analyst");
    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await page.getByRole("button", { name: /Open conversation with Alex Seller/ }).click();
    await expect(page.getByRole("heading", { name: "Alex Seller" })).toBeVisible();
    await page.getByRole("textbox", { name: "Message", exact: true }).fill("Organization resolution probe");
    await page.getByRole("button", { name: "Send SMS" }).click();
    await expect(page.getByText(/saved in test mode/i)).toBeVisible();
    expect(e2eState.membershipReads).toBeGreaterThan(0);
    expect(e2eState.securedFunctionRequests.at(-1)?.organizationId).toBe("org-a");
  });

  test("invalid or expired credentials fail closed in a safe auth state", async ({ page }) => {
    await page.goto("/today");
    await page.getByLabel("Email").fill("expired@eo-e2e.test");
    await page.getByLabel("Password").fill("not-a-session");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid login credentials.")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Workspaces" })).toHaveCount(0);
  });
});
