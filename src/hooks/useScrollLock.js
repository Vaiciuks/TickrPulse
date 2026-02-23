import { useEffect, useRef } from "react";

/**
 * iOS Safari ignores `overflow: hidden` on body for scroll prevention.
 * This hook uses `position: fixed` on body which fully prevents scrolling
 * on all platforms including iOS Safari, and restores scroll position on unlock.
 */
export function useScrollLock(active) {
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    scrollYRef.current = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollYRef.current);
    };
  }, [active]);
}

/** Imperative lock/unlock for non-hook contexts (e.g. drag handlers) */
export function lockScroll() {
  const y = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${y}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.overflow = "hidden";
  return y;
}

export function unlockScroll(scrollY) {
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.overflow = "";
  window.scrollTo(0, scrollY);
}
