import { useState, useMemo, useEffect } from 'react';
import { useEarningsCalendar } from '../hooks/useEarningsCalendar.js';
import { useScrollLock } from '../hooks/useScrollLock.js';
import StockLogo from './StockLogo.jsx';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonday(weekOffset = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDays(weekOffset) {
  const monday = getMonday(weekOffset);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isToday(date) {
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function formatPrice(price) {
  if (!price) return '--';
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMarketCap(mc) {
  if (!mc) return '';
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(0)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
  return '';
}

function SkeletonLoader() {
  return (
    <div className="earnings-grid">
      {DAY_NAMES.map((name, i) => (
        <div key={i} className="earnings-day">
          <div className="earnings-day-header">
            <span className="earnings-day-name">{name}</span>
          </div>
          <div className="earnings-day-cards">
            {[1, 2, 3].map(n => (
              <div key={n} className="earnings-skeleton-card">
                <div className="earnings-skeleton-top">
                  <div className="skeleton-circle" style={{ width: 14, height: 14 }} />
                  <div className="skeleton-line" style={{ width: 36, height: 11 }} />
                  <div className="skeleton-line" style={{ width: 44, height: 16, borderRadius: 8, marginLeft: 'auto' }} />
                </div>
                <div className="earnings-skeleton-bottom">
                  <div className="skeleton-line" style={{ width: 56, height: 10 }} />
                  <div className="skeleton-line" style={{ width: 32, height: 10 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatEps(val) {
  if (val == null) return null;
  return val >= 0 ? `$${val.toFixed(2)}` : `-$${Math.abs(val).toFixed(2)}`;
}

function EarningCard({ stock, onClick }) {
  const epsEst = formatEps(stock.epsEstimate);
  const epsTTM = formatEps(stock.epsTTM);

  return (
    <button className="earnings-card" onClick={() => onClick(stock)}>
      <div className="earnings-card-top">
        <StockLogo symbol={stock.symbol} size={14} />
        <span className="earnings-card-symbol">{stock.symbol}</span>
        <span className="earnings-card-name">{stock.name}</span>
        <span className={`earnings-card-change ${stock.changePercent >= 0 ? 'positive' : 'negative'}`}>
          {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
        </span>
      </div>
      <div className="earnings-card-bottom">
        <span className="earnings-card-price">${formatPrice(stock.price)}</span>
        <span className="earnings-card-mcap">{formatMarketCap(stock.marketCap)}</span>
      </div>
      {(epsEst || epsTTM) && (
        <div className="earnings-card-eps">
          {epsEst && <span className="earnings-eps-tag">Est: {epsEst}</span>}
          {epsTTM && <span className="earnings-eps-tag">TTM: {epsTTM}</span>}
        </div>
      )}
      {stock.sector && stock.sector !== 'Other' && (
        <span className="earnings-card-sector">{stock.sector}</span>
      )}
    </button>
  );
}

function DayPanel({ dayName, date, stocks, onClose, onStockClick }) {
  const dateLabel = `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
  return (
    <div className="earnings-panel-overlay" onClick={onClose}>
      <div className="earnings-panel" onClick={e => e.stopPropagation()}>
        <div className="earnings-panel-header">
          <div className="earnings-panel-title">
            <span>{dayName}, {dateLabel}</span>
            <span className="earnings-panel-count">{stocks.length} reporting</span>
          </div>
          <button className="earnings-panel-close" onClick={onClose}>&times;</button>
        </div>
        <div className="earnings-panel-list">
          {stocks.map(stock => (
            <button
              key={stock.symbol}
              className="earnings-panel-row"
              onClick={() => onStockClick(stock)}
            >
              <StockLogo symbol={stock.symbol} size={20} />
              <div className="earnings-panel-row-left">
                <span className="earnings-panel-symbol">{stock.symbol}</span>
                <span className="earnings-panel-name">{stock.name}</span>
              </div>
              <div className="earnings-panel-row-mid">
                <span className="earnings-panel-price">${formatPrice(stock.price)}</span>
                <span className="earnings-panel-mcap">
                  {formatMarketCap(stock.marketCap)}
                  {formatEps(stock.epsEstimate) && <> · Est: {formatEps(stock.epsEstimate)}</>}
                </span>
              </div>
              <div className="earnings-panel-row-right">
                <span className={`earnings-panel-change ${stock.changePercent >= 0 ? 'positive' : 'negative'}`}>
                  {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EarningsCalendar({ active, onSelectStock }) {
  const { earnings, loading, lastUpdated } = useEarningsCalendar(active);
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedDay, setExpandedDay] = useState(null);

  useScrollLock(!!expandedDay);

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  const weekLabel = useMemo(() => {
    const mon = weekDays[0];
    const fri = weekDays[4];
    if (mon.getMonth() === fri.getMonth()) {
      return `${MONTH_NAMES[mon.getMonth()]} ${mon.getDate()} - ${fri.getDate()}`;
    }
    return `${MONTH_NAMES[mon.getMonth()]} ${mon.getDate()} - ${MONTH_NAMES[fri.getMonth()]} ${fri.getDate()}`;
  }, [weekDays]);

  const totalForWeek = useMemo(() => {
    return weekDays.reduce((sum, day) => {
      const key = formatDateKey(day);
      return sum + (earnings[key]?.length || 0);
    }, 0);
  }, [weekDays, earnings]);

  const handleCardClick = (stock) => {
    if (onSelectStock) {
      onSelectStock({ symbol: stock.symbol, name: stock.name });
    }
  };

  return (
    <main className="earnings-main">
      <div className="earnings-header">
        <div className="earnings-header-left">
          <h2 className="earnings-title">Earnings Calendar</h2>
          {totalForWeek > 0 && (
            <span className="earnings-total">{totalForWeek} reporting</span>
          )}
        </div>
        <div className="earnings-nav">
          <button
            className="earnings-nav-btn"
            onClick={() => setWeekOffset(o => o - 1)}
            aria-label="Previous week"
          >
            &#8249;
          </button>
          {weekOffset !== 0 && (
            <button
              className="earnings-today-btn"
              onClick={() => setWeekOffset(0)}
            >
              This Week
            </button>
          )}
          <span className="earnings-week-label">{weekLabel}</span>
          <button
            className="earnings-nav-btn"
            onClick={() => setWeekOffset(o => o + 1)}
            aria-label="Next week"
          >
            &#8250;
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonLoader />
      ) : (
        <div className="earnings-grid">
          {weekDays.map((day, i) => {
            const key = formatDateKey(day);
            const dayStocks = earnings[key] || [];
            const today = isToday(day);

            return (
              <div key={key} className={`earnings-day${today ? ' earnings-day--today' : ''}`}>
                <div
                  className={`earnings-day-header${dayStocks.length > 0 ? ' clickable' : ''}`}
                  onClick={() => dayStocks.length > 0 && setExpandedDay({ dayName: DAY_NAMES[i], date: day, stocks: dayStocks })}
                >
                  <span className="earnings-day-name">{DAY_NAMES[i]}</span>
                  <span className="earnings-day-date">{day.getDate()}</span>
                  {dayStocks.length > 0 && (
                    <span className="earnings-day-count">{dayStocks.length}</span>
                  )}
                </div>
                <div className="earnings-day-cards">
                  {dayStocks.length > 0 ? (
                    dayStocks.map(stock => (
                      <EarningCard
                        key={stock.symbol}
                        stock={stock}
                        onClick={handleCardClick}
                      />
                    ))
                  ) : (
                    <div className="earnings-day-empty">No earnings</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lastUpdated && (
        <div className="earnings-footer">
          Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {expandedDay && (
        <DayPanel
          dayName={expandedDay.dayName}
          date={expandedDay.date}
          stocks={expandedDay.stocks}
          onClose={() => setExpandedDay(null)}
          onStockClick={(stock) => { setExpandedDay(null); handleCardClick(stock); }}
        />
      )}
    </main>
  );
}
