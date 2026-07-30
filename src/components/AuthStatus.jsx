import { useAuth } from "../hooks/useAuth";
import { Button } from "../design-system/components";

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
      <Button disabled={loading} onClick={signOut} size="sm" variant="ghost">
        Sign out
      </Button>
    </div>
  );
}
