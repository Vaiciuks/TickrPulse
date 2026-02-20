import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../hooks/useScrollLock.js';
import { formatRelativeTime } from '../utils/formatters.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import DigestBanner from './DigestBanner.jsx';
import AuthModal from './AuthModal.jsx';
import UserMenu from './UserMenu.jsx';
import AlertsPanel from './AlertsPanel.jsx';
const HOTKEYS = [
  { keys: 'J / K', desc: 'Navigate between stock cards' },
  { keys: 'Enter', desc: 'Open chart for focused card' },
  { keys: 'F', desc: 'Toggle favorite on focused stock' },
  { keys: '1-8', desc: 'Switch timeframe (in chart)' },
  { keys: '↑ / ↓', desc: 'Navigate search suggestions' },
  { keys: 'Esc', desc: 'Close chart / modal / clear focus' },
  { keys: 'Click', desc: 'Open stock chart' },
  { keys: 'Ctrl + Click', desc: 'Select multiple charts' },
  { keys: '📷 Snip', desc: 'Click camera icon, drag to capture chart area' },
  { keys: '🔔 Alerts', desc: 'Bell icon to view & manage price alerts' },
  { keys: '✏ Notes', desc: 'Pencil icon on cards/charts to add notes' },
  { keys: '⚙ Layout', desc: 'Long-press any card to drag & reorder. Esc to cancel/exit' },
  { keys: '🌙 Theme', desc: 'Sun/moon icon to toggle light/dark mode' },
  { keys: '?', desc: 'Toggle this help panel' },
  { keys: 'Search bar', desc: 'Look up any symbol' },
];

const MOBILE_TIPS = [
  { keys: 'Tap card', desc: 'Open a stock chart' },
  { keys: '◀ Watchlist', desc: 'Tap the side tab to open/close' },
  { keys: '★ Star', desc: 'Save stocks to your Favorites list' },
  { keys: 'Search', desc: 'Look up any ticker symbol' },
  { keys: 'Tabs', desc: 'Switch: Runners, Losers, Trending, Futures' },
  { keys: 'AI Digest', desc: 'Auto-updating market news summary' },
  { keys: 'Pinch', desc: 'Pinch to zoom price scale on chart' },
  { keys: '📷 Snip', desc: 'Tap camera, then hold & drag to capture' },
  { keys: '🔔 Alerts', desc: 'Tap bell to view/manage price alerts' },
  { keys: '✏ Notes', desc: 'Tap pencil to add notes to any stock' },
  { keys: '⚙ Layout', desc: 'Hold any card to drag & reorder. Tap gear for options' },
  { keys: '🌙 Theme', desc: 'Tap sun/moon to switch light/dark mode' },
  { keys: '✕ Close', desc: 'Tap ✕ to close expanded chart' },
];

