import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "../AppShell";
import { AuthContext } from "../../providers/AuthProvider";
import { workspaceDefinitions } from "../../navigation/workspaces";

function renderShell(props = {}) {
  const authValue = {
    loading: false,
    signOut: vi.fn(),
    user: { email: "operator@example.com" },
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <AppShell
        currentWorkspaceId="pipeline"
        dark={false}
        navigationItems={workspaceDefinitions}
        onNavigate={vi.fn()}
        setDark={vi.fn()}
        {...props}
      >
        <div>Workspace content</div>
      </AppShell>
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("AppShell", () => {
  it("renders primary navigation with an active workspace state", () => {
    renderShell();
    const desktopNav = screen.getByRole("navigation", { name: "Workspaces" });

    expect(desktopNav).toBeInTheDocument();
    expect(within(desktopNav).getByRole("button", { name: "Open Pipeline workspace" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByText("Workspace content")).toBeInTheDocument();
  });

  it("collapses the sidebar, persists preference, and exposes collapsed icon tooltips", () => {
    renderShell();
    const desktopNav = screen.getByRole("navigation", { name: "Workspaces" });

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(localStorage.getItem("ai-shell-sidebar-collapsed")).toBe("true");
    expect(within(desktopNav).getByRole("button", { name: "Open Today workspace" })).toHaveAttribute(
      "title",
      "Today"
    );
  });

  it("restores the persisted collapsed sidebar preference", () => {
    localStorage.setItem("ai-shell-sidebar-collapsed", "true");

    renderShell();
    const desktopNav = screen.getByRole("navigation", { name: "Workspaces" });

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    expect(within(desktopNav).getByRole("button", { name: "Open Inbox workspace" })).toHaveAttribute(
      "title",
      "Inbox"
    );
  });

  it("supports keyboard movement inside desktop navigation", () => {
    renderShell();
    const desktopNav = screen.getByRole("navigation", { name: "Workspaces" });
    const today = within(desktopNav).getByRole("button", { name: "Open Today workspace" });
    const pipeline = within(desktopNav).getByRole("button", { name: "Open Pipeline workspace" });

    today.focus();
    fireEvent.keyDown(desktopNav, {
      key: "ArrowDown",
    });

    expect(pipeline).toHaveFocus();
  });

  it("renders compact mobile navigation and More menu items", () => {
    renderShell();

    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open more workspaces" }));

    expect(screen.getByRole("menuitem", { name: /Deals/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Reports/ })).toBeInTheDocument();
  });

  it("keeps dark mode compatible with the shell", () => {
    const setDark = vi.fn();
    renderShell({ dark: true, setDark });

    expect(screen.getByRole("button", { name: "Light Mode" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
