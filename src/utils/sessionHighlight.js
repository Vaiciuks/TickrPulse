/**
 * lightweight-charts v4 series primitive that shades extended-hours
 * (pre-market, after-hours, overnight) zones with distinct tints and
 * draws dashed vertical boundary lines at session transitions.
 *
 * US equity sessions (Eastern Time):
 *   Pre-market:   4:00 AM – 9:30 AM
 *   Regular:      9:30 AM – 4:00 PM
 *   After-hours:  4:00 PM – 8:00 PM
 *   Overnight:    8:00 PM – 4:00 AM (next day)
 */

const etFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: 'numeric',
  hour12: false,
});

const etDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: 'numeric',
  minute: 'numeric',
  hour12: false,
});

function getETHourDecimal(unixSeconds) {
  const parts = etFormatter.formatToParts(new Date(unixSeconds * 1000));
  const h = parseInt(parts.find(p => p.type === 'hour').value);
  const m = parseInt(parts.find(p => p.type === 'minute').value);
  return h + m / 60;
}

/**
 * Classify a timestamp into one of four session types.
 * Returns: 'premarket' | 'regular' | 'afterhours' | 'overnight'
 */
function getSessionType(unixSeconds) {
  const h = getETHourDecimal(unixSeconds);
  if (h >= 9.5 && h < 16) return 'regular';
  if (h >= 4 && h < 9.5) return 'premarket';
  if (h >= 16 && h < 20) return 'afterhours';
  return 'overnight'; // 20:00 – 4:00
}

// Zone fill colors per session type
const ZONE_COLORS = {
  premarket:  'rgba(30, 60, 160, 0.15)',   // blue tint
  afterhours: 'rgba(30, 60, 160, 0.15)',   // blue tint (same as premarket)
  overnight:  'rgba(140, 60, 220, 0.35)',  // bold purple
};

/**
 * Generate forward-looking timestamps from the last data point
 * to 20:00 ET (end of after-hours). Returns an array of unix
 * timestamps at the given interval that the chart can use as
 * whitespace to extend the time axis.
 */
export function projectForwardTimestamps(lastTime, intervalSeconds) {
  const parts = etDateFormatter.formatToParts(new Date(lastTime * 1000));
  const h = parseInt(parts.find(p => p.type === 'hour').value);
  const m = parseInt(parts.find(p => p.type === 'minute').value);
  const currentET = h + m / 60;

  const targetET = 20;
  if (currentET >= targetET) return [];

  const hoursRemaining = targetET - currentET;
  const secondsRemaining = hoursRemaining * 3600;

  const timestamps = [];
  let t = lastTime + intervalSeconds;
  const endTime = lastTime + secondsRemaining;
  while (t <= endTime) {
    timestamps.push(t);
    t += intervalSeconds;
  }
  return timestamps;
}

/**
 * Scan chart data to find contiguous non-regular zones and
 * the exact transition points between sessions.
 */
function analyzeSessionData(data) {
  if (!data || data.length < 2) return { zones: [], boundaries: [] };

  const zones = [];
  const boundaries = [];
  let zoneStart = null;
  let zoneType = null;
  let prevType = getSessionType(data[0].time);

  if (prevType !== 'regular') {
    zoneStart = data[0].time;
    zoneType = prevType;
  }

  for (let i = 1; i < data.length; i++) {
    const curType = getSessionType(data[i].time);

    // Detect overnight gap: data jumps from afterhours to premarket (next day)
    // with a large time gap (>4 hours means overnight happened between points)
    const timeDiff = data[i].time - data[i - 1].time;
    const isOvernightGap = timeDiff > 4 * 3600 &&
      (prevType === 'afterhours' && curType === 'premarket');

    if (isOvernightGap) {
      // Close current afterhours zone
      if (zoneStart !== null) {
        zones.push({ startTime: zoneStart, endTime: data[i - 1].time, sessionType: zoneType });
      }
      // Insert overnight zone spanning the gap
      zones.push({ startTime: data[i - 1].time, endTime: data[i].time, sessionType: 'overnight' });
      boundaries.push({ before: data[i - 1].time, after: data[i].time, type: 'transition' });
      // Start new premarket zone
      zoneStart = data[i].time;
      zoneType = curType;
    } else if (curType !== prevType) {
      // Determine boundary icon type
      let bType;
      if (prevType === 'regular') bType = 'close';       // leaving regular → moon
      else if (curType === 'regular') bType = 'open';     // entering regular → sun
      else bType = 'transition';                          // e.g. afterhours → overnight

      boundaries.push({ before: data[i - 1].time, after: data[i].time, type: bType });

      // Close current zone if one is open
      if (zoneStart !== null) {
        zones.push({ startTime: zoneStart, endTime: data[i - 1].time, sessionType: zoneType });
        zoneStart = null;
        zoneType = null;
      }

      // Open new zone if entering non-regular
      if (curType !== 'regular') {
        zoneStart = data[i].time;
        zoneType = curType;
      }
    }
    prevType = curType;
  }

  if (zoneStart !== null) {
    zones.push({ startTime: zoneStart, endTime: data[data.length - 1].time, sessionType: zoneType });
  }

  return { zones, boundaries };
}

