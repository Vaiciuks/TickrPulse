export default function LoadingState() {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-card-header">
            <div
              className="skeleton-circle"
              style={{ width: 32, height: 32 }}
            />
            <div className="skeleton-card-titles">
              <div
                className="skeleton-line"
                style={{ width: 60, height: 13 }}
              />
              <div
                className="skeleton-line"
                style={{ width: 100, height: 10 }}
              />
            </div>
            <div
              className="skeleton-line"
              style={{
                width: 50,
                height: 20,
                borderRadius: 10,
                marginLeft: "auto",
              }}
            />
          </div>
          <div className="skeleton-card-chart">
            <div
              className="skeleton-line"
              style={{ width: "100%", height: "100%", borderRadius: 6 }}
            />
          </div>
          <div className="skeleton-card-footer">
            <div className="skeleton-line" style={{ width: 70, height: 16 }} />
            <div className="skeleton-line" style={{ width: 50, height: 11 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
