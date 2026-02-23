import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useBatchChartData } from "../hooks/useBatchChartData.js";
import { useScrollLock } from "../hooks/useScrollLock.js";
import { useNewsData } from "../hooks/useNewsData.js";
import StockCard from "./StockCard.jsx";
import LoadingState from "./LoadingState.jsx";

const FILTER_CONFIGS = [
  {
    key: "marketCap",
    label: "Market Cap",
    options: [
      { value: "", label: "Any" },
      { value: "mega", label: "Mega (>200B)" },
      { value: "large", label: "Large (10-200B)" },
      { value: "mid", label: "Mid (2-10B)" },
      { value: "small", label: "Small (300M-2B)" },
      { value: "micro", label: "Micro (<300M)" },
    ],
  },
  {
    key: "change",
    label: "Change %",
    options: [
      { value: "", label: "Any" },
      { value: "up5", label: "Up >5%" },
      { value: "up2", label: "Up >2%" },
      { value: "up0", label: "Up >0%" },
      { value: "down", label: "Down" },
      { value: "down2", label: "Down >2%" },
      { value: "down5", label: "Down >5%" },
    ],
  },
  {
    key: "volume",
    label: "Volume",
    options: [
      { value: "", label: "Any" },
      { value: "1m", label: ">1M" },
      { value: "500k", label: ">500K" },
      { value: "100k", label: ">100K" },
      { value: "unusual", label: "Unusual (>2x avg)" },
    ],
  },
  {
    key: "price",
    label: "Price",
    options: [
      { value: "", label: "Any" },
      { value: "under10", label: "Under $10" },
      { value: "10to50", label: "$10 - $50" },
      { value: "50to200", label: "$50 - $200" },
      { value: "over200", label: "Over $200" },
    ],
  },
  {
    key: "sector",
    label: "Sector",
    options: [
      { value: "", label: "Any" },
      { value: "technology", label: "Technology" },
      { value: "healthcare", label: "Healthcare" },
      { value: "finance", label: "Finance" },
      { value: "energy", label: "Energy" },
      { value: "consumer", label: "Consumer" },
      { value: "industrials", label: "Industrials" },
      { value: "communications", label: "Communications" },
      { value: "utilities", label: "Utilities" },
      { value: "realestate", label: "Real Estate" },
      { value: "materials", label: "Materials" },
    ],
  },
];

const SORT_OPTIONS = [
  { value: "change", label: "Change %" },
  { value: "volume", label: "Volume" },
  { value: "marketCap", label: "Market Cap" },
  { value: "price", label: "Price" },
];

const DEFAULT_FILTERS = {
  marketCap: "",
  change: "",
  volume: "100k",
  price: "",
  sector: "",
  sortBy: "volume",
  sortOrder: "desc",
};

