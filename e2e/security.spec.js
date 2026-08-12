import { test, expect, loginAs, tokenFor } from "./fixtures";

async function callProtectedFunction(page, { token = "", organizationId = "", body = {} } = {}) {
  return page.evaluate(async ({ tokenValue, organizationValue, payload }) => {
    const response = await fetch("/.netlify/functions/send-sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tokenValue ? { Authorization: "Bearer " + tokenValue } : {}),
        ...(organizationValue ? { "X-Organization-Id": organizationValue } : {}),
      },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() };
  }, { tokenValue: token, organizationValue: organizationId, payload: body });
}

test.describe("browser authorization boundary @security", () => {
  test("user A cannot open an organization B deal by URL", async ({ page }) => {
    await loginAs(page, "analyst");
    await page.goto("/deals/deal-b-secret");
    await expect(page.getByRole("heading", { name: "Deal not found" })).toBeVisible();
    await expect(page.getByText("800 Other Org Road")).toHaveCount(0);
  });

  test("protected functions enforce authentication, role, and organization membership", async ({
    page,
    e2eState,
  }) => {
    await page.goto("/today");

    const unauthenticated = await callProtectedFunction(page);
    expect(unauthenticated.status).toBe(401);

    const viewer = await callProtectedFunction(page, {
      token: tokenFor("viewer"),
      organizationId: "org-a",
      body: { to: "+15555550100", message: "viewer attempt" },
    });
    expect(viewer.status).toBe(403);

    const crossTenant = await callProtectedFunction(page, {
      token: tokenFor("analyst"),
      organizationId: "org-b",
      body: { to: "+15555550700", message: "tampered organization" },
    });
    expect(crossTenant.status).toBe(403);

    const crossTenantDeal = await callProtectedFunction(page, {
      token: tokenFor("analyst"),
      organizationId: "org-a",
      body: {
        to: "+15555550700",
        message: "cross-tenant deal",
        deal_id: "deal-b-secret",
      },
    });
    expect(crossTenantDeal.status).toBe(404);

    const analyst = await callProtectedFunction(page, {
      token: tokenFor("analyst"),
      organizationId: "org-a",
      body: {
        to: "+15555550100",
        message: "allowed test mutation",
        deal_id: "deal-a-residential",
      },
    });
    expect(analyst.status).toBe(200);
    expect(analyst.body).toMatchObject({ mode: "test", status: "test" });
    expect(e2eState.providerCalls).toBe(0);
  });

  test("frontend bundle and browser traffic contain no privileged service-role material", async ({
    page,
    e2eState,
  }) => {
    await loginAs(page, "analyst");
    const scripts = await page.locator("script[src]").evaluateAll((nodes) =>
      nodes.map((node) => node.src)
    );
    const source = (await Promise.all(scripts.map((url) => fetch(url).then((response) => response.text()))))
      .join("\n");
    expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|service[_-]?role/i);

    const traffic = JSON.stringify(e2eState.browserRequests);
    expect(traffic).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|service[_-]?role|eo-e2e-service/i);
    const protectedResponse = await page.evaluate(async () => {
      const response = await fetch("/.netlify/functions/send-sms", { method: "POST" });
      return {
        status: response.status,
        allowOrigin: response.headers.get("access-control-allow-origin"),
      };
    });
    expect(protectedResponse).toEqual({ status: 401, allowOrigin: null });
  });
});
