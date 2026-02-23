import React, { useState, useMemo } from "react";
import { useOptionsFlow } from "../hooks/useOptionsFlow.js";

function formatPremium(val) {
  if (!val) return "$0";
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

export default function OptionsFlow({ active, onSelectStock }) {
  const { data, loading } = useOptionsFlow(active);
  const [sortCol, setSortCol] = useState("totalPremium");
  const [sortDir, setSortDir] = useState("desc");
  const [expanded, setExpanded] = useState(null);

  const stocks = useMemo(() => {
    const list = data?.stocks || [];
    return [...list].sort((a, b) => {
      let aVal, bVal;
      switch (sortCol) {
        case "symbol":
          aVal = a.symbol;
          bVal = b.symbol;
          break;
        case "putCallRatio":
          aVal = a.putCallRatio || 0;
          bVal = b.putCallRatio || 0;
          break;
        case "netPremium":
          aVal = a.netPremium || 0;
          bVal = b.netPremium || 0;
          break;
        case "unusualPremium":
          aVal = a.unusualPremium || 0;
          bVal = b.unusualPremium || 0;
          break;
        case "totalPremium":
        default:
          aVal = a.totalPremium || 0;
          bVal = b.totalPremium || 0;
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
        <span>Scanning options flow across 30 symbols...</span>
      </div>
    );
  }

  if (!stocks.length) {
    return (
      <div className="smartmoney-empty">
        <span>No options flow data available</span>
      </div>
    );
  }

  return (
    <>
      {/* Summary cards */}
      <div className="options-summary-grid">
        {stocks.slice(0, 6).map((s) => (
          <div
            key={s.symbol}
            className="options-summary-card"
            onClick={() => onSelectStock?.({ symbol: s.symbol, name: s.name })}
          >
            <div className="options-card-top">
              <span className="options-card-symbol">{s.symbol}</span>
              <span className={`sentiment-badge ${s.sentiment}`}>
                {s.sentiment}
              </span>
            </div>
            <div className="options-card-row">
              <span className="options-card-label">Net Premium</span>
              <span
                className={`options-card-value ${s.netPremium >= 0 ? "up" : "down"}`}
              >
                {formatPremium(s.netPremium)}
              </span>
            </div>
            <div className="options-card-row">
              <span className="options-card-label">P/C Ratio</span>
              <span className="options-card-value">
                {s.putCallRatio ?? "—"}
              </span>
            </div>
            <div className="options-card-row">
              <span className="options-card-label">Unusual $</span>
              <span className="options-card-value">
                {formatPremium(s.unusualPremium)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Full table */}
      <div className="smartmoney-table-wrap">
        <table className="smartmoney-table">
          <thead>
            <tr>
              <th
                onClick={() => handleSort("symbol")}
                className={sortCol === "symbol" ? "sorted" : ""}
              >
                Symbol{sortIcon("symbol")}
              </th>
              <th className="sm-hide-mobile">Price</th>
              <th
                onClick={() => handleSort("putCallRatio")}
                className={sortCol === "putCallRatio" ? "sorted" : ""}
              >
                P/C Ratio{sortIcon("putCallRatio")}
              </th>
              <th
                onClick={() => handleSort("totalPremium")}
                className={sortCol === "totalPremium" ? "sorted" : ""}
              >
                Total Premium{sortIcon("totalPremium")}
              </th>
              <th
                onClick={() => handleSort("netPremium")}
                className={sortCol === "netPremium" ? "sorted" : ""}
              >
                Net Premium{sortIcon("netPremium")}
              </th>
              <th
                onClick={() => handleSort("unusualPremium")}
                className={sortCol === "unusualPremium" ? "sorted" : ""}
              >
                Unusual ${sortIcon("unusualPremium")}
              </th>
              <th>Sentiment</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => (
              <React.Fragment key={s.symbol}>
                <tr
                  onClick={() =>
                    setExpanded((e) => (e === s.symbol ? null : s.symbol))
                  }
                  className={expanded === s.symbol ? "row-expanded" : ""}
                >
                  <td className="sm-symbol">{s.symbol}</td>
                  <td className="sm-hide-mobile">
                    ${s.stockPrice?.toFixed(2)}
                  </td>
                  <td>{s.putCallRatio ?? "—"}</td>
                  <td className="value-highlight">
                    {formatPremium(s.totalPremium)}
                  </td>
                  <td className={s.netPremium >= 0 ? "text-green" : "text-red"}>
                    {formatPremium(s.netPremium)}
                  </td>
                  <td className="value-highlight">
                    {formatPremium(s.unusualPremium)}
                  </td>
                  <td>
                    <span className={`sentiment-badge ${s.sentiment}`}>
                      {s.sentiment}
                    </span>
                  </td>
                </tr>
                {expanded === s.symbol && s.topUnusual?.length > 0 && (
                  <tr key={`${s.symbol}-detail`} className="row-detail">
                    <td colSpan="7">
                      <div className="unusual-detail">
                        <div className="unusual-detail-title">
                          Top Unusual Contracts
                        </div>
                        {s.topUnusual.map((u, i) => (
                          <div key={i} className="unusual-detail-row">
                            <span
                              className={`sentiment-badge sm ${u.sentiment}`}
                            >
                              {u.type}
                            </span>
                            <span>${u.strike} strike</span>
                            <span>{formatDate(u.expiration)} exp</span>
                            <span>
                              Vol: {u.volume?.toLocaleString() ?? "--"}
                            </span>
                            <span>
                              OI: {u.openInterest?.toLocaleString() ?? "--"}
                            </span>
                            <span className="value-highlight">
                              {formatPremium(u.totalPremium)}
                            </span>
                          </div>
                        ))}
                        <button
                          className="unusual-detail-view"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStock?.({ symbol: s.symbol, name: s.name });
                          }}
                        >
                          Open Chart
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
