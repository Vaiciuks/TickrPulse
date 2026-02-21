/**
 * Custom lightweight-charts series that renders candlesticks with rounded bodies.
 * Compatible with the same { time, open, high, low, close } data format.
 */

class RoundedCandleRenderer {
  constructor() {
    this._data = null;
    this._options = null;
  }

  update(data, options) {
    this._data = data;
    this._options = options;
  }

  draw(target, priceConverter) {
    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const data = this._data;
      if (!data?.bars || !data.visibleRange) return;

      const bars = data.bars;
      const barSpacing = data.barSpacing;
      const hRatio = scope.horizontalPixelRatio;
      const vRatio = scope.verticalPixelRatio;

      const bodyWidthPx = Math.max(1, barSpacing * 0.75 * hRatio);
      const halfBody = bodyWidthPx / 2;
      const wickWidth = Math.max(1, hRatio);
      const upColor = this._options.upColor || '#00d66b';
      const downColor = this._options.downColor || '#ff2952';
      const radius = this._options.radius ?? 2.5;

      for (let i = data.visibleRange.from; i < data.visibleRange.to; i++) {
        const bar = bars[i];
        const d = bar.originalData;
        if (d.close == null) continue;

        const openY = priceConverter(d.open);
        const closeY = priceConverter(d.close);
        const highY = priceConverter(d.high);
        const lowY = priceConverter(d.low);
        if (openY == null || closeY == null || highY == null || lowY == null) continue;

        const x = bar.x * hRatio;
        const oY = openY * vRatio;
        const cY = closeY * vRatio;
        const hY = highY * vRatio;
        const lY = lowY * vRatio;

        const isUp = d.close >= d.open;
        const color = isUp ? upColor : downColor;

        const bodyTop = Math.min(oY, cY);
        const bodyBottom = Math.max(oY, cY);
        const bodyHeight = Math.max(bodyBottom - bodyTop, wickWidth);

        // Wick
        ctx.fillStyle = color;
        ctx.fillRect(x - wickWidth / 2, hY, wickWidth, lY - hY);

        // Rounded body
        const r = Math.min(radius * hRatio, halfBody, bodyHeight / 2);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x - halfBody, bodyTop, bodyWidthPx, bodyHeight, r);
        } else {
          // Fallback for older browsers
          const bx = x - halfBody;
          ctx.moveTo(bx + r, bodyTop);
          ctx.lineTo(bx + bodyWidthPx - r, bodyTop);
          ctx.arcTo(bx + bodyWidthPx, bodyTop, bx + bodyWidthPx, bodyTop + r, r);
          ctx.lineTo(bx + bodyWidthPx, bodyTop + bodyHeight - r);
          ctx.arcTo(bx + bodyWidthPx, bodyTop + bodyHeight, bx + bodyWidthPx - r, bodyTop + bodyHeight, r);
          ctx.lineTo(bx + r, bodyTop + bodyHeight);
          ctx.arcTo(bx, bodyTop + bodyHeight, bx, bodyTop + bodyHeight - r, r);
          ctx.lineTo(bx, bodyTop + r);
          ctx.arcTo(bx, bodyTop, bx + r, bodyTop, r);
          ctx.closePath();
        }
        ctx.fill();
      }
    });
  }
}

export class RoundedCandleSeries {
  constructor() {
    this._renderer = new RoundedCandleRenderer();
  }

  priceValueBuilder(plotRow) {
    return [plotRow.high, plotRow.low, plotRow.close];
  }

  isWhitespace(data) {
    return data.close === undefined;
  }

  renderer() {
    return this._renderer;
  }

  update(data, options) {
    this._renderer.update(data, options);
  }

  defaultOptions() {
    return {
      upColor: '#00d66b',
      downColor: '#ff2952',
      radius: 2.5,
    };
  }
}
