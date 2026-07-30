import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";

export function Button({
  children,
  className = "",
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}) {
  return (
    <button
      className={`ds-button ds-button--${variant} ds-button--${size} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

export const IconButton = forwardRef(function IconButton(
  { icon, label, className = "", type = "button", ...props },
  ref
) {
  return (
    <button
      aria-label={label}
      className={`ds-icon-button ${className}`.trim()}
      ref={ref}
      type={type}
      {...props}
    >
      {typeof icon === "string" ? <Icon name={icon} /> : icon}
    </button>
  );
});

export function Card({ children, className = "", muted = false, ...props }) {
  return (
    <section className={`ds-card ${muted ? "ds-card--muted" : ""} ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}

export function Badge({ children, className = "", ...props }) {
  return (
    <span className={`ds-badge ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

export function StatusBadge({ children, status = "neutral", className = "", ...props }) {
  return (
    <span className={`ds-status-badge ds-status-badge--${status} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

export function Tabs({ tabs = [], activeId, onChange, ariaLabel = "Tabs" }) {
  const firstTab = tabs[0]?.id || "";
  const selectedId = activeId || firstTab;

  function handleKeyDown(event, index) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = tabs.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowRight"
            ? Math.min(index + 1, lastIndex)
            : Math.max(index - 1, 0);
    onChange?.(tabs[nextIndex].id);
  }

  return (
    <div className="ds-tabs">
      <div aria-label={ariaLabel} className="ds-tabs__list" role="tablist">
        {tabs.map((tab, index) => (
          <button
            aria-controls={`${tab.id}-panel`}
            aria-selected={selectedId === tab.id}
            className="ds-tabs__tab"
            id={`${tab.id}-tab`}
            key={tab.id}
            onClick={() => onChange?.(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            role="tab"
            tabIndex={selectedId === tab.id ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          aria-labelledby={`${tab.id}-tab`}
          hidden={selectedId !== tab.id}
          id={`${tab.id}-panel`}
          key={tab.id}
          role="tabpanel"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

function FieldShell({ children, hint, id, label }) {
  return (
    <label className="ds-field" htmlFor={id}>
      {label ? <span className="ds-field__label">{label}</span> : null}
      {children}
      {hint ? <span className="ds-field__hint">{hint}</span> : null}
    </label>
  );
}

export function Input({ hint, id, label, ...props }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  return (
    <FieldShell hint={hint} id={fieldId} label={label}>
      <input className="ds-input" id={fieldId} {...props} />
    </FieldShell>
  );
}

export function TextArea({ hint, id, label, ...props }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  return (
    <FieldShell hint={hint} id={fieldId} label={label}>
      <textarea className="ds-textarea" id={fieldId} {...props} />
    </FieldShell>
  );
}

export function Select({ children, hint, id, label, ...props }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  return (
    <FieldShell hint={hint} id={fieldId} label={label}>
      <select className="ds-select" id={fieldId} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

function useEscape(handler, active) {
  useEffect(() => {
    if (!active) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") handler?.();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, handler]);
}

export function Modal({ children, isOpen, onClose, title }) {
  const titleId = useId();
  const closeRef = useRef(null);
  useEscape(onClose, isOpen);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="ds-modal__backdrop" onClick={onClose} />
      <div aria-labelledby={titleId} aria-modal="true" className="ds-modal" role="dialog">
        <div className="ds-overlay-header">
          <h2 className="ds-section-header__title" id={titleId}>
            {title}
          </h2>
          <IconButton icon="close" label="Close modal" onClick={onClose} ref={closeRef} />
        </div>
        {children}
      </div>
    </>
  );
}

export function Drawer({ children, isOpen, onClose, side = "right", title }) {
  const titleId = useId();
  useEscape(onClose, isOpen);
  if (!isOpen) return null;

  return (
    <>
      <div className="ds-drawer__backdrop" onClick={onClose} />
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className={`ds-drawer ds-drawer--${side}`}
        role="dialog"
      >
        <div className="ds-overlay-header">
          <h2 className="ds-section-header__title" id={titleId}>
            {title}
          </h2>
          <IconButton icon="close" label="Close drawer" onClick={onClose} />
        </div>
        {children}
      </aside>
    </>
  );
}

export function Tooltip({ children, content }) {
  const id = useId();
  return (
    <span className="ds-tooltip">
      <span aria-describedby={id} tabIndex={0}>
        {children}
      </span>
      <span className="ds-tooltip__content" id={id} role="tooltip">
        {content}
      </span>
    </span>
  );
}

export function Dropdown({ items = [], label, trigger }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  useEscape(() => setOpen(false), open);

  return (
    <div className="ds-dropdown">
      <button
        aria-controls={menuId}
        aria-expanded={open}
        className="ds-dropdown__trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {trigger || label}
        <Icon name="chevronDown" size="sm" />
      </button>
      {open ? (
        <div className="ds-dropdown__menu" id={menuId} role="menu">
          {items.map((item) => (
            <button
              className="ds-dropdown__item"
              disabled={item.disabled}
              key={item.id || item.label}
              onClick={() => {
                item.onSelect?.();
                setOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LoadingSkeleton({ height = "1rem", width = "100%" }) {
  return <span aria-hidden="true" className="ds-skeleton" style={{ height, width }} />;
}

export function Spinner({ label = "Loading" }) {
  return <span aria-label={label} className="ds-spinner" role="status" />;
}

export function SectionHeader({ actions, description, eyebrow, title }) {
  return (
    <div className="ds-section-header">
      <div>
        {eyebrow ? <div className="ds-section-header__eyebrow">{eyebrow}</div> : null}
        <h2 className="ds-section-header__title">{title}</h2>
        {description ? <p className="ds-section-header__description">{description}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}

export function PageHeader({ actions, description, eyebrow, title }) {
  return (
    <header className="ds-page-header">
      <div>
        {eyebrow ? <div className="ds-page-header__eyebrow">{eyebrow}</div> : null}
        <h1 className="ds-page-header__title">{title}</h1>
        {description ? <p className="ds-page-header__description">{description}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ action, description, title = "No data yet" }) {
  return (
    <div className="ds-empty-state">
      <h2 className="ds-section-header__title">{title}</h2>
      {description ? <p className="ds-empty-state__description">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ action, description, title = "Something went wrong" }) {
  return (
    <div className="ds-error-state" role="alert">
      <h2 className="ds-section-header__title">{title}</h2>
      {description ? <p className="ds-error-state__description">{description}</p> : null}
      {action}
    </div>
  );
}

export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  isOpen,
  message,
  onCancel,
  onConfirm,
  title = "Confirm action",
}) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      {message ? <p>{message}</p> : null}
      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
        <Button onClick={onCancel} variant="secondary">
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} variant="danger">
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
