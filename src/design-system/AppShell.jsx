import { useState } from "react";
import AuthStatus from "../components/AuthStatus";
import ThemeToggle from "../components/ThemeToggle";
import { Icon } from "./icons";
import { IconButton } from "./components";

const navItems = [
  { id: "today", label: "Today", icon: "home" },
  { id: "pipeline", label: "Pipeline", icon: "home" },
  { id: "inbox", label: "Inbox", icon: "inbox" },
  { id: "deals", label: "Deals", icon: "home" },
  { id: "buyers", label: "Buyers", icon: "user" },
  { id: "reports", label: "Reports", icon: "home" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export default function AppShell({ children, dark, setDark }) {
  const [collapsed, setCollapsed] = useState(false);

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

        <nav className="app-shell__nav">
          {navItems.map((item) => (
            <button
              aria-current={item.id === "today" ? "page" : undefined}
              className="app-shell__nav-item"
              key={item.id}
              type="button"
            >
              <Icon name={item.icon} />
              <span className="app-shell__nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="app-shell__main">
        <header className="app-shell__topbar">
          <div className="app-shell__topbar-left">
            <IconButton
              icon="menu"
              label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((current) => !current)}
            />
            <div aria-label="Command search placeholder" className="app-shell__search" role="search">
              <Icon name="search" />
              <span>Search or run a command</span>
            </div>
          </div>

          <div className="app-shell__topbar-actions">
            <IconButton icon="bell" label="Notifications placeholder" />
            <ThemeToggle dark={dark} setDark={setDark} />
            <AuthStatus />
          </div>
        </header>

        <main className="app-shell__content">
          <div className="app-shell__legacy-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
