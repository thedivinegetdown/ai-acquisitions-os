export default function LazyPanelFallback({ label = "Loading..." }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        color: "#64748b",
        padding: 14,
        marginBottom: 12,
      }}
    >
      {label}
    </div>
  );
}
