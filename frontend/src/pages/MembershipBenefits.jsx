import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
// ESLint's core unused-vars rule does not detect motion.* JSX member expressions.
/* eslint-disable-next-line no-unused-vars */
import { motion } from "framer-motion";
import clubBg from "../assets/membership.png";
import PlanCard, { GoldWaveWatermark } from "../components/PlanCard.jsx";
import { getPlans } from "../lib/plansApi.js";
import { mapPlanToCard } from "../lib/planCardData.js";
import "./MembershipBenefits.css";

/* ── Main MembershipBenefits Component ── */
export default function MembershipBenefits() {
  const heroRef = useRef(null);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');

  useEffect(() => {
    let active = true;
    getPlans()
      .then((catalog) => active && setPlans(catalog))
      .catch((error) => active && setPlansError(error.message || 'Could not load membership plans.'))
      .finally(() => active && setPlansLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let isActive = true;
    let ctx;
    const initGsap = async () => {
      try {
        const { default: gsap } = await import("gsap");
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        if (!isActive) return;
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ ignoreMobileResize: true });

        ctx = gsap.context(() => {
          // Parallax effect on hero background
          gsap.to(".mb-hero__bg", {
            yPercent: 18,
            ease: "none",
            scrollTrigger: {
              trigger: heroRef.current || ".mb-hero",
              start: "top top",
              end: "bottom top",
              scrub: true,
              invalidateOnRefresh: true,
            },
          });

          // Floating embers/particles in hero
          gsap.utils.toArray(".mb-hero-particle").forEach((particle, idx) => {
            gsap.to(particle, {
              y: -(35 + idx * 12),
              x: idx % 2 === 0 ? 16 : -16,
              opacity: 0,
              duration: 2.4 + idx * 0.4,
              repeat: -1,
              ease: "power1.inOut",
              delay: idx * 0.4,
            });
          });
        }, heroRef);
      } catch (err) {
        console.warn("GSAP loading skipped:", err);
      }
    };

    initGsap();
    return () => {
      isActive = false;
      ctx?.revert();
    };
  }, []);

  return (
    <main className="mb-page">
      {/* ══ HERO SECTION ══════════════════════════════════════ */}
      <section className="mb-hero" ref={heroRef}>
        <div
          className="mb-hero__bg"
          style={{ backgroundImage: `url(${clubBg})` }}
        />
        <div className="mb-hero__overlay" />

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <span
            key={i}
            className="mb-hero-particle"
            style={{
              left: `${15 + i * 14}%`,
              bottom: `${18 + (i % 3) * 12}%`,
            }}
          />
        ))}

        <div className="mb-hero__content">
          <motion.h1
            className="mb-hero__title"
            initial={{ opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          >
            Absolute Privacy
          </motion.h1>

          <motion.p
            className="mb-hero__subtitle"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            Distinctive privileges in an exclusive club offering premium amenities, bespoke recreation, and personalized assistance. Orianaa Club is crafted to endure as your lasting family legacy.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
          >
            <Link to="/luxury-membership" className="mb-hero__cta">
              Join Membership
            </Link>
          </motion.div>
        </div>
      </section>


      {/* ══ MEMBERSHIP PLANS ══════════════════════════════════ */}
      <section className="mb-plans-section" id="membership-plans">
        <div className="mb-plans-header">
          <motion.h2
            className="mb-plans-title"
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            Membership Plans
          </motion.h2>
          <motion.p
            className="mb-plans-subtitle"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            Find the membership made for you
          </motion.p>

          {/* Points Cohort Explainer Bar */}
          <motion.div
            className="mb-points-guide"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.25 }}
          >
            <div className="mb-points-guide__step">
              <span className="mb-points-guide__tag mb-points-guide__tag--first">First 1,000 Members</span>
               <p>Early Bird Offer</p>
            </div>
            <div className="mb-points-guide__divider" />
            <div className="mb-points-guide__step">
              <span className="mb-points-guide__tag mb-points-guide__tag--after">After 1,000 Members</span>
               <p>Tier 2 Advantage</p>
            </div>
            <div className="mb-points-guide__divider" />
            <div className="mb-points-guide__step">
              <span className="mb-points-guide__tag mb-points-guide__tag--default">Default Points</span>
              <p>Standard baseline points awarded for all subsequent members.</p>
            </div>
          </motion.div>
        </div>

        {/* 8 Cards Grid */}
        <div className="mb-plans-grid">
          {plansLoading && <p role="status">Loading membership plans…</p>}
          {plansError && <p role="alert">{plansError}</p>}
          {!plansLoading && !plansError && plans.length === 0 && <p>No membership plans are available right now.</p>}
          {plans.map((plan, index) => (
            <PlanCard key={plan.id} plan={mapPlanToCard(plan)} index={index} buttonLabel="Join Membership" to="/luxury-membership" />
          ))}
        </div>
      </section>

      
    </main>
  );
}