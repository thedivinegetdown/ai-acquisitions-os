import { useEffect } from "react";
import { Button } from "../design-system/components";

export default function ThemeToggle({ dark, setDark }) {
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("ai-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <Button
      aria-pressed={dark}
      onClick={() => setDark(!dark)}
      size="sm"
      variant="secondary"
    >
      {dark ? "Light Mode" : "Dark Mode"}
    </Button>
  );
}
