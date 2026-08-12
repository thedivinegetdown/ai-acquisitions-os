import { test, expect, loginAs } from "./fixtures";

async function openConversation(page, name) {
  await page.goto("/inbox");
  await page.getByRole("button", { name: new RegExp("Open conversation with " + name, "i") }).click();
}

test.describe("test-mode SMS flow", () => {
  test("analyst sends only a persisted test message and never reports delivery", async ({
    page,
    e2eState,
  }) => {
    await loginAs(page, "analyst");
    await openConversation(page, "Alex Seller");
    await page.getByRole("textbox", { name: "Message", exact: true }).fill("Safe browser test message");
    await page.getByRole("button", { name: "Send SMS" }).click();

    const result = page.getByRole("status").filter({ hasText: /test mode/i });
    await expect(result).toContainText("No live SMS was sent");
    await expect(result).not.toContainText(/delivered/i);
    expect(e2eState.persistedMessages).toHaveLength(1);
    expect(e2eState.persistedMessages[0]).toMatchObject({
      organization_id: "org-a",
      status: "test",
      message: "Safe browser test message",
    });
    expect(e2eState.providerCalls).toBe(0);
  });

  test("failed send preserves the operator draft with a safe error", async ({ page, e2eState }) => {
    e2eState.apiMode = "network-failure";
    e2eState.failuresRemaining = 2;
    await loginAs(page, "analyst");
    await openConversation(page, "Alex Seller");
    const composer = page.getByRole("textbox", { name: "Message", exact: true });
    await composer.fill("Keep this draft");
    await page.getByRole("button", { name: "Send SMS" }).click();

    await expect(page.getByText(/draft is preserved/i)).toBeVisible();
    await expect(composer).toHaveValue("Keep this draft");
    expect(e2eState.persistedMessages).toHaveLength(0);
    expect(e2eState.providerCalls).toBe(0);
  });

  test("opt-out state blocks send and exposes the blocked result", async ({ page, e2eState }) => {
    await loginAs(page, "owner");
    await openConversation(page, "Opted Out Seller");
    await page.getByRole("textbox", { name: "Message", exact: true }).fill("This must remain blocked");
    await page.getByRole("button", { name: "Send SMS" }).click();

    await expect(page.getByRole("alert")).toContainText("The message was not sent");
    expect(e2eState.persistedMessages).toHaveLength(0);
    expect(e2eState.providerCalls).toBe(0);
  });
});
