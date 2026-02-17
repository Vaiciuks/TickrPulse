import { useState } from 'react';

const LOGO_URL = 'https://assets.parqet.com/logos/symbol';

// Deterministic color from symbol string
const COLORS = [
  '#5B8DEF', '#E06C75', '#61AFEF', '#C678DD', '#56B6C2',
  '#D19A66', '#98C379', '#E5C07B', '#BE5046', '#7C8DA5',
];

function getColor(symbol) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function StockLogo({ symbol, size = 28 }) {
  const [failed, setFailed] = useState(false);
  const letter = (symbol || '?')[0];
  const color = getColor(symbol || '');

  if (failed) {
    return (
      <span
        className="stock-logo stock-logo-fallback"
        style={{ width: size, height: size, fontSize: size * 0.44, background: color }}
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      className="stock-logo"
      src={`${LOGO_URL}/${symbol}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
