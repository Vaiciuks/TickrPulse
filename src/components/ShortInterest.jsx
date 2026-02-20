import { useState, useMemo } from 'react';
import { useShortInterest } from '../hooks/useShortInterest.js';

function formatShares(val) {
  if (!val) return '—';
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return val.toLocaleString();
}

function formatPercent(val) {
  if (val == null) return '—';
  return `${(val * 100).toFixed(1)}%`;
}

function squeezeLevel(shortPct) {
  if (!shortPct) return { label: '—', color: '' };
  const pct = shortPct * 100;
  if (pct >= 20) return { label: 'Extreme', color: 'extreme' };
  if (pct >= 10) return { label: 'High', color: 'high' };
  if (pct >= 5) return { label: 'Moderate', color: 'moderate' };
  return { label: 'Low', color: 'low' };
}

export default function ShortInterest({ active, onSelectStock }) {
  const { data, loading } = useShortInterest(active);
  const [sortCol, setSortCol] = useState('shortPercentOfFloat');
  const [sortDir, setSortDir] = useState('desc');

  const stocks = useMemo(() => {
    const list = data?.stocks || [];
    return [...list].sort((a, b) => {
      let aVal, bVal;
      switch (sortCol) {
        case 'symbol': aVal = a.symbol; bVal = b.symbol; break;
        case 'price': aVal = a.price || 0; bVal = b.price || 0; break;
        case 'changePercent': aVal = a.changePercent || 0; bVal = b.changePercent || 0; break;
        case 'shortRatio': aVal = a.shortRatio || 0; bVal = b.shortRatio || 0; break;
        case 'sharesShort': aVal = a.sharesShort || 0; bVal = b.sharesShort || 0; break;
        case 'shortPercentOfFloat': default: aVal = a.shortPercentOfFloat || 0; bVal = b.shortPercentOfFloat || 0; break;
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const sortIcon = (col) => {
    if (sortCol !== col) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  if (loading && !data) {
    return (
      <div className="smartmoney-loading">
        <div className="smartmoney-loading-pulse" />
        <span>Loading short interest data...</span>
      </div>
    );
  }

  if (!stocks.length) {
    return (
      <div className="smartmoney-empty">
        <span>No short interest data available</span>
      </div>
    );
  }

  return (
    <div className="smartmoney-table-wrap">
      <table className="smartmoney-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('symbol')} className={sortCol === 'symbol' ? 'sorted' : ''}>
              Symbol{sortIcon('symbol')}
            </th>
            <th className="sm-hide-mobile">Name</th>
            <th onClick={() => handleSort('price')} className={sortCol === 'price' ? 'sorted' : ''}>
              Price{sortIcon('price')}
            </th>
            <th onClick={() => handleSort('changePercent')} className={sortCol === 'changePercent' ? 'sorted' : ''}>
              Change{sortIcon('changePercent')}
            </th>
            <th onClick={() => handleSort('shortPercentOfFloat')} className={sortCol === 'shortPercentOfFloat' ? 'sorted' : ''}>
              Short % Float{sortIcon('shortPercentOfFloat')}
            </th>
            <th onClick={() => handleSort('shortRatio')} className={sortCol === 'shortRatio' ? 'sorted' : ''}>
              Days to Cover{sortIcon('shortRatio')}
            </th>
            <th onClick={() => handleSort('sharesShort')} className={`sm-hide-mobile${sortCol === 'sharesShort' ? ' sorted' : ''}`}>
              Shares Short{sortIcon('sharesShort')}
            </th>
            <th>Squeeze</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map(s => {
            const sq = squeezeLevel(s.shortPercentOfFloat);
            const fillPct = Math.min((s.shortPercentOfFloat || 0) * 100 / 40 * 100, 100);
            return (
              <tr
                key={s.symbol}
                onClick={() => onSelectStock?.({ symbol: s.symbol, name: s.name })}
              >
                <td className="sm-symbol">{s.symbol}</td>
                <td className="sm-hide-mobile sm-name">{s.name}</td>
                <td>${s.price?.toFixed(2)}</td>
                <td className={s.changePercent >= 0 ? 'text-green' : 'text-red'}>
                  {s.changePercent >= 0 ? '+' : ''}{s.changePercent?.toFixed(2)}%
                </td>
                <td className="value-highlight">{formatPercent(s.shortPercentOfFloat)}</td>
                <td>{s.shortRatio?.toFixed(1) ?? '—'}</td>
                <td className="sm-hide-mobile">{formatShares(s.sharesShort)}</td>
                <td>
                  <div className="squeeze-cell">
                    <span className={`squeeze-label squeeze-${sq.color}`}>{sq.label}</span>
                    <div className="squeeze-meter">
                      <div
                        className={`squeeze-meter-fill squeeze-fill-${sq.color}`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
