import { test, expect, loginAs } from "./fixtures";

test.describe("critical personal-v1 workflow", () => {
  test("primary routes load directly and survive refresh", async ({ page }) => {
    await loginAs(page, "owner");
    const routes = [
      ["/today", "Today"],
      ["/pipeline", "Pipeline"],
      ["/inbox", "Inbox"],
      ["/approvals", "Approvals"],
      ["/deals/deal-a-residential", "123 Main Street"],
      ["/buyers", "Buyers"],
      ["/reports", "Reports"],
      ["/settings", "Settings"],
    ];

    for (const [route, heading] of routes) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  });

  test("Today, Pipeline, Inbox, Approvals, and Decision Room connect through real routes", async ({
    page,
  }) => {
    await loginAs(page, "analyst");

    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await page.getByRole("tab", { name: /Approvals/ }).click();
    await expect(page).toHaveURL(/\/approvals$/);
    await expect(page.getByText(/Manual completion required/)).toBeVisible();
    await page.getByRole("button", { name: "Review in context" }).click();
    await expect(page).toHaveURL(/\/deals\/deal-a-residential$/);

    await page.getByRole("tab", { name: "Seller" }).click();
    await expect(page.getByRole("heading", { name: "Seller" })).toBeVisible();
    await page.getByRole("tab", { name: "Property" }).click();
    await expect(page.getByRole("heading", { name: "Property" })).toBeVisible();
    await page.getByRole("tab", { name: "Numbers" }).click();
    await expect(page.getByRole("heading", { name: "Numbers" })).toBeVisible();
    await page.getByRole("tab", { name: "Communication" }).click();
    await expect(page.getByRole("heading", { name: "Communication" })).toBeVisible();
    await page.getByRole("tab", { name: "Activity" }).click();
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    await page.getByRole("tab", { name: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

    await page.getByRole("navigation", { name: "Workspaces" }).getByLabel("Open Pipeline workspace").click();
    await expect(page.getByTestId("pipeline-board")).toBeVisible();
    await expect(page.getByText(/change stage/i)).toHaveCount(0);
    await page.getByRole("button", { name: "Compact List" }).click();
    await expect(page.getByTestId("pipeline-compact-list")).toBeVisible();
    await page.getByRole("button", { name: "Open deal 123 Main Street" }).click();
    await expect(page).toHaveURL(/\/deals\/deal-a-residential$/);

    await page.getByRole("navigation", { name: "Workspaces" }).getByLabel("Open Inbox workspace").click();
    await page.getByRole("button", { name: /Open conversation with Alex Seller/ }).click();
    await expect(page.getByRole("list", { name: "Message history" }).getByText("Can you call me this afternoon?")).toBeVisible();
  });

  test("asset-specific strategy and browser history remain truthful", async ({ page }) => {
    await loginAs(page, "analyst");
    await page.goto("/deals/deal-a-residential");
    await expect(page.getByText(/Residential home - Implemented/).first()).toBeVisible();
    await expect(page.getByText(/Vacant land acquisition/i)).toHaveCount(0);

    await page.goto("/deals/deal-a-land");
    await expect(page.getByText(/Vacant residential land - Implemented/).first()).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/deals\/deal-a-residential$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/deals\/deal-a-land$/);
  });
});
