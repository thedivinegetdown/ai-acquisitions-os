import { useAuth } from "../hooks/useAuth";

const buttonStyle = {
  background: "transparent",
  border: "1px solid currentColor",
  borderRadius: 6,
  color: "inherit",
  cursor: "pointer",
  fontWeight: 700,
  padding: "9px 12px",
};

export default function AuthStatus() {
  const { loading, signOut, user } = useAuth();
  const label = user?.email || "Signed in";

  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 14, opacity: 0.75 }}>{label}</span>
      <button disabled={loading} onClick={signOut} style={buttonStyle}>
        Sign out
      </button>
    </div>
  );
}
