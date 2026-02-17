import { useState, useMemo } from 'react';
import { useStocks } from '../hooks/useStocks.js';
import { useBatchChartData } from '../hooks/useBatchChartData.js';
import { useNewsData } from '../hooks/useNewsData.js';
import { formatRelativeTime } from '../utils/formatters.js';
import GridDropdown from './GridDropdown.jsx';
import StockCard from './StockCard.jsx';
import LoadingState from './LoadingState.jsx';
import EmptyState from './EmptyState.jsx';

export default function FuturesIndices({ active, onSelectStock, isFavorite, onToggleFavorite }) {
  const [subTab, setSubTab] = useState('futures');

  const isFuturesTab = subTab === 'futures';
  const isIndicesTab = subTab === 'indices';

  const futuresData = useStocks('/api/futures', active && isFuturesTab);
  const indicesData = useStocks('/api/indices', active && isIndicesTab);

  const currentData = isFuturesTab ? futuresData : indicesData;
  const { stocks, loading, error, lastUpdated } = currentData;

  const symbols = useMemo(() => stocks.map(s => s.symbol), [stocks]);
  const { chartMap } = useBatchChartData(symbols);
  const { hasNews, getNews } = useNewsData(symbols);

  const tabLabel = isFuturesTab ? 'Futures' : 'Indices';

  return (
    <main className="futures-main">
      <div className="futures-header">
        <div className="futures-header-left">
          <div className="futures-tab-toggle">
            <button
              className={`futures-tab-btn${isFuturesTab ? ' active' : ''}`}
              onClick={() => setSubTab('futures')}
            >
              Futures
            </button>
            <button
              className={`futures-tab-btn${isIndicesTab ? ' active' : ''}`}
              onClick={() => setSubTab('indices')}
            >
              Indices
            </button>
          </div>
        </div>
        <span className="futures-status-meta">
          <span className={`status-dot ${error ? 'status-error' : 'status-live'}`} />
          <span>{lastUpdated ? formatRelativeTime(lastUpdated) : 'Loading...'}</span>
        </span>
      </div>

      <div className="futures-grid">
        <div className="grid-status-bar">
          <GridDropdown
            label={tabLabel}
            stocks={stocks}
            onSelect={onSelectStock}
          />
        </div>
        {loading && stocks.length === 0 && <LoadingState />}
        {!loading && stocks.length === 0 && <EmptyState error={error} />}
        {stocks.map(stock => (
          <StockCard
            key={stock.symbol}
            stock={stock}
            chartData={chartMap[stock.symbol] || null}
            onClick={(e) => onSelectStock(stock, e)}
            hasNews={hasNews(stock.symbol)}
            newsArticles={getNews(stock.symbol)}
            isFavorite={isFavorite(stock.symbol)}
            onToggleFavorite={() => onToggleFavorite(stock.symbol)}
          />
        ))}
      </div>
    </main>
  );
}
