import { useRef, useState, useEffect } from "react";

export default function MagneticElement({ children, className = "" }) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e) => {
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);

    // Max pull distance
    setPosition({ x: middleX * 0.2, y: middleY * 0.2 });
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };

  const { x, y } = position;

  return (
    <div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      className={className}
      style={{
        position: "relative",
        transform: `translate(${x}px, ${y}px)`,
        transition:
          x === 0 && y === 0
            ? "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)"
            : "transform 0.1s cubic-bezier(0.1, 0, 0.1, 1)",
        display: "inline-block",
      }}
    >
      {children}
    </div>
  );
}