function FilterDropdown({
  label,
  options,
  value,
  isActive,
  onChange,
  openKey,
  onToggle,
  filterKey,
}) {
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);
  const isOpen = openKey === filterKey;

  const selectedLabel = options.find((o) => o.value === value)?.label || "Any";

  // Compute dropdown position from button rect (escapes overflow parents)
  useEffect(() => {
    if (!isOpen || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, [isOpen]);

  // No useScrollLock here — the backdrop's touch-action:none handles iOS scroll prevention.
  // Using useScrollLock (position:fixed on body) breaks dropdown positioning.

  const handleSelect = useCallback(
    (val) => {
      onChange(val);
      onToggle(null);
    },
    [onChange, onToggle],
  );

  return (
    <div className="screener-filter">
      {label && <span className="screener-filter-label">{label}</span>}
      <button
        ref={btnRef}
        className={`screener-filter-btn${isActive ? " screener-filter-btn--active" : ""}${isOpen ? " screener-filter-btn--open" : ""}`}
        onClick={() => onToggle(isOpen ? null : filterKey)}
      >
        <span className="screener-filter-btn-text">{selectedLabel}</span>
        <svg
          className="screener-filter-chevron"
          width="10"
          height="6"
          viewBox="0 0 10 6"
        >
          <path d="M0 0l5 6 5-6z" fill="currentColor" />
        </svg>
      </button>
      {isOpen &&
        createPortal(
          <>
            <div
              className="screener-dropdown-backdrop"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(null);
              }}
              onTouchMove={(e) => e.preventDefault()}
            />
            <div
              ref={panelRef}
              className="screener-dropdown"
              style={pos ? { top: pos.top, left: pos.left } : undefined}
            >
              <div className="screener-dropdown-header">
                {label || "Sort by"}
              </div>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  className={`screener-dropdown-option${opt.value === value ? " screener-dropdown-option--selected" : ""}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span>{opt.label}</span>
                  {opt.value === value && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 8l3.5 3.5L13 5"
                        stroke="var(--green-primary)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

export default function Screener({
  active,
  onSelectStock,
  isFavorite,
  onToggleFavorite,
}) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  // Fetch on filter change with debounce
  useEffect(() => {
    if (!active) return;

    const timer = setTimeout(() => {
      const run = async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch("/api/screener", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(filters),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setStocks(data.stocks || []);
          setTotalCount(data.totalCount || data.count || 0);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
          setHasFetched(true);
        }
      };
      run();
    }, 300);

    return () => clearTimeout(timer);
  }, [filters, active]);

  // Mini charts + news for screener results
  const screenerSymbols = useMemo(() => stocks.map((s) => s.symbol), [stocks]);
  const { chartMap } = useBatchChartData(screenerSymbols);
  const { hasNews, getNews } = useNewsData(screenerSymbols);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSortOrder = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      sortOrder: prev.sortOrder === "desc" ? "asc" : "desc",
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleStockClick = useCallback(
    (stock) => {
      if (onSelectStock) onSelectStock(stock);
    },
    [onSelectStock],
  );

  const toggleDropdown = useCallback((key) => {
    setOpenDropdown(key);
  }, []);

  const activeFilterCount = [
    filters.marketCap,
    filters.change,
    filters.volume,
    filters.price,
    filters.sector,
  ].filter(Boolean).length;

  return (
    <main className="screener-main">
      <div className="screener-header">
        <div className="screener-header-left">
          <h2 className="screener-title">Stock Screener</h2>
          <span className="screener-count">
            {loading
              ? "Scanning..."
              : hasFetched
                ? `${stocks.length} results`
                : ""}
            {!loading && hasFetched && totalCount > stocks.length
              ? ` of ${totalCount.toLocaleString()}`
              : ""}
          </span>
        </div>
        {activeFilterCount > 0 && (
          <button className="screener-clear-btn" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className="screener-filters">
        {FILTER_CONFIGS.map((config) => (
          <FilterDropdown
            key={config.key}
            filterKey={config.key}
            label={config.label}
            options={config.options}
            value={filters[config.key]}
            isActive={!!filters[config.key]}
            onChange={(val) => updateFilter(config.key, val)}
            openKey={openDropdown}
            onToggle={toggleDropdown}
          />
        ))}

        <div className="screener-filter screener-filter--sort">
          <span className="screener-filter-label">Sort by</span>
          <div className="screener-sort-group">
            <FilterDropdown
              filterKey="__sort"
              label=""
              options={SORT_OPTIONS}
              value={filters.sortBy}
              isActive={false}
              onChange={(val) => updateFilter("sortBy", val)}
              openKey={openDropdown}
              onToggle={toggleDropdown}
            />
            <button
              className="screener-sort-dir"
              onClick={toggleSortOrder}
              title={filters.sortOrder === "desc" ? "Descending" : "Ascending"}
            >
              {filters.sortOrder === "desc" ? "\u2193" : "\u2191"}
            </button>
          </div>
        </div>
      </div>

      <div className="screener-results">
        {loading && stocks.length === 0 && <LoadingState />}
        {!loading && hasFetched && stocks.length === 0 && !error && (
          <div className="screener-empty">
            <div className="screener-empty-icon">
              {activeFilterCount > 0 ? "\uD83D\uDD0D" : "\uD83D\uDCC8"}
            </div>
            <div className="screener-empty-title">
              {activeFilterCount > 0
                ? "No stocks match your filters"
                : "No results"}
            </div>
            <div className="screener-empty-text">
              {activeFilterCount > 0
                ? "Try relaxing some criteria"
                : "Try adjusting the sort order"}
            </div>
          </div>
        )}
        {error && (
          <div className="screener-empty">
            <div className="screener-empty-icon">!</div>
            <div className="screener-empty-title">Unable to fetch results</div>
            <div className="screener-empty-text">{error}</div>
          </div>
        )}
        {stocks.map((stock) => (
          <StockCard
            key={stock.symbol}
            stock={stock}
            chartData={chartMap[stock.symbol] || null}
            onClick={() => handleStockClick(stock)}
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
