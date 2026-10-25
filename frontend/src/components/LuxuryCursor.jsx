import React, { useEffect, useRef, useState } from "react";
import "./LuxuryCursor.css";

/**
 * Orianaa Club Bespoke "OC" Monogram Luxury Cursor
 * Compact, non-intrusive, sleek luxury cursor. Never balloons or obstructs content.
 */
export default function LuxuryCursor() {
  const [enabled, setEnabled] = useState(false);
  const [cursorState, setCursorState] = useState("default"); // 'default' | 'hover' | 'text' | 'clicking'
  const [isVisible, setIsVisible] = useState(false);
  const [ripples, setRipples] = useState([]);

  const posRef = useRef({ x: -100, y: -100 });
  const followerPosRef = useRef({ x: -100, y: -100 });
  const coreRef = useRef(null);
  const followerRef = useRef(null);
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animFrameRef = useRef(null);
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!isFinePointer) return;

    setEnabled(true);

    const canvas = canvasRef.current;
    let ctx = null;
    if (canvas) {
      ctx = canvas.getContext("2d");
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);

    const onMouseMove = (e) => {
      posRef.current.x = e.clientX;
      posRef.current.y = e.clientY;

      if (!isVisible) setIsVisible(true);

      // Core precision pinpoint moves with zero latency
      if (coreRef.current) {
        coreRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      // Detect interactive element states
      const target = e.target;
      if (target) {
        const isTextInput =
          target.tagName === "TEXTAREA" ||
          (target.tagName === "INPUT" &&
            !["button", "submit", "checkbox", "radio", "range"].includes(target.type)) ||
          target.isContentEditable;

        if (isTextInput) {
          setCursorState("text");
        } else {
          const clickable = target.closest(
            'a, button, [role="button"], input[type="submit"], input[type="button"], select, .home-nav__brand, [data-cursor="pointer"], [data-cursor-text]'
          );
          if (clickable) {
            setCursorState("hover");
          } else {
            setCursorState("default");
          }
        }
      }

      // Golden stardust particles trail (subtle, delicate)
      const now = performance.now();
      if (now - lastSpawnRef.current > 48 && particlesRef.current.length < 10) {
        lastSpawnRef.current = now;
        particlesRef.current.push({
          x: e.clientX + (Math.random() * 6 - 3),
          y: e.clientY + (Math.random() * 6 - 3),
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5 - 0.15,
          size: Math.random() * 1.5 + 1.0,
          alpha: 0.75,
          color: Math.random() > 0.4 ? "#D4A017" : "#F5E6C8",
          decay: Math.random() * 0.025 + 0.02,
        });
      }
    };

    const onMouseDown = (e) => {
      setCursorState((prev) => (prev === "text" ? "text" : "clicking"));
      const id = Date.now() + Math.random();
      setRipples((prev) => [...prev.slice(-2), { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 550);
    };

    const onMouseUp = (e) => {
      const target = e.target;
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          (target.tagName === "INPUT" &&
            !["button", "submit", "checkbox", "radio", "range"].includes(target.type)))
      ) {
        setCursorState("text");
      } else if (
        target &&
        target.closest(
          'a, button, [role="button"], input[type="submit"], input[type="button"], select, .home-nav__brand, [data-cursor="pointer"], [data-cursor-text]'
        )
      ) {
        setCursorState("hover");
      } else {
        setCursorState("default");
      }
    };

    const onMouseLeave = () => {
      setIsVisible(false);
    };

    const onMouseEnter = () => {
      setIsVisible(true);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown, { passive: true });
    window.addEventListener("mouseup", onMouseUp, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    // Smooth Lerp animation loop for follower & stardust
    const animate = () => {
      const targetX = posRef.current.x;
      const targetY = posRef.current.y;

      const currentX = followerPosRef.current.x;
      const currentY = followerPosRef.current.y;
      const ease = 0.22;
      const nextX = currentX + (targetX - currentX) * ease;
      const nextY = currentY + (targetY - currentY) * ease;
      followerPosRef.current.x = nextX;
      followerPosRef.current.y = nextY;

      if (followerRef.current) {
        followerRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
      }

      // Render stardust particles
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= p.decay;

          if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 4;
          ctx.shadowColor = "#D4A017";

          ctx.beginPath();
          ctx.moveTo(p.x, p.y - p.size);
          ctx.lineTo(p.x + p.size * 0.7, p.y);
          ctx.lineTo(p.x, p.y + p.size);
          ctx.lineTo(p.x - p.size * 0.7, p.y);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isVisible]);

  if (!enabled) return null;

  const followerClasses = [
    "orianaa-cursor-follower",
    cursorState === "hover" ? "is-hovering" : "",
    cursorState === "text" ? "is-text" : "",
    cursorState === "clicking" ? "is-clicking" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const coreClasses = [
    "orianaa-cursor-core",
    cursorState === "hover" ? "is-hovering" : "",
    cursorState === "text" ? "is-text" : "",
    cursorState === "clicking" ? "is-clicking" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="orianaa-cursor-root"
      style={{ opacity: isVisible ? 1 : 0, transition: "opacity 0.25s ease" }}
      aria-hidden="true"
    >
      {/* Golden Stardust Canvas */}
      <canvas ref={canvasRef} className="orianaa-cursor-canvas" />

      {/* Trailing Luxury Halo with Prominent Orianaa "OC" Monogram */}
      <div ref={followerRef} className={followerClasses}>
        <span className="orianaa-cursor-monogram">OC</span>
      </div>

      {/* Core Precision Pinpoint (Zero latency target tip) */}
      <div ref={coreRef} className={coreClasses}>
        <div className="orianaa-cursor-pinpoint" />
        <div className="orianaa-cursor-ibeam" />
      </div>

      {/* Click ripple animations */}
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          className="orianaa-cursor-ripple"
          style={{ transform: `translate3d(${ripple.x}px, ${ripple.y}px, 0)` }}
        />
      ))}
    </div>
  );
}
