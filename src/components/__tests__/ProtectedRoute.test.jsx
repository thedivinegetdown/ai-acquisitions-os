import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProtectedRoute from "../ProtectedRoute";

const authState = vi.hoisted(() => ({
  value: {
    clearError: vi.fn(),
    error: null,
    loading: false,
    requestPasswordReset: vi.fn(),
    session: null,
    signIn: vi.fn(),
  },
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => authState.value,
}));

describe("ProtectedRoute", () => {
  it("renders the sign-in screen when there is no session", () => {
    authState.value = {
      ...authState.value,
      loading: false,
      session: null,
    };

    render(
      <ProtectedRoute>
        <div>Private App</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Sign in to continue.")).toBeInTheDocument();
  });

  it("renders children when a valid session exists", () => {
    authState.value = {
      ...authState.value,
      loading: false,
      session: {
        access_token: "token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
    };

    render(
      <ProtectedRoute>
        <div>Private App</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Private App")).toBeInTheDocument();
  });
});
