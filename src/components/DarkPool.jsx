import { useState, useMemo } from "react";
import { useDarkPool } from "../hooks/useDarkPool.js";

function formatVolume(val) {
  if (!val) return "---";
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return val.toLocaleString();
}

function shortLevel(pct) {
  if (pct >= 0.6) return { label: "Very High", color: "extreme" };
  if (pct >= 0.5) return { label: "High", color: "high" };
  if (pct >= 0.4) return { label: "Moderate", color: "moderate" };
  return { label: "Normal", color: "low" };
}

export default function DarkPool({ active, onSelectStock }) {
  const { data, loading } = useDarkPool(active);
  const [sortCol, setSortCol] = useState("totalVolume");
  const [sortDir, setSortDir] = useState("desc");

  const stocks = useMemo(() => {
    const list = data?.stocks || [];
    return [...list].sort((a, b) => {
      let aVal, bVal;
      switch (sortCol) {
        case "ticker":
          aVal = a.ticker;
          bVal = b.ticker;
          break;
        case "totalVolume":
          aVal = a.totalVolume || 0;
          bVal = b.totalVolume || 0;
          break;
        case "shortVolume":
          aVal = a.shortVolume || 0;
          bVal = b.shortVolume || 0;
          break;
        case "shortPercent":
          aVal = a.shortPercent || 0;
          bVal = b.shortPercent || 0;
          break;
        default:
          aVal = a.totalVolume || 0;
          bVal = b.totalVolume || 0;
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
        <span>Loading dark pool data...</span>
      </div>
    );
  }

  if (!stocks.length) {
    return (
      <div className="smartmoney-empty">
        <span>No dark pool data available</span>
      </div>
    );
  }

  return (
    <div>
      {/* Top by Volume */}
      {data?.topByVolume?.length > 0 && (
        <div className="congress-summary-grid">
          {data.topByVolume.map((s) => (
            <div
              key={s.ticker}
              className="congress-summary-card"
              onClick={() =>
                onSelectStock?.({ symbol: s.ticker, name: s.ticker })
              }
            >
              <div className="congress-card-top">
                <span className="congress-card-name">{s.ticker}</span>
                <span className="sentiment-badge sm darkpool-badge">OTC</span>
              </div>
              <div className="congress-card-row">
                <span className="congress-card-label">Volume</span>
                <span className="congress-card-value">
                  {formatVolume(s.totalVolume)}
                </span>
              </div>
              <div className="congress-card-row">
                <span className="congress-card-label">Short %</span>
                <span className="congress-card-value">
                  {(s.shortPercent * 100).toFixed(1)}%
                </span>
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
                onClick={() => handleSort("totalVolume")}
                className={sortCol === "totalVolume" ? "sorted" : ""}
              >
                OTC Volume{sortIcon("totalVolume")}
              </th>
              <th
                onClick={() => handleSort("shortVolume")}
                className={sortCol === "shortVolume" ? "sorted" : ""}
              >
                Short Volume{sortIcon("shortVolume")}
              </th>
              <th
                onClick={() => handleSort("shortPercent")}
                className={sortCol === "shortPercent" ? "sorted" : ""}
              >
                Short %{sortIcon("shortPercent")}
              </th>
              <th>Signal</th>
              <th className="sm-hide-mobile">Date</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => {
              const level = shortLevel(s.shortPercent);
              const fillPct = Math.min(
                ((s.shortPercent * 100) / 70) * 100,
                100,
              );
              return (
                <tr
                  key={s.ticker}
                  onClick={() =>
                    onSelectStock?.({ symbol: s.ticker, name: s.ticker })
                  }
                >
                  <td className="sm-symbol">{s.ticker}</td>
                  <td>{formatVolume(s.totalVolume)}</td>
                  <td>{formatVolume(s.shortVolume)}</td>
                  <td className="value-highlight">
                    {(s.shortPercent * 100).toFixed(1)}%
                  </td>
                  <td>
                    <div className="squeeze-cell">
                      <span className={`squeeze-label squeeze-${level.color}`}>
                        {level.label}
                      </span>
                      <div className="squeeze-meter">
                        <div
                          className={`squeeze-meter-fill squeeze-fill-${level.color}`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="sm-hide-mobile sm-date">{s.date || "---"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
