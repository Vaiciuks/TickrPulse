import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Creates a burst of particles at the specified coordinates.
 */
export function useParticleBurst() {
  const [particles, setParticles] = useState([]);

  const triggerBurst = (x, y, color = "var(--accent-primary)", count = 12) => {
    const newParticles = Array.from({ length: count }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / count;
      const velocity = 2 + Math.random() * 2;
      const tx = Math.cos(angle) * velocity * 20;
      const ty = Math.sin(angle) * velocity * 20;
      const size = 3 + Math.random() * 4;

      return {
        id: Date.now() + i,
        x,
        y,
        tx,
        ty,
        color,
        size,
      };
    });

    setParticles((prev) => [...prev, ...newParticles]);

    // Cleanup particles after animation completes
    setTimeout(() => {
      setParticles((prev) =>
        prev.filter((p) => !newParticles.find((np) => np.id === p.id)),
      );
    }, 600);
  };

  const ParticleOverlay = () => {
    if (particles.length === 0) return null;

    return createPortal(
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 9999,
        }}
      >
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle-point"
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: "50%",
              // The animation is powered by passing CSS variables to the stylesheet
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
            }}
          />
        ))}
      </div>,
      document.body,
    );
  };

  return { triggerBurst, ParticleOverlay };
}
