import React from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { Compass, Home, Sparkles, ArrowRight, MapPin, Calendar, BookOpen } from "lucide-react";
import "./NotFound.css";

const quickLinks = [
  { label: "Resorts & Stays", to: "/resorts", icon: MapPin },
  { label: "Experiences", to: "/experiences", icon: Sparkles },
  { label: "Events", to: "/events", icon: Calendar },
  { label: "Club Journal", to: "/blog", icon: BookOpen },
];

export default function NotFound() {
  return (
    <main className="not-found" id="main-content" tabIndex={-1}>
      {/* Background ambient particles & glow */}
      <div className="not-found__particles" aria-hidden="true">
        <div className="not-found__particle" />
        <div className="not-found__particle" />
        <div className="not-found__particle" />
      </div>

      <Motion.div
        className="not-found__content"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Animated Compass Icon */}
        <Motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.7, ease: "easeOut" }}
          aria-hidden="true"
        >
          <svg className="not-found__compass" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="45" className="not-found__compass-ring" />
            <circle cx="50" cy="50" r="38" stroke="rgba(212, 160, 23, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
            {/* Compass rose needle */}
            <g className="not-found__compass-needle">
              <polygon points="50,14 55,50 50,44 45,50" fill="url(#needleGradGold)" />
              <polygon points="50,86 55,50 50,56 45,50" fill="rgba(255, 255, 255, 0.25)" />
            </g>
            <circle cx="50" cy="50" r="4.5" className="not-found__compass-center" />
            <defs>
              <linearGradient id="needleGradGold" x1="50" y1="14" x2="50" y2="50" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF8A3D" />
                <stop offset="1" stopColor="#D4A017" />
              </linearGradient>
            </defs>
          </svg>
        </Motion.div>

        {/* 404 Large Display */}
        <Motion.div
          className="not-found__code-wrapper"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          <div className="not-found__code" aria-label="Error 404">
            404
          </div>
          <hr className="not-found__rule" />
        </Motion.div>

        {/* Title & Description */}
        <Motion.h1
          className="not-found__heading"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
        >
          Destination Uncharted
        </Motion.h1>

        <Motion.p
          className="not-found__body"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.6 }}
        >
          The private retreat or page you are seeking does not exist or may have been relocated.
          Allow us to guide you back to familiar sanctuary.
        </Motion.p>

        {/* Suggested Quick Links */}
        <Motion.div
          className="not-found__suggestions"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.6 }}
        >
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.to} to={link.to} className="not-found__suggestion-link">
                <Icon className="not-found__suggestion-icon" aria-hidden="true" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </Motion.div>

        {/* Home Action Button */}
        <Motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.75, duration: 0.5 }}
        >
          <Link to="/" className="not-found__cta">
            <Home size={18} aria-hidden="true" />
            <span>Return to Homepage</span>
            <ArrowRight size={16} className="not-found__cta-icon" aria-hidden="true" />
          </Link>
        </Motion.div>
      </Motion.div>
    </main>
  );
}
