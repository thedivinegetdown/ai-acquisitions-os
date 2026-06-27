export default function AsyncStateView({
  loading = false,
  error = "",
  empty = false,
  loadingMessage = "Loading...",
  emptyMessage = "No data available.",
  errorMessage = "Something went wrong.",
  onRetry,
  children,
}) {
  if (loading) {
    return <p style={{ color: "#64748b" }}>{loadingMessage}</p>;
  }

  if (error) {
    return (
      <div
        style={{
          border: "1px solid #fecaca",
          background: "#fef2f2",
          borderRadius: 8,
          color: "#991b1b",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 800 }}>{errorMessage}</div>
        <div style={{ marginTop: 4 }}>{error}</div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              border: "1px solid #991b1b",
              background: "#ffffff",
              borderRadius: 8,
              color: "#991b1b",
              cursor: "pointer",
              fontWeight: 700,
              marginTop: 10,
              padding: "8px 10px",
            }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    return <p style={{ color: "#64748b" }}>{emptyMessage}</p>;
  }

  return children;
}