/* ── lightweight-charts series primitive ─────────────────────────── */

class SessionPaneView {
  constructor(source) { this._source = source; }
  zOrder() { return 'bottom'; }
  renderer() { return new SessionRenderer(this._source); }
}

class SessionRenderer {
  constructor(source) { this._source = source; }

  draw(target) {
    const { _zones: zones, _boundaries: boundaries, _chart: chart, _barHalfWidth: halfBar } = this._source;
    if ((!zones.length && !boundaries.length) || !chart) return;

    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const ts = chart.timeScale();
      const hpr = scope.horizontalPixelRatio;
      const hb = halfBar * hpr;
      const h = scope.bitmapSize.height;

      // 1. Fill session zones with type-specific colors
      for (const zone of zones) {
        const x1 = ts.timeToCoordinate(zone.startTime);
        const x2 = ts.timeToCoordinate(zone.endTime);
        if (x1 === null || x2 === null) continue;
        const bx1 = Math.round(x1 * hpr - hb);
        const bx2 = Math.round(x2 * hpr + hb);
        ctx.fillStyle = ZONE_COLORS[zone.sessionType] || ZONE_COLORS.premarket;
        ctx.fillRect(bx1, 0, bx2 - bx1, h);
      }

      // 2. Dashed boundary lines at session transitions
      ctx.save();
      ctx.strokeStyle = 'rgba(100, 140, 220, 0.30)';
      ctx.lineWidth = Math.max(1, Math.round(hpr));
      ctx.setLineDash([4 * hpr, 3 * hpr]);

      for (const b of boundaries) {
        const xBefore = ts.timeToCoordinate(b.before);
        const xAfter = ts.timeToCoordinate(b.after);
        if (xBefore === null || xAfter === null) continue;
        const bx = Math.round(((xBefore + xAfter) / 2) * hpr) + 0.5;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, h);
        ctx.stroke();
      }

      ctx.restore();

      // 3. "Overnight" label centered in overnight zones
      const labelSize = Math.round(10 * hpr);
      ctx.save();
      ctx.font = `${labelSize}px sans-serif`;
      ctx.fillStyle = 'rgba(180, 140, 255, 0.50)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const zone of zones) {
        if (zone.sessionType !== 'overnight') continue;
        const x1 = ts.timeToCoordinate(zone.startTime);
        const x2 = ts.timeToCoordinate(zone.endTime);
        if (x1 === null || x2 === null) continue;
        const cx = Math.round(((x1 + x2) / 2) * hpr);
        ctx.fillText('Overnight', cx, Math.round(h / 2));
      }
      ctx.restore();

      // 4. Moon / Sun icons at boundaries
      const iconSize = Math.round(14 * hpr);
      const iconY = h - Math.round(22 * hpr);
      const iconOffset = Math.round(12 * hpr);
      ctx.textBaseline = 'middle';
      ctx.font = `${iconSize}px sans-serif`;

      for (const b of boundaries) {
        if (b.type === 'transition') continue; // no icon for afterhours→overnight
        const xBefore = ts.timeToCoordinate(b.before);
        const xAfter = ts.timeToCoordinate(b.after);
        if (xBefore === null || xAfter === null) continue;
        const bx = Math.round(((xBefore + xAfter) / 2) * hpr);
        if (b.type === 'close') {
          ctx.textAlign = 'left';
          ctx.fillText('\u{1F319}', bx + iconOffset, iconY);
        } else {
          ctx.textAlign = 'right';
          ctx.fillText('\u{2600}\uFE0F', bx - iconOffset, iconY);
        }
      }
    });
  }
}

export class SessionHighlighter {
  constructor() {
    this._zones = [];
    this._boundaries = [];
    this._chart = null;
    this._barHalfWidth = 4;
    this._paneViews = [new SessionPaneView(this)];
    this._requestUpdate = null;
  }

  attached({ chart, series, requestUpdate }) {
    this._chart = chart;
    this._requestUpdate = requestUpdate;
  }

  detached() {
    this._chart = null;
    this._requestUpdate = null;
  }

  paneViews() {
    return this._paneViews;
  }

  updateAllViews() {
    if (this._chart) {
      const barSpacing = this._chart.timeScale().options().barSpacing;
      if (barSpacing) this._barHalfWidth = barSpacing / 2;
    }
  }

  setData(data) {
    const { zones, boundaries } = analyzeSessionData(data);
    this._zones = zones;
    this._boundaries = boundaries;
    if (this._requestUpdate) this._requestUpdate();
  }
}
