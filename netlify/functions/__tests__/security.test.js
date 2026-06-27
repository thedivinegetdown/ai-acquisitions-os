import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  isLikelyEmail,
  isValidPhone,
  json,
  parseJsonBody,
  requirePost,
  truncate,
} = require("../_shared/security.cjs");

describe("Netlify function security helpers", () => {
  it("returns consistent JSON responses", () => {
    const response = json(201, { success: true });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual({ success: true });
    expect(response.headers["Content-Type"]).toBe("application/json");
  });

  it("validates methods and parses JSON bodies safely", () => {
    expect(requirePost({ httpMethod: "GET" }).statusCode).toBe(405);
    expect(requirePost({ httpMethod: "OPTIONS" }).statusCode).toBe(200);
    expect(requirePost({ httpMethod: "POST" })).toBeNull();

    expect(parseJsonBody({ body: '{"name":"Jane"}' }).body.name).toBe("Jane");
    expect(parseJsonBody({ body: "not-json" }).error).toBe("Invalid JSON body.");
  });

  it("validates common API fields without external providers", () => {
    expect(isLikelyEmail("person@example.com")).toBe(true);
    expect(isLikelyEmail("bad-email")).toBe(false);
    expect(isValidPhone("+15551234567")).toBe(true);
    expect(isValidPhone("123")).toBe(false);
    expect(truncate("abcdef", 3)).toBe("abc");
  });

  it("redacts secret-like log metadata", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { logInfo } = require("../_shared/security.cjs");

    logInfo("test", { token: "secret-value", ok: "safe" });

    expect(spy).toHaveBeenCalledWith("test", {
      token: "[redacted]",
      ok: "safe",
    });

    spy.mockRestore();
  });
});
