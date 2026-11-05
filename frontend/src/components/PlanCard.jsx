// Shared plan card used by the public benefits page and membership flow.
// ESLint's core unused-vars rule does not detect the motion.article JSX member.
/* eslint-disable-next-line no-unused-vars */
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useRef } from 'react';
import './PlanCard.css';

export function GoldWaveWatermark({ className = '', isDark = false }) {
  const strokeColor = isDark ? 'rgba(226, 173, 50, 0.45)' : 'rgba(226, 173, 50, 0.35)';
  const strokeColorLight = isDark ? 'rgba(241, 217, 156, 0.6)' : 'rgba(197, 153, 58, 0.4)';

  return (
    <svg
      className={`gold-wave-watermark ${className}`}
      viewBox="0 0 320 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M -20 200 C 60 180, 110 90, 190 120 C 260 145, 290 60, 340 40" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M -30 220 C 50 200, 100 110, 180 140 C 250 165, 280 80, 330 60" stroke={strokeColorLight} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M -10 240 C 70 220, 120 130, 200 160 C 270 185, 300 100, 350 80" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M 10 260 C 90 240, 140 150, 220 180 C 290 205, 320 120, 370 100" stroke={strokeColorLight} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function TierEmblemIcon({ isDark = false }) {
  return (
    <span className={`tier-emblem ${isDark ? 'tier-emblem--dark' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8.5 12.2L10.8 14.5L15.5 9.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function PlanCard({
  plan,
  index = 0,
  buttonLabel,
  onSelect,
  to,
  selected = false,
  disabled = false,
  featured,
  visible = false,
}) {
  const cardRef = useRef(null);
  const isInView = useInView(cardRef, { once: true, margin: '-60px' });
  const isFeatured = featured ?? Boolean(plan.isFeatured);
  const buttonClassName = `mb-card__btn ${isFeatured ? 'mb-card__btn--white' : 'mb-card__btn--green'}`;
  const label = selected ? 'Selected' : buttonLabel;
  const cohorts = Array.isArray(plan.cohorts) ? plan.cohorts : [];

  return (
    <motion.article
      ref={cardRef}
      className={`mb-card${isFeatured ? ' mb-card--featured' : ''}${selected ? ' mb-card--selected' : ''}`}
      initial={visible ? false : { opacity: 0, y: 40 }}
      animate={visible || isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.65, delay: (index % 3) * 0.12, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
    >
      <GoldWaveWatermark isDark={isFeatured} />

      {selected && <span className="mb-card__selected-badge">Selected</span>}
      <div className="mb-card__header">
        <h3 className="mb-card__title">{plan.title}</h3>
        <p className="mb-card__subtitle">{plan.subtitle}</p>
        <p className="mb-card__redemption-rate">1 Redemption point = 1 Rupee</p>
      </div>

      {cohorts.length > 0 && <div className="mb-card__cohorts">
        {cohorts.map((cohort, cohortIndex) => (
          <div key={`${cohort.label}-${cohortIndex}`} className="mb-card__cohort-item">
            <TierEmblemIcon isDark={isFeatured} />
            <div className="mb-card__cohort-info">
              {cohort.displayAmount && <span className="mb-card__cohort-amount">{cohort.displayAmount}</span>}
              <span className="mb-card__cohort-label">{cohort.label}</span>
            </div>
          </div>
        ))}
      </div>}

      <div className="mb-card__footer">
        <div className="mb-card__price">{plan.priceLabel}</div>
        {to ? (
          <Link to={to} className={buttonClassName}>{label}</Link>
        ) : (
          <button
            className={buttonClassName}
            type="button"
            onClick={onSelect}
            disabled={disabled}
            aria-pressed={selected}
          >
            {label}
          </button>
        )}
      </div>
    </motion.article>
  );
}
