const paths = {
  bell: "M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Zm-5 4a2 2 0 0 1-2 0",
  check: "m5 12 4 4L19 6",
  chevronDown: "m6 9 6 6 6-6",
  close: "M6 6l12 12M18 6 6 18",
  home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z",
  inbox: "M4 4h16l-2 10h-4a2 2 0 0 1-4 0H6L4 4Zm0 10v6h16v-6",
  menu: "M4 7h16M4 12h16M4 17h16",
  search: "M10 18a8 8 0 1 1 5.3-14A8 8 0 0 1 10 18Zm6-2 4 4",
  settings: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0-6v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  user: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm8 10a8 8 0 0 0-16 0",
};

export function Icon({ name, size = "md", title = "", className = "", ...props }) {
  const path = paths[name] || paths.home;
  const ariaHidden = title ? undefined : true;

  return (
    <svg
      aria-hidden={ariaHidden}
      aria-label={title || undefined}
      className={`ds-icon ds-icon--${size} ${className}`.trim()}
      fill="none"
      focusable="false"
      role={title ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path d={path} />
    </svg>
  );
}