function HotkeysButton() {
  const [open, setOpen] = useState(false);

  useScrollLock(open);

  // Global "?" key toggles the popup
  useEffect(() => {
    const handle = (e) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);

  return (
    <div className="hotkeys-wrapper">
      <button className="hotkeys-btn" onClick={() => setOpen(o => !o)} aria-label="Help">?</button>
      {open && createPortal(
        <div className="hotkeys-overlay" onClick={() => setOpen(false)}>
          <div className="hotkeys-popover" onClick={e => e.stopPropagation()}>
            <button className="hotkeys-close" onClick={() => setOpen(false)}>&times;</button>
            <div className="hotkeys-title">Desktop Shortcuts</div>
            {HOTKEYS.map(h => (
              <div key={h.keys} className="hotkeys-row">
                <kbd className="hotkeys-key">{h.keys}</kbd>
                <span className="hotkeys-desc">{h.desc}</span>
              </div>
            ))}
            <div className="hotkeys-divider" />
            <div className="hotkeys-title">Mobile Tips</div>
            {MOBILE_TIPS.map(h => (
              <div key={h.keys} className="hotkeys-row">
                <kbd className="hotkeys-key">{h.keys}</kbd>
                <span className="hotkeys-desc">{h.desc}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function Header({ lastUpdated, count, error, onSearch, tabs, activeTab, onTabChange, isFavorite, onToggleFavorite, onToggleSidebar, alerts, alertCount, onToggleAlert, onRemoveAlert, theme, onToggleTheme }) {
  const { user, loading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const mobileWrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const activeTabRef = useRef(null);
  const tabsScrollRef = useRef(null);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Check if tabs can scroll further right
  const checkScrollEnd = () => {
    const el = tabsScrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  // Scroll active tab into view on mobile (horizontal scroll)
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
    }
    // Re-check scroll position after tab change
    setTimeout(checkScrollEnd, 350);
  }, [activeTab]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Close dropdown when clicking/touching outside (check both desktop + mobile wrappers)
  useEffect(() => {
    const handleClickOutside = (e) => {
      const inDesktop = wrapperRef.current && wrapperRef.current.contains(e.target);
      const inMobile = mobileWrapperRef.current && mobileWrapperRef.current.contains(e.target);
      if (!inDesktop && !inMobile) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Fetch suggestions with debounce + abort stale requests
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length === 0) {
      if (abortRef.current) abortRef.current.abort();
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      // Cancel any previous in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!controller.signal.aborted) {
          setSuggestions(data.results);
          setShowSuggestions(data.results.length > 0);
          setActiveIndex(-1);
        }
      } catch {
        // ignore aborts and network errors
      }
    }, 150);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const selectSymbol = (symbol) => {
    onSearch(symbol);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      selectSymbol(suggestions[activeIndex].symbol);
    } else {
      const symbol = query.trim().toUpperCase();
      if (symbol) selectSymbol(symbol);
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

  return (
    <>
    <header className="header">
      {/* Desktop layout */}
      <div className="header-left">
        <div className="header-tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`header-tab${activeTab === t.key ? ' header-tab-active' : ''}`}
              onClick={() => onTabChange(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Row 1: utility bar */}
      <div className="header-utility">
        <button className="sidebar-toggle-btn" onClick={onToggleSidebar} aria-label="Toggle watchlist">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="3" y1="4.5" x2="15" y2="4.5"/>
            <line x1="3" y1="9" x2="15" y2="9"/>
            <line x1="3" y1="13.5" x2="15" y2="13.5"/>
          </svg>
        </button>
        <div className="search-wrapper header-utility-search" ref={mobileWrapperRef}>
          <form className="search-form" onSubmit={handleSubmit}>
            <input
              className="search-input"
              type="text"
              placeholder="Search symbol..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
            />
          </form>
          {showSuggestions && (
            <ul className="search-suggestions">
              {suggestions.map((item, i) => (
                <li
                  key={item.symbol}
                  className={`search-suggestion${i === activeIndex ? ' search-suggestion-active' : ''}`}
                  onMouseDown={() => selectSymbol(item.symbol)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {onToggleFavorite && (
                    <button
                      className={`suggestion-star${isFavorite && isFavorite(item.symbol) ? ' starred' : ''}`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(item.symbol);
                      }}
                      aria-label={isFavorite && isFavorite(item.symbol) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {isFavorite && isFavorite(item.symbol) ? '\u2605' : '\u2606'}
                    </button>
                  )}
                  <span className="suggestion-symbol">{item.symbol}</span>
                  <span className="suggestion-name">{item.name}</span>
                  {item.exchange && <span className="suggestion-exchange">{item.exchange}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        {!authLoading && (
          user ? (
            <UserMenu />
          ) : (
            <button className="auth-signin-btn" onClick={() => setShowAuthModal(true)}>
              Sign In
            </button>
          )
        )}
        <AlertsPanel alerts={alerts} alertCount={alertCount} onToggle={onToggleAlert} onRemove={onRemoveAlert} />
        <button className="theme-toggle-btn" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3.5"/><line x1="8" y1="1" x2="8" y2="2.5"/><line x1="8" y1="13.5" x2="8" y2="15"/><line x1="1" y1="8" x2="2.5" y2="8"/><line x1="13.5" y1="8" x2="15" y2="8"/><line x1="3.05" y1="3.05" x2="4.1" y2="4.1"/><line x1="11.9" y1="11.9" x2="12.95" y2="12.95"/><line x1="3.05" y1="12.95" x2="4.1" y2="11.9"/><line x1="11.9" y1="4.1" x2="12.95" y2="3.05"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 10.5A6.5 6.5 0 015.5 2 6.5 6.5 0 1014 10.5z"/></svg>
          )}
        </button>
        <HotkeysButton />
      </div>

      {/* Mobile: digest banner */}
      <div className="header-mobile-digest">
        <DigestBanner />
      </div>

      {/* Mobile Row 2: horizontally scrolling tabs */}
      <div className="header-tabs-container">
        <div className="header-tabs" ref={tabsScrollRef} onScroll={checkScrollEnd}>
          {tabs.map(t => (
            <button
              key={t.key}
              ref={activeTab === t.key ? activeTabRef : null}
              className={`header-tab${activeTab === t.key ? ' header-tab-active' : ''}`}
              onClick={() => onTabChange(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {canScrollRight && <span className="header-tabs-scroll-hint" aria-hidden="true">›</span>}
      </div>

      {/* Desktop: search (center column) */}
      <div className="search-wrapper header-desktop-search" ref={wrapperRef}>
        <form className="search-form" onSubmit={handleSubmit}>
          <input
            className="search-input"
            type="text"
            placeholder="Search symbol..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
        </form>
        {showSuggestions && (
          <ul className="search-suggestions">
            {suggestions.map((item, i) => (
              <li
                key={item.symbol}
                className={`search-suggestion${i === activeIndex ? ' search-suggestion-active' : ''}`}
                onMouseDown={() => selectSymbol(item.symbol)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {onToggleFavorite && (
                  <button
                    className={`suggestion-star${isFavorite && isFavorite(item.symbol) ? ' starred' : ''}`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(item.symbol);
                    }}
                    aria-label={isFavorite && isFavorite(item.symbol) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {isFavorite && isFavorite(item.symbol) ? '\u2605' : '\u2606'}
                  </button>
                )}
                <span className="suggestion-symbol">{item.symbol}</span>
                <span className="suggestion-name">{item.name}</span>
                {item.exchange && <span className="suggestion-exchange">{item.exchange}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Desktop: right section */}
      <div className="header-right">
        <DigestBanner />
        {count > 0 && <span className="header-count">{count} stocks</span>}
        <span className={`status-dot ${error ? 'status-error' : 'status-live'}`} />
        <span>
          {lastUpdated ? formatRelativeTime(lastUpdated) : 'Loading...'}
        </span>
        {!authLoading && (
          user ? (
            <UserMenu />
          ) : (
            <button className="auth-signin-btn" onClick={() => setShowAuthModal(true)}>
              Sign In
            </button>
          )
        )}
        <AlertsPanel alerts={alerts} alertCount={alertCount} onToggle={onToggleAlert} onRemove={onRemoveAlert} />
        <button className="theme-toggle-btn" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3.5"/><line x1="8" y1="1" x2="8" y2="2.5"/><line x1="8" y1="13.5" x2="8" y2="15"/><line x1="1" y1="8" x2="2.5" y2="8"/><line x1="13.5" y1="8" x2="15" y2="8"/><line x1="3.05" y1="3.05" x2="4.1" y2="4.1"/><line x1="11.9" y1="11.9" x2="12.95" y2="12.95"/><line x1="3.05" y1="12.95" x2="4.1" y2="11.9"/><line x1="11.9" y1="4.1" x2="12.95" y2="3.05"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 10.5A6.5 6.5 0 015.5 2 6.5 6.5 0 1014 10.5z"/></svg>
          )}
        </button>
        <HotkeysButton />
      </div>
      </header>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  );
}
