import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

const screenStyle = {
  alignItems: "center",
  background: "#f8fafc",
  color: "#0f172a",
  display: "flex",
  justifyContent: "center",
  minHeight: "100vh",
  padding: 24,
};

const panelStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
  maxWidth: 420,
  padding: 28,
  width: "100%",
};

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  boxSizing: "border-box",
  fontSize: 16,
  marginTop: 6,
  padding: "11px 12px",
  width: "100%",
};

const primaryButtonStyle = {
  background: "#0f172a",
  border: "1px solid #0f172a",
  borderRadius: 6,
  color: "#ffffff",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 700,
  padding: "11px 14px",
  width: "100%",
};

const linkButtonStyle = {
  background: "transparent",
  border: 0,
  color: "#2563eb",
  cursor: "pointer",
  fontSize: 14,
  padding: 0,
};

export default function AuthScreen() {
  const { clearError, error, loading, requestPasswordReset, signIn } =
    useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("sign-in");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    clearError();

    if (mode === "reset") {
      const result = await requestPasswordReset(email);

      if (result.success) {
        setMessage("Password reset email sent.");
      }

      return;
    }

    await signIn({ email, password });
  }

  function toggleMode() {
    clearError();
    setMessage("");
    setMode((current) => (current === "sign-in" ? "reset" : "sign-in"));
  }

  const isResetMode = mode === "reset";

  return (
    <main style={screenStyle}>
      <form onSubmit={handleSubmit} style={panelStyle}>
        <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>
          AI Acquisitions OS
        </h1>
        <p style={{ color: "#475569", margin: "0 0 24px" }}>
          {isResetMode ? "Reset your password." : "Sign in to continue."}
        </p>

        <label style={{ display: "block", fontWeight: 700, marginBottom: 16 }}>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            style={inputStyle}
            type="email"
            value={email}
          />
        </label>

        {!isResetMode && (
          <label style={{ display: "block", fontWeight: 700, marginBottom: 16 }}>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              style={inputStyle}
              type="password"
              value={password}
            />
          </label>
        )}

        {error && (
          <p style={{ color: "#b91c1c", margin: "0 0 16px" }}>
            {error.message || "Authentication failed."}
          </p>
        )}

        {message && (
          <p style={{ color: "#166534", margin: "0 0 16px" }}>{message}</p>
        )}

        <button disabled={loading} style={primaryButtonStyle} type="submit">
          {loading
            ? "Please wait..."
            : isResetMode
              ? "Send reset email"
              : "Sign in"}
        </button>

        <div style={{ marginTop: 18, textAlign: "center" }}>
          <button onClick={toggleMode} style={linkButtonStyle} type="button">
            {isResetMode ? "Back to sign in" : "Forgot password?"}
          </button>
        </div>
      </form>
    </main>
  );
}
