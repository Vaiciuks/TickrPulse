import { useState, useMemo } from 'react';
import { useEconomicCalendar } from '../hooks/useEconomicCalendar.js';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function isToday(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function isPast(dateStr) {
  return new Date(dateStr) < new Date();
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function getImpactLabel(importance) {
  if (importance === 1) return 'high';
  if (importance === 0) return 'medium';
  return 'low';
}

function EventRow({ event }) {
  const impact = getImpactLabel(event.importance);
  const past = isPast(event.date);
  const time = formatTime(event.date);
  const hasResult = event.actual != null;

  return (
    <div className={`econ-event${past ? ' econ-event--past' : ''}${hasResult ? ' econ-event--released' : ''}`}>
      <div className="econ-event-left">
        <span className={`econ-impact econ-impact--${impact}`} title={`${impact} impact`} />
        <div className="econ-event-info">
          <span className="econ-event-title">{event.title}</span>
          {time && <span className="econ-event-time">{time}</span>}
        </div>
      </div>
      <div className="econ-event-data">
        {event.actual != null && (
          <span className="econ-data-cell econ-actual">
            <span className="econ-data-label">Actual</span>
            <span className="econ-data-value">{event.actual}</span>
          </span>
        )}
        {event.forecast != null && (
          <span className="econ-data-cell econ-forecast">
            <span className="econ-data-label">Forecast</span>
            <span className="econ-data-value">{event.forecast}</span>
          </span>
        )}
        {event.previous != null && (
          <span className="econ-data-cell econ-previous">
            <span className="econ-data-label">Previous</span>
            <span className="econ-data-value">{event.previous}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="econ-skeleton">
      {[1, 2, 3, 4, 5, 6].map(n => (
        <div key={n} className="econ-skeleton-row">
          <div className="skeleton-circle" style={{ width: 8, height: 8 }} />
          <div className="skeleton-line" style={{ width: n % 2 === 0 ? 140 : 180, height: 12 }} />
          <div className="skeleton-line" style={{ flex: 1, height: 0 }} />
          <div className="skeleton-line" style={{ width: 50, height: 10 }} />
          <div className="skeleton-line" style={{ width: 50, height: 10 }} />
        </div>
      ))}
    </div>
  );
}

export default function EconomicCalendar({ active }) {
  const { events, loading, lastUpdated } = useEconomicCalendar(active);
  const [filter, setFilter] = useState('upcoming'); // 'upcoming' | 'all'

  // Group events by date
  const grouped = useMemo(() => {
    const now = new Date();
    let filtered = events;
    if (filter === 'upcoming') {
      // Show from start of today onward
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = events.filter(e => new Date(e.date) >= todayStart);
    }

    const groups = [];
    let currentDate = null;
    let currentGroup = null;

    for (const event of filtered) {
      const dateKey = new Date(event.date).toLocaleDateString('en-CA'); // YYYY-MM-DD
      if (dateKey !== currentDate) {
        currentDate = dateKey;
        currentGroup = { date: event.date, dateKey, events: [] };
        groups.push(currentGroup);
      }
      currentGroup.events.push(event);
    }

    return groups;
  }, [events, filter]);

  // Find the next upcoming event for the "next up" banner
  const nextEvent = useMemo(() => {
    const now = new Date();
    return events.find(e => new Date(e.date) > now && e.importance === 1);
  }, [events]);

  // Count days until next high-impact event (calendar-day based)
  const daysUntilNext = useMemo(() => {
    if (!nextEvent) return null;
    const now = new Date();
    const eventDate = new Date(nextEvent.date);
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const diff = Math.round((eventDay - nowDay) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  }, [nextEvent]);

  return (
    <main className="econ-main">
      <div className="econ-header">
        <div className="econ-header-left">
          <h2 className="econ-title">Economic Calendar</h2>
          <span className="econ-event-count">{events.length} events</span>
        </div>
        <div className="econ-header-right">
          <div className="econ-filter">
            <button
              className={`econ-filter-btn${filter === 'upcoming' ? ' active' : ''}`}
              onClick={() => setFilter('upcoming')}
            >
              Upcoming
            </button>
            <button
              className={`econ-filter-btn${filter === 'all' ? ' active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {nextEvent && (
        <div className="econ-next-banner">
          <span className="econ-next-label">Next Major Event</span>
          <span className="econ-next-title">{nextEvent.title}</span>
          <span className="econ-next-when">{daysUntilNext}</span>
        </div>
      )}

      <div className="econ-legend">
        <span className="econ-legend-item"><span className="econ-impact econ-impact--high" /> High Impact</span>
        <span className="econ-legend-item"><span className="econ-impact econ-impact--medium" /> Medium</span>
        <span className="econ-legend-item"><span className="econ-impact econ-impact--low" /> Low</span>
      </div>

      {loading ? (
        <SkeletonLoader />
      ) : (
        <div className="econ-timeline">
          {grouped.length === 0 && (
            <div className="econ-empty">No upcoming economic events</div>
          )}
          {grouped.map(group => (
            <div key={group.dateKey} className="econ-day-group">
              <div className={`econ-day-header${isToday(group.date) ? ' econ-day-header--today' : ''}`}>
                <span className="econ-day-dot" />
                <span className="econ-day-label">{formatDateLabel(group.date)}</span>
                {isToday(group.date) && <span className="econ-today-badge">Today</span>}
                <span className="econ-day-count">{group.events.length}</span>
              </div>
              <div className="econ-day-events">
                {group.events.map(event => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {lastUpdated && (
        <div className="econ-footer">
          Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </main>
  );
}
