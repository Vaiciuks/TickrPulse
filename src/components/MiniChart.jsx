import { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

export default function MiniChart({ symbol, isPositive = true, data }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 120,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      handleScroll: false,
      handleScale: false,
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
    });

    const series = chart.addAreaSeries({
      lineColor: isPositive ? '#00c853' : '#ff1744',
      topColor: isPositive ? 'rgba(0, 200, 83, 0.3)' : 'rgba(255, 23, 68, 0.3)',
      bottomColor: isPositive ? 'rgba(0, 200, 83, 0.0)' : 'rgba(255, 23, 68, 0.0)',
      lineWidth: 2,
    });

    const lineData = data.map(d => ({ time: d.time, value: d.close }));
    series.setData(lineData);

    // Mini volume bars at the bottom
    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
      drawTicks: false,
      borderVisible: false,
    });
    volSeries.setData(data.map(d => ({
      time: d.time,
      value: d.volume || 0,
      color: d.close >= d.open ? 'rgba(0,200,83,0.18)' : 'rgba(255,23,68,0.18)',
    })));

    chart.timeScale().fitContent();

    chartRef.current = chart;

    // Hide TradingView watermark on mini charts
    const watermark = containerRef.current.querySelector('a[href*="tradingview"]');
    if (watermark) {
      watermark.style.cssText = 'opacity:0 !important; pointer-events:none !important;';
    }

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  return (
    <div className="mini-chart" ref={containerRef}>
      {!data && <div className="mini-chart-loading" />}
    </div>
  );
}
