import { useEffect } from "react";

export default function ThemeToggle({
  dark,
  setDark,
}) {
  useEffect(() => {
    document.body.style.background =
      dark
        ? "#0f172a"
        : "#f8fafc";

    document.body.style.color =
      dark
        ? "#ffffff"
        : "#0f172a";

    localStorage.setItem(
      "ai-theme",
      dark
        ? "dark"
        : "light"
    );
  }, [dark]);

  return (
    <button
      onClick={() =>
        setDark(
          !dark
        )
      }
      style={{
        padding:
          "10px 14px",
        borderRadius: 999,
        border: "none",
        cursor:
          "pointer",
        fontWeight: 700,
        background: dark
          ? "#fff"
          : "#0f172a",
        color: dark
          ? "#0f172a"
          : "#fff",
      }}
    >
      {dark
        ? "☀️ Light Mode"
        : "🌙 Dark Mode"}
    </button>
  );
}