import { useState, useEffect, useRef } from 'react';

/**
 * Smoothly animates a number from its current value to a new target.
 * Uses requestAnimationFrame with cubic ease-out for a premium feel.
 * Duration is kept short (300ms) so updates feel snappy, not sluggish.
 */
export function useAnimatedNumber(target, duration = 300) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef(null);
  const currentRef = useRef(target);
  const isFirstRef = useRef(true);

  useEffect(() => {
    // Don't animate on mount — just snap to initial value
    if (isFirstRef.current) {
      isFirstRef.current = false;
      currentRef.current = target;
      setDisplay(target);
      return;
    }

    // Same value — nothing to animate
    if (target === currentRef.current) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const from = currentRef.current;
    const start = performance.now();

    const animate = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / duration, 1);
      // Cubic ease-out: fast start, gentle settle
      const eased = 1 - Math.pow(1 - t, 3);
      const val = from + (target - from) * eased;
      currentRef.current = val;
      setDisplay(val);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return display;
}
