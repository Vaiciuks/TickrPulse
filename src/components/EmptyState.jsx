export default function EmptyState({ error }) {
  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">!</div>
        <div className="empty-state-title">Unable to fetch market data</div>
        <div className="empty-state-message">
          {error}. Will retry automatically.
        </div>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">~</div>
      <div className="empty-state-title">No top runners right now</div>
      <div className="empty-state-message">
        No stocks are up 5% or more today. Data refreshes automatically every 60
        seconds.
      </div>
    </div>
  );
}
