import { useState, useEffect, useRef } from 'react';
import { useEarningsLookup } from '../hooks/useEarningsLookup.js';

function formatRevenue(val) {
  if (val == null) return '--';
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}

function formatEps(val) {
  if (val == null) return '--';
  return val >= 0 ? `$${val.toFixed(2)}` : `-$${Math.abs(val).toFixed(2)}`;
}

function formatSurprise(pct) {
  if (pct == null) return '--';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function quarterLabel(q) {
  // Prefer fiscal quarter/year from API (accurate) over date-derived quarter
  if (q.quarter && q.year) return `Q${q.quarter} '${String(q.year).slice(2)}`;
  if (q.period) {
    const parts = q.period.split('-');
    if (parts.length >= 2) {
      const month = parseInt(parts[1], 10);
      const qNum = Math.ceil(month / 3);
      return `Q${qNum} '${parts[0].slice(2)}`;
    }
  }
  return q.date || '?';
}

export default function EarningsLookup({ active, onSelectStock }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [selectedName, setSelectedName] = useState('');
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const wrapperRef = useRef(null);

  const { data, loading, error } = useEarningsLookup(selectedSymbol);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Search suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length === 0) {
      if (abortRef.current) abortRef.current.abort();
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!controller.signal.aborted) {
          setSuggestions(json.results || []);
          setShowSuggestions((json.results || []).length > 0);
          setActiveIndex(-1);
        }
      } catch { /* ignore */ }
    }, 200);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const selectSymbol = (sym, name) => {
    setSelectedSymbol(sym);
    setSelectedName(name || sym);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      selectSymbol(suggestions[activeIndex].symbol, suggestions[activeIndex].name);
    } else if (query.trim()) {
      selectSymbol(query.trim().toUpperCase(), '');
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i < suggestions.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i > 0 ? i - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // EPS bar chart — only quarters with actual results, up to 12
  const epsChart = data?.epsHistory?.length > 0
    ? data.epsHistory.filter(q => q.actual != null).slice(-12)
    : [];
  const epsMax = epsChart.length > 0
    ? Math.max(...epsChart.flatMap(q => [Math.abs(q.actual ?? 0), Math.abs(q.estimate ?? 0)]), 0.01)
    : 1;

  // Revenue bar chart — only quarters with actual data, up to 12
  const revChart = data?.revenueHistory?.length > 0
    ? data.revenueHistory.filter(q => q.revenueActual != null).slice(-12)
    : [];
  const revMax = revChart.length > 0
    ? Math.max(...revChart.flatMap(q => [q.revenueActual ?? 0, q.revenueEstimate ?? 0]), 1)
    : 1;

  // Analyst consensus
  const rec = data?.recommendation;
  const recTotal = rec ? (rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell) : 0;

  // Surprise history table — newest first, only quarters with actual results
  const surpriseData = data?.epsHistory
    ? [...data.epsHistory].filter(q => q.actual != null).reverse()
    : [];

  if (!selectedSymbol) {
    return (
      <div className="el-container">
        <div className="el-search-section" ref={wrapperRef}>
          <form onSubmit={handleSubmit} className="el-search-form">
            <input
              type="text"
              className="el-search-input"
              placeholder="Search any stock for earnings details..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            />
          </form>
          {showSuggestions && (
            <div className="el-suggestions">
              {suggestions.map((s, i) => (
                <button
                  key={s.symbol}
                  className={`el-suggestion-item${i === activeIndex ? ' active' : ''}`}
                  onClick={() => selectSymbol(s.symbol, s.name)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span className="el-sug-symbol">{s.symbol}</span>
                  <span className="el-sug-name">{s.name}</span>
                  {s.exchange && <span className="el-sug-exchange">{s.exchange}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="el-empty-state">
          <div className="el-empty-icon">&#128200;</div>
          <p>Search for a company to view detailed earnings data</p>
          <p className="el-empty-sub">Historical EPS, revenue, analyst consensus, and more</p>
        </div>
      </div>
    );
  }

  return (
    <div className="el-container">
      {/* Search bar */}
      <div className="el-search-section" ref={wrapperRef}>
        <form onSubmit={handleSubmit} className="el-search-form">
          <input
            type="text"
            className="el-search-input"
            placeholder="Search another stock..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          />
        </form>
        {showSuggestions && (
          <div className="el-suggestions">
            {suggestions.map((s, i) => (
              <button
                key={s.symbol}
                className={`el-suggestion-item${i === activeIndex ? ' active' : ''}`}
                onClick={() => selectSymbol(s.symbol, s.name)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="el-sug-symbol">{s.symbol}</span>
                <span className="el-sug-name">{s.name}</span>
                {s.exchange && <span className="el-sug-exchange">{s.exchange}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="smartmoney-loading">
          <div className="smartmoney-loading-pulse" />
          <span>Loading earnings data for {selectedSymbol}...</span>
        </div>
      )}

      {error && (
        <div className="smartmoney-empty">
          <span>Failed to load earnings data: {error}</span>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Profile header */}
          <div className="el-profile-header">
            <div className="el-profile-left">
              <span className="el-profile-symbol">{data.symbol}</span>
              {selectedName && <span className="el-profile-name">{selectedName}</span>}
            </div>
            <div className="el-profile-badges">
              {data.streak && data.streak.type !== 'none' && data.streak.count > 0 && (
                <span className={`el-streak-badge ${data.streak.type}`}>
                  {data.streak.count}Q {data.streak.type === 'beat' ? 'Beat' : data.streak.type === 'miss' ? 'Miss' : 'Met'} Streak
                </span>
              )}
              {data.nextEarningsDate && (
                <span className="el-next-earnings">
                  Next: {data.nextEarningsDate}
                </span>
              )}
            </div>
          </div>

          {/* EPS History Chart */}
          {epsChart.length > 0 && (
            <div className="el-section">
              <h3 className="el-section-title">EPS History (Actual vs Estimate)</h3>
              <div className="el-bar-chart">
                {epsChart.map((q, i) => {
                  const estH = q.estimate != null ? (Math.abs(q.estimate) / epsMax) * 100 : 0;
                  const actH = q.actual != null ? (Math.abs(q.actual) / epsMax) * 100 : 0;
                  const isBeat = q.beat === true;
                  const isMiss = q.beat === false;
                  return (
                    <div key={i} className="el-bar-group">
                      <div className="el-bar-values">
                        {q.actual != null && (
                          <span className={`el-bar-val ${isBeat ? 'beat' : isMiss ? 'miss' : ''}`}>
                            {formatEps(q.actual)}
                          </span>
                        )}
                      </div>
                      <div className="el-bars">
                        {q.estimate != null && (
                          <div
                            className="el-bar estimate"
                            style={{ height: `${Math.max(estH, 4)}%` }}
                            title={`Est: ${formatEps(q.estimate)}`}
                          />
                        )}
                        {q.actual != null && (
                          <div
                            className={`el-bar actual ${isBeat ? 'beat' : isMiss ? 'miss' : ''}`}
                            style={{ height: `${Math.max(actH, 4)}%` }}
                            title={`Act: ${formatEps(q.actual)}`}
                          />
                        )}
                      </div>
                      <span className="el-bar-label">{quarterLabel(q)}</span>
                      {isBeat && <span className="el-beat-indicator">&#10003;</span>}
                      {isMiss && <span className="el-miss-indicator">&#10007;</span>}
                    </div>
                  );
                })}
              </div>
              <div className="el-chart-legend">
                <span className="el-legend-item"><span className="el-legend-dot estimate" /> Estimate</span>
                <span className="el-legend-item"><span className="el-legend-dot actual" /> Actual</span>
              </div>
            </div>
          )}

          {/* Revenue History Chart */}
          {revChart.length > 0 && (
            <div className="el-section">
              <h3 className="el-section-title">Revenue History (Actual vs Estimate)</h3>
              <div className="el-bar-chart">
                {revChart.map((q, i) => {
                  const estH = q.revenueEstimate != null ? (q.revenueEstimate / revMax) * 100 : 0;
                  const actH = q.revenueActual != null ? (q.revenueActual / revMax) * 100 : 0;
                  const isBeat = q.beat === true;
                  const isMiss = q.beat === false;
                  return (
                    <div key={i} className="el-bar-group">
                      <div className="el-bar-values">
                        {q.revenueActual != null && (
                          <span className={`el-bar-val ${isBeat ? 'beat' : isMiss ? 'miss' : ''}`}>
                            {formatRevenue(q.revenueActual)}
                          </span>
                        )}
                      </div>
                      <div className="el-bars">
                        {q.revenueEstimate != null && (
                          <div
                            className="el-bar estimate"
                            style={{ height: `${Math.max(estH, 4)}%` }}
                            title={`Est: ${formatRevenue(q.revenueEstimate)}`}
                          />
                        )}
                        {q.revenueActual != null && (
                          <div
                            className={`el-bar actual ${isBeat ? 'beat' : isMiss ? 'miss' : ''}`}
                            style={{ height: `${Math.max(actH, 4)}%` }}
                            title={`Act: ${formatRevenue(q.revenueActual)}`}
                          />
                        )}
                      </div>
                      <span className="el-bar-label">{quarterLabel(q)}</span>
                      {isBeat && <span className="el-beat-indicator">&#10003;</span>}
                      {isMiss && <span className="el-miss-indicator">&#10007;</span>}
                    </div>
                  );
                })}
              </div>
              <div className="el-chart-legend">
                <span className="el-legend-item"><span className="el-legend-dot estimate" /> Estimate</span>
                <span className="el-legend-item"><span className="el-legend-dot actual" /> Actual</span>
              </div>
            </div>
          )}

          {/* Analyst Consensus */}
          {rec && recTotal > 0 && (
            <div className="el-section">
              <h3 className="el-section-title">Analyst Consensus</h3>
              <div className="el-consensus">
                <div className="el-consensus-bar">
                  {rec.strongBuy > 0 && (
                    <div
                      className="el-con-seg strong-buy"
                      style={{ flex: rec.strongBuy }}
                      title={`Strong Buy: ${rec.strongBuy}`}
                    >
                      {rec.strongBuy}
                    </div>
                  )}
                  {rec.buy > 0 && (
                    <div
                      className="el-con-seg buy"
                      style={{ flex: rec.buy }}
                      title={`Buy: ${rec.buy}`}
                    >
                      {rec.buy}
                    </div>
                  )}
                  {rec.hold > 0 && (
                    <div
                      className="el-con-seg hold"
                      style={{ flex: rec.hold }}
                      title={`Hold: ${rec.hold}`}
                    >
                      {rec.hold}
                    </div>
                  )}
                  {rec.sell > 0 && (
                    <div
                      className="el-con-seg sell"
                      style={{ flex: rec.sell }}
                      title={`Sell: ${rec.sell}`}
                    >
                      {rec.sell}
                    </div>
                  )}
                  {rec.strongSell > 0 && (
                    <div
                      className="el-con-seg strong-sell"
                      style={{ flex: rec.strongSell }}
                      title={`Strong Sell: ${rec.strongSell}`}
                    >
                      {rec.strongSell}
                    </div>
                  )}
                </div>
                <div className="el-consensus-labels">
                  <span className="el-con-label strong-buy">Strong Buy</span>
                  <span className="el-con-label buy">Buy</span>
                  <span className="el-con-label hold">Hold</span>
                  <span className="el-con-label sell">Sell</span>
                  <span className="el-con-label strong-sell">Strong Sell</span>
                </div>
                <div className="el-consensus-total">{recTotal} analysts · {rec.period}</div>
              </div>
            </div>
          )}

          {/* Surprise History Table */}
          {surpriseData.length > 0 && (
            <div className="el-section">
              <h3 className="el-section-title">Earnings Surprise History</h3>
              <div className="smartmoney-table-wrap">
                <table className="smartmoney-table">
                  <thead>
                    <tr>
                      <th>Quarter</th>
                      <th>EPS Est.</th>
                      <th>EPS Act.</th>
                      <th>Surprise</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surpriseData.map((q, i) => (
                      <tr key={i}>
                        <td>{quarterLabel(q)}</td>
                        <td>{formatEps(q.estimate)}</td>
                        <td className={q.beat === true ? 'el-beat-text' : q.beat === false ? 'el-miss-text' : ''}>
                          {formatEps(q.actual)}
                        </td>
                        <td className={q.surprisePercent != null ? (q.surprisePercent >= 0 ? 'el-beat-text' : 'el-miss-text') : ''}>
                          {formatSurprise(q.surprisePercent)}
                        </td>
                        <td>
                          {q.beat === true && <span className="sentiment-badge bullish">BEAT</span>}
                          {q.beat === false && <span className="sentiment-badge bearish">MISS</span>}
                          {q.beat == null && <span className="sentiment-badge">--</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No data at all */}
          {!epsChart.length && !revChart.length && !rec && !surpriseData.length && (
            <div className="smartmoney-empty">
              <span>No earnings data available for {data.symbol}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
