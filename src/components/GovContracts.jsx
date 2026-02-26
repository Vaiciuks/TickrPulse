import { useState, useMemo } from "react";
import { useGovContracts } from "../hooks/useGovContracts.js";

function formatAmount(val) {
  if (!val) return "---";
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

export default function GovContracts({ active, onSelectStock }) {
  const { data, loading } = useGovContracts(active);
  const [sortCol, setSortCol] = useState("totalAmount");
  const [sortDir, setSortDir] = useState("desc");

  const contracts = useMemo(() => {
    const list = data?.contracts || [];
    return [...list].sort((a, b) => {
      let aVal, bVal;
      switch (sortCol) {
        case "ticker":
          aVal = a.ticker;
          bVal = b.ticker;
          break;
        case "totalAmount":
          aVal = a.totalAmount || 0;
          bVal = b.totalAmount || 0;
          break;
        case "contractCount":
          aVal = a.contractCount || 0;
          bVal = b.contractCount || 0;
          break;
        default:
          aVal = a.totalAmount || 0;
          bVal = b.totalAmount || 0;
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
        <span>Loading government contracts data...</span>
      </div>
    );
  }

  if (!contracts.length) {
    return (
      <div className="smartmoney-empty">
        <span>No government contract data available</span>
      </div>
    );
  }

  return (
    <div>
      {/* Top Recipients */}
      {data?.topRecipients?.length > 0 && (
        <div className="congress-summary-grid">
          {data.topRecipients.map((c) => (
            <div
              key={c.ticker}
              className="congress-summary-card"
              onClick={() =>
                onSelectStock?.({ symbol: c.ticker, name: c.ticker })
              }
            >
              <div className="congress-card-top">
                <span className="congress-card-name">{c.ticker}</span>
                <span className="sentiment-badge sm gov-badge">GOV</span>
              </div>
              <div className="congress-card-row">
                <span className="congress-card-label">Total Value</span>
                <span className="congress-card-value">
                  {formatAmount(c.totalAmount)}
                </span>
              </div>
              <div className="congress-card-row">
                <span className="congress-card-label">Contracts</span>
                <span className="congress-card-value">{c.contractCount}</span>
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
                onClick={() => handleSort("totalAmount")}
                className={sortCol === "totalAmount" ? "sorted" : ""}
              >
                Total Value{sortIcon("totalAmount")}
              </th>
              <th
                onClick={() => handleSort("contractCount")}
                className={sortCol === "contractCount" ? "sorted" : ""}
              >
                Contracts{sortIcon("contractCount")}
              </th>
              <th>Latest Quarter</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr
                key={c.ticker}
                onClick={() =>
                  onSelectStock?.({ symbol: c.ticker, name: c.ticker })
                }
              >
                <td className="sm-symbol">{c.ticker}</td>
                <td className="value-highlight">
                  {formatAmount(c.totalAmount)}
                </td>
                <td>{c.contractCount}</td>
                <td className="sm-date">{c.latestQuarter || "---"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
