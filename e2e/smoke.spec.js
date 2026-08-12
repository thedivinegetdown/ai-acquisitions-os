import { test, expect, loginAs } from "./fixtures";

test.describe("routing and production-safe smoke contracts @smoke", () => {
  test("root, SPA fallback, lazy route, and unknown route are healthy", async ({ page }) => {
    const startedAt = Date.now();
    const root = await page.goto("/");
    expect(root?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "AI Acquisitions OS" })).toBeVisible();
    expect(Date.now() - startedAt).toBeLessThan(15_000);

    await loginAs(page, "analyst");
    const lazy = await page.goto("/pipeline");
    expect(lazy?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Pipeline" })).toBeVisible();

    const unknown = await page.goto("/not-a-real-route");
    expect(unknown?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Workspace not found" })).toBeVisible();
  });

  test("safe health and webhook probes expose no sensitive values", async ({ page }) => {
    await page.goto("/");
    const results = await page.evaluate(async () => {
      const health = await fetch("/.netlify/functions/health-check");
      const inbound = await fetch("/.netlify/functions/inbound-v2", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "Body=test",
      });
      const stripe = await fetch("/.netlify/functions/stripe-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const protectedApi = await fetch("/.netlify/functions/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return {
        healthStatus: health.status,
        healthBody: await health.text(),
        inboundStatus: inbound.status,
        stripeStatus: stripe.status,
        protectedStatus: protectedApi.status,
      };
    });

    expect(results.healthStatus).toBe(200);
    expect(results.inboundStatus).toBe(403);
    expect(results.stripeStatus).toBe(400);
    expect(results.protectedStatus).toBe(401);
    expect(results.healthBody).not.toMatch(/private[_-]?key|auth[_-]?token|service[_-]?role|password/i);
  });
});
