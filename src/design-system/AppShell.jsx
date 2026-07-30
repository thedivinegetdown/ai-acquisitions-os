import { useMemo, useState } from "react";
import AuthStatus from "../components/AuthStatus";
import ThemeToggle from "../components/ThemeToggle";
import { mobileWorkspaceIds, workspaceDefinitions } from "../navigation/workspaces";
import { Icon } from "./icons";
import { IconButton } from "./components";

const SIDEBAR_STORAGE_KEY = "ai-shell-sidebar-collapsed";

function readPersistedCollapsed() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

function NavItem({ collapsed, currentWorkspaceId, item, onNavigate }) {
  const isActive = item.id === currentWorkspaceId;

  return (
    <button
      aria-current={isActive ? "page" : undefined}
      aria-label={item.ariaLabel}
      className="app-shell__nav-item"
      data-tooltip={collapsed ? item.label : undefined}
      key={item.id}
      onClick={() => onNavigate?.(item.id)}
      title={collapsed ? item.label : undefined}
      type="button"
    >
      <Icon name={item.icon} />
      <span className="app-shell__nav-label">{item.label}</span>
      {isActive ? <span aria-hidden="true" className="app-shell__active-marker" /> : null}
    </button>
  );
}

export default function AppShell({
  children,
  currentWorkspaceId = "today",
  dark,
  navigationItems = workspaceDefinitions,
  onNavigate,
  setDark,
}) {
  const [collapsed, setCollapsed] = useState(readPersistedCollapsed);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const mobileItems = useMemo(
    () => navigationItems.filter((item) => mobileWorkspaceIds.includes(item.id)),
    [navigationItems]
  );
  const moreItems = useMemo(
    () => navigationItems.filter((item) => !mobileWorkspaceIds.includes(item.id)),
    [navigationItems]
  );

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      }
      return next;
    });
  }

  function handleNavigate(workspaceId) {
    setMobileMoreOpen(false);
    onNavigate?.(workspaceId);
  }

  function handleNavKeyDown(event) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const navButtons = Array.from(
      event.currentTarget.querySelectorAll(".app-shell__nav-item:not(:disabled)")
    );
    const currentIndex = navButtons.indexOf(document.activeElement);
    if (currentIndex === -1) return;

    event.preventDefault();
    const lastIndex = navButtons.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowDown"
            ? Math.min(currentIndex + 1, lastIndex)
            : Math.max(currentIndex - 1, 0);
    navButtons[nextIndex]?.focus();
  }

  return (
    <div className={`app-shell ${collapsed ? "app-shell--collapsed" : ""}`}>
      <aside aria-label="Primary navigation" className="app-shell__sidebar">
        <div className="app-shell__brand">
          <span aria-hidden="true" className="app-shell__brand-mark">
            AI
          </span>
          <span className="app-shell__brand-text">
            <span className="app-shell__brand-title">AI Acquisitions OS</span>
            <span className="app-shell__brand-subtitle">Acquisition command center</span>
          </span>
        </div>

        <nav aria-label="Workspaces" className="app-shell__nav" onKeyDown={handleNavKeyDown}>
          {navigationItems.map((item) => (
            <NavItem
              collapsed={collapsed}
              currentWorkspaceId={currentWorkspaceId}
              item={item}
              key={item.id}
              onNavigate={handleNavigate}
            />
          ))}
        </nav>
      </aside>

      <div className="app-shell__main">
        <header className="app-shell__topbar">
          <div className="app-shell__topbar-left">
            <IconButton
              className="app-shell__sidebar-toggle"
              icon="menu"
              label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={toggleCollapsed}
            />
            <div className="app-shell__workspace-title" aria-live="polite">
              {navigationItems.find((item) => item.id === currentWorkspaceId)?.label || "Workspace"}
            </div>
            <button
              aria-label="Command search is not available yet"
              className="app-shell__search"
              disabled
              type="button"
            >
              <Icon name="search" />
              <span>Search or run a command</span>
            </button>
          </div>

          <div className="app-shell__topbar-actions">
            <IconButton disabled icon="bell" label="Notifications are not available yet" />
            <ThemeToggle dark={dark} setDark={setDark} />
            <AuthStatus />
          </div>
        </header>

        <main className="app-shell__content">
          <div className="app-shell__legacy-content">{children}</div>
        </main>

        <nav aria-label="Mobile navigation" className="app-shell__mobile-nav">
          {mobileItems.map((item) => (
            <button
              aria-current={item.id === currentWorkspaceId ? "page" : undefined}
              aria-label={item.ariaLabel}
              className="app-shell__mobile-nav-item"
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              type="button"
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
          <button
            aria-expanded={mobileMoreOpen}
            aria-label="Open more workspaces"
            className="app-shell__mobile-nav-item"
            onClick={() => setMobileMoreOpen((current) => !current)}
            type="button"
          >
            <Icon name="more" />
            <span>More</span>
          </button>
          {mobileMoreOpen ? (
            <div className="app-shell__mobile-more" role="menu">
              {moreItems.map((item) => (
                <button
                  className="app-shell__mobile-more-item"
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  role="menuitem"
                  type="button"
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
