export const typography = {
  fontFamily: {
    sans: 'Inter, ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif',
    mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  },
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.15,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.65,
  },
};

export const spacing = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
};

export const radii = {
  none: "0",
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  full: "999px",
};

export const shadows = {
  none: "none",
  sm: "0 1px 2px rgba(15, 23, 42, 0.08)",
  md: "0 8px 24px rgba(15, 23, 42, 0.12)",
  lg: "0 20px 44px rgba(15, 23, 42, 0.18)",
};

export const colors = {
  light: {
    bg: "#f8fafc",
    surface: "#ffffff",
    surfaceMuted: "#f1f5f9",
    text: "#0f172a",
    textMuted: "#475569",
    border: "#dbe3ef",
    primary: "#0f172a",
    primaryText: "#ffffff",
    focus: "#2563eb",
  },
  dark: {
    bg: "#020617",
    surface: "#0f172a",
    surfaceMuted: "#1e293b",
    text: "#f8fafc",
    textMuted: "#cbd5e1",
    border: "#334155",
    primary: "#e2e8f0",
    primaryText: "#020617",
    focus: "#60a5fa",
  },
};

export const statusColors = {
  neutral: { bg: "#f1f5f9", text: "#334155", border: "#cbd5e1" },
  info: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  success: { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" },
  warning: { bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
  danger: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
};

export const iconSizes = {
  xs: "0.75rem",
  sm: "1rem",
  md: "1.25rem",
  lg: "1.5rem",
  xl: "2rem",
};

export const durations = {
  fast: "120ms",
  normal: "180ms",
  slow: "260ms",
};

export const breakpoints = {
  sm: "480px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
};

export const zIndex = {
  base: 0,
  sticky: 20,
  dropdown: 40,
  overlay: 60,
  modal: 70,
  toast: 80,
};

export const tokens = {
  typography,
  spacing,
  radii,
  shadows,
  colors,
  statusColors,
  iconSizes,
  durations,
  breakpoints,
  zIndex,
};
