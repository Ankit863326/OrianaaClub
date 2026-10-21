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
    let ctx;
    const initGsap = async () => {
      try {
        const { default: gsap } = await import("gsap");
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        gsap.registerPlugin(ScrollTrigger);

        ctx = gsap.context(() => {
          // Parallax effect on hero background
          gsap.to(".mb-hero__bg", {
            yPercent: 25,
            ease: "none",
            scrollTrigger: {
              trigger: ".mb-hero",
              start: "top top",
              end: "bottom top",
              scrub: true,
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
        });
      } catch (err) {
        console.warn("GSAP loading skipped:", err);
      }
    };

    initGsap();
    return () => ctx && ctx.revert();
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
            Key privileges in an exclusive club placed with unique amenities, recreation and curated assistance. Orianaa Club is all about legacy.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
          >
            <Link to="/luxury-membership" className="mb-hero__cta">
              Buy Membership
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
              <p>Highest early-bird joining advantage — up to 2.50× multiplier in points.</p>
            </div>
            <div className="mb-points-guide__divider" />
            <div className="mb-points-guide__step">
              <span className="mb-points-guide__tag mb-points-guide__tag--after">After 1,000 Members</span>
              <p>Phase-two bonus points as initial member capacity fills.</p>
            </div>
            <div className="mb-points-guide__divider" />
            <div className="mb-points-guide__step">
              <span className="mb-points-guide__tag mb-points-guide__tag--default">Default Points</span>
              <p>Standard baseline points awarded for all subsequent members (1 Pt = ₹1).</p>
            </div>
          </motion.div>
        </div>

        {/* 8 Cards Grid */}
        <div className="mb-plans-grid">
          {plansLoading && <p role="status">Loading membership plans…</p>}
          {plansError && <p role="alert">{plansError}</p>}
          {!plansLoading && !plansError && plans.length === 0 && <p>No membership plans are available right now.</p>}
          {plans.map((plan, index) => (
            <PlanCard key={plan.id} plan={mapPlanToCard(plan)} index={index} buttonLabel="Buy Membership" to="/luxury-membership" />
          ))}
        </div>
      </section>

      {/* ══ JOIN THE ORIANAA CLUB ══════════════════════════════ */}
      <section className="mb-join-section">
        <div className="mb-join-card">
          <motion.div
            className="mb-join-image-wrap"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-70px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <img
              src="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=85"
              alt="Orianaa Club bedroom suite"
              className="mb-join-image"
            />
          </motion.div>

          <motion.div
            className="mb-join-content"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-70px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="mb-join-title">
              Join The
              <br />
              Orianaa Club
            </h2>
            <p className="mb-join-desc">
              Join our circle for private invitations and stories from the Orianaa world.
            </p>
            <Link to="/luxury-membership" className="mb-join-btn">
              Contact Us
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
}