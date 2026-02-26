import { useState, useMemo } from "react";
import { useLobbying } from "../hooks/useLobbying.js";

function formatAmount(val) {
  if (!val) return "---";
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

export default function Lobbying({ active, onSelectStock }) {
  const { data, loading } = useLobbying(active);
  const [sortCol, setSortCol] = useState("totalSpent");
  const [sortDir, setSortDir] = useState("desc");

  const lobbying = useMemo(() => {
    const list = data?.lobbying || [];
    return [...list].sort((a, b) => {
      let aVal, bVal;
      switch (sortCol) {
        case "ticker":
          aVal = a.ticker;
          bVal = b.ticker;
          break;
        case "totalSpent":
          aVal = a.totalSpent || 0;
          bVal = b.totalSpent || 0;
          break;
        case "filingCount":
          aVal = a.filingCount || 0;
          bVal = b.filingCount || 0;
          break;
        case "clientCount":
          aVal = a.clientCount || 0;
          bVal = b.clientCount || 0;
          break;
        default:
          aVal = a.totalSpent || 0;
          bVal = b.totalSpent || 0;
          break;
      }
      if (typeof aVal === "string") {
        const cmp = aVal.localeCompare(bVal);
        return sortDir === "asc" ? cmp : -cmp;
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sortIcon = (col) => {
    if (sortCol !== col) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  };

  if (loading && !data) {
    return (
      <div className="smartmoney-loading">
        <div className="smartmoney-loading-pulse" />
        <span>Loading lobbying data...</span>
      </div>
    );
  }

  if (!lobbying.length) {
    return (
      <div className="smartmoney-empty">
        <span>No lobbying data available</span>
      </div>
    );
  }

  return (
    <div>
      {/* Top Spenders */}
      {data?.topSpenders?.length > 0 && (
        <div className="congress-summary-grid">
          {data.topSpenders.map((l) => (
            <div
              key={l.ticker}
              className="congress-summary-card"
              onClick={() =>
                onSelectStock?.({ symbol: l.ticker, name: l.ticker })
              }
            >
              <div className="congress-card-top">
                <span className="congress-card-name">{l.ticker}</span>
                <span className="sentiment-badge sm lobby-badge">LOBBY</span>
              </div>
              <div className="congress-card-row">
                <span className="congress-card-label">Total Spent</span>
                <span className="congress-card-value">
                  {formatAmount(l.totalSpent)}
                </span>
              </div>
              <div className="congress-card-row">
                <span className="congress-card-label">Filings</span>
                <span className="congress-card-value">{l.filingCount}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="smartmoney-table-wrap">
        <table className="smartmoney-table">
          <thead>
            <tr>
              <th
                onClick={() => handleSort("ticker")}
                className={sortCol === "ticker" ? "sorted" : ""}
              >
                Ticker{sortIcon("ticker")}
              </th>
              <th
                onClick={() => handleSort("totalSpent")}
                className={sortCol === "totalSpent" ? "sorted" : ""}
              >
                Total Spent{sortIcon("totalSpent")}
              </th>
              <th
                onClick={() => handleSort("filingCount")}
                className={sortCol === "filingCount" ? "sorted" : ""}
              >
                Filings{sortIcon("filingCount")}
              </th>
              <th
                onClick={() => handleSort("clientCount")}
                className={sortCol === "clientCount" ? "sorted" : ""}
              >
                Clients{sortIcon("clientCount")}
              </th>
              <th>Top Issues</th>
            </tr>
          </thead>
          <tbody>
            {lobbying.map((l) => (
              <tr
                key={l.ticker}
                onClick={() =>
                  onSelectStock?.({ symbol: l.ticker, name: l.ticker })
                }
              >
                <td className="sm-symbol">{l.ticker}</td>
                <td className="value-highlight">
                  {formatAmount(l.totalSpent)}
                </td>
                <td>{l.filingCount}</td>
                <td>{l.clientCount}</td>
                <td className="sm-issues">
                  {l.topIssues?.join(", ") || "---"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
