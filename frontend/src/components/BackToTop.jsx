import React, { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "./ui/button";
import "./BackToTop.css";

const SCROLL_THRESHOLD = 520;

export default function BackToTop() {
  const [isVisible, setIsVisible] = useState(() => window.scrollY > SCROLL_THRESHOLD);

  useEffect(() => {
    let frameId = 0;
    const updateVisibility = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        const nextIsVisible = window.scrollY > SCROLL_THRESHOLD;
        setIsVisible((current) => current === nextIsVisible ? current : nextIsVisible);
        frameId = 0;
      });
    };

    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateVisibility);
    };
  }, []);

  const handleBackToTop = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? "instant" : "smooth" });
  };

  return (
    <Button
      className={`back-to-top${isVisible ? " is-visible" : ""}`}
      variant="ghost"
      size="icon"
      type="button"
      aria-label="Back to top"
      title="Back to top"
      aria-hidden={!isVisible}
      tabIndex={isVisible ? 0 : -1}
      onClick={handleBackToTop}
    >
      <ArrowUp size={18} strokeWidth={1.7} aria-hidden="true" />
    </Button>
  );
}