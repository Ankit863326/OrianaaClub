import React, { useEffect, useRef } from "react";
import { motion as Motion, useInView } from "framer-motion";
import "./Experiences.css";

/* ─── Full Data from Figma ──────────────────────────────── */
const experiences = [
  {
    id: "dining",
    category: "Food & Dining",
    heading: "A Taste of Exceptional Living",
    description:
      "Discover thoughtfully curated dining experiences designed to bring together refined flavours, elegant settings, and memorable moments at every table.",
    tags: [
      "Fine Dining Restaurant",
      "Pure Vegetarian Restaurant",
      "Jain Food Available",
      "Outdoor Garden Dining",
      "Rooftop Restaurant",
      "Coffee Lounge & Café",
      "Bakery & Patisserie",
      "Live Barbecue",
      "Poolside Dining",
      "Sunday Brunch",
      "Private Candlelight Dinner",
      "Chef's Special Tasting Menu",
    ],
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=85",
  },
  {
    id: "wellness",
    category: "Wellness & Recreation",
    heading: "Restore. Rebalance. Renew.",
    description:
      "Step away from the everyday and embrace moments of calm through wellness experiences created for relaxation, rejuvenation, and mindful living.",
    tags: [
      "Luxury Spa",
      "Ayurvedic Treatments",
      "Massage Therapy",
      "Steam & Sauna",
      "Jacuzzi",
      "Yoga Deck",
      "Meditation Garden",
      "Fitness Center",
      "Health Club",
    ],
    image:
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1400&q=85",
  },
  {
    id: "sports",
    category: "Sports & Activities",
    heading: "Move. Play. Explore.",
    description:
      "From active pursuits to outdoor adventures, enjoy an exciting collection of recreational experiences for every age and interest.",
    tags: [
      "Swimming Pool",
      "Kids Pool",
      "Indoor Games",
      "Outdoor Sports",
      "Cricket Ground",
      "Football Turf",
      "Volleyball Court",
      "Badminton Court",
      "Basketball Court",
      "Tennis Court",
      "Pickleball Court",
      "Cycling",
      "Nature Trails",
      "Adventure Zone",
      "Rock Climbing",
      "Zip Line",
      "Archery",
      "ATV Rides",
      "Horse Riding",
      "Rain Dance",
      "Bonfire Area",
    ],
    image:
      "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1400&q=85",
  },
  {
    id: "family",
    category: "Family Entertainment",
    heading: "Moments Made for Togetherness",
    description:
      "Create unforgettable family memories with entertainment, activities, and shared experiences designed to bring everyone closer.",
    tags: [
      "Children's Play Area",
      "Kids Club",
      "Gaming Zone",
      "Movie Nights",
      "Live Music",
      "Cultural Programs",
      "DJ Nights",
      "Open Air Theatre",
      "Weekend Entertainment",
    ],
    image:
      "https://images.unsplash.com/photo-1504150558240-0b4fd8946624?auto=format&fit=crop&w=1400&q=85",
  },
  {
    id: "weddings",
    category: "Weddings & Celebrations",
    heading: "Celebrate Life's Finest Moments",
    description:
      "From intimate celebrations to grand destination weddings, create beautifully considered occasions surrounded by elegance and memorable hospitality.",
    tags: [
      "Grand Banquet Hall",
      "Premium Wedding Lawn",
      "Destination Wedding Packages",
      "Reception Packages",
      "Engagement Ceremony",
      "Haldi Ceremony Setup",
      "Mehendi Setup",
      "Sangeet Stage",
      "Bridal Suite",
      "Groom Lounge",
      "Wedding Planning Assistance",
      "Décor Services",
      "Catering Services",
      "Photography & Videography",
      "Artist & Celebrity Performances",
    ],
    image:
      "https://cdn0.weddingwire.in/article/1478/3_2/960/jpg/78741-intimate-weddings-creative-wedding-photography-lead-image.jpeg",
  },
  {
    id: "corporate",
    category: "Corporate Facilities",
    heading: "Business, Beautifully Hosted",
    description:
      "Bring teams together in an inspiring resort environment with thoughtfully designed spaces for meetings, retreats, conferences, and celebrations.",
    tags: [
      "Conference Hall",
      "Board Room",
      "Meeting Rooms",
      "Corporate Retreat Packages",
      "Team Building Activities",
      "Product Launch Events",
      "Annual Conferences",
      "Training Programs",
      "High-Speed Internet",
      "Audio Visual Equipment",
    ],
    image:
      "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=85",
  },
];

/* ─── Animation Variants ─────────────────────────────────── */
const fadeLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.82, ease: [0.22, 1, 0.36, 1] } },
};

const fadeRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.82, ease: [0.22, 1, 0.36, 1] } },
};

const staggerTags = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.35 } },
};

const tagVariant = {
  hidden: { opacity: 0, scale: 0.8, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.4, ease: "backOut" } },
};

/* ─── Experience Row ─────────────────────────────────────── */
function ExperienceRow({ exp, index }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const isAlt = index % 2 === 1; // alternate bg only, layout stays image-left

  return (
    <div ref={ref} className={`exp-row ${isAlt ? "exp-row--alt" : ""}`}>
      {/* ── Image ── */}
      <Motion.div
        className="exp-row__image-wrap"
        variants={fadeLeft}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
      >
        <Motion.img
          src={exp.image}
          alt={exp.category}
          className="exp-row__image"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="exp-row__img-overlay" />
      </Motion.div>

      {/* ── Content ── */}
      <Motion.div
        className="exp-row__content"
        variants={fadeRight}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
      >
        {/* Category eyebrow */}
        <Motion.p
          className="exp-row__category"
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.18 }}
        >
          {exp.category}
        </Motion.p>

        {/* Main heading */}
        <Motion.h2
          className="exp-row__heading"
          initial={{ opacity: 0, y: 22 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, delay: 0.26 }}
        >
          {exp.heading}
        </Motion.h2>

        {/* Gold rule */}
        <Motion.div
          className="exp-row__line"
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 0.65, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Description */}
        <Motion.p
          className="exp-row__desc"
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.38 }}
        >
          {exp.description}
        </Motion.p>

        {/* ALL Tags */}
        <Motion.div
          className="exp-row__tags"
          variants={staggerTags}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          {exp.tags.map((tag) => (
            <Motion.span
              key={tag}
              className="exp-row__tag"
              variants={tagVariant}
              whileHover={{
                scale: 1.08,
                backgroundColor: "#e2ad32",
                color: "#111310",
                transition: { duration: 0.22 },
              }}
            >
              {tag}
            </Motion.span>
          ))}
        </Motion.div>

        {/* Join button */}
        <Motion.a
          href="/luxury-membership"
          className="exp-row__btn"
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.65 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
        >
          Explore <span>→</span>
        </Motion.a>
      </Motion.div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
const Experiences = () => {
  const heroRef = useRef(null);

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
          /* Parallax hero bg */
          gsap.to(".exp-hero__bg", {
            yPercent: 18,
            ease: "none",
            scrollTrigger: {
              trigger: heroRef.current || ".exp-hero",
              start: "top top",
              end: "bottom top",
              scrub: true,
              invalidateOnRefresh: true,
            },
          });

          /* Floating gold particles */
          gsap.utils.toArray(".exp-particle").forEach((el, i) => {
            gsap.to(el, {
              y: -(30 + i * 14),
              x: i % 2 === 0 ? 18 : -18,
              opacity: 0,
              duration: 2.2 + i * 0.35,
              repeat: -1,
              ease: "power1.inOut",
              delay: i * 0.45,
            });
          });
        }, heroRef);
      } catch (e) {
        console.warn("GSAP init failed:", e);
      }
    };
    initGsap();
    return () => {
      isActive = false;
      ctx?.revert();
    };
  }, []);

  return (
    <main className="exp-page">

      {/* ══ HERO ══════════════════════════════════════════════ */}
      <section className="exp-hero" ref={heroRef}>
        <div className="exp-hero__bg" />
        <div className="exp-hero__overlay" />

        {/* floating particles */}
        {[...Array(7)].map((_, i) => (
          <span
            key={i}
            className="exp-particle"
            style={{ left: `${12 + i * 12}%`, bottom: `${16 + (i % 3) * 13}%` }}
          />
        ))}

        <div className="exp-hero__content">
          <Motion.p
            className="exp-hero__eyebrow"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2 }}
          >
            THE SAPTAGIRI EXPERIENCE
          </Motion.p>

          <Motion.h1
            className="exp-hero__title"
            initial={{ opacity: 0, y: 44 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            Moments that
            <br />
            <em>become memories</em>
          </Motion.h1>

          <Motion.p
            className="exp-hero__sub"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.72 }}
          >
            Discover a world of refined experiences — from exquisite dining and
            restorative wellness to celebrations, adventures, and meaningful
            moments together.
          </Motion.p>

          <Motion.a
            href="/luxury-membership"
            className="exp-hero__cta"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.98 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
          >
            Join Membership
          </Motion.a>
        </div>

        <div className="exp-hero__scroll">
          <span />
          <p>Scroll to explore</p>
        </div>
      </section>

      {/* ══ OUR EXPERIENCES ═══════════════════════════════════ */}
      <section className="exp-section" id="our-experiences">
        <div className="exp-section__header">
          <Motion.p
            className="exp-section__kicker"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            DISCOVER
          </Motion.p>
          <Motion.h2
            className="exp-section__title"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.72, delay: 0.1 }}
          >
            Our Experiences
          </Motion.h2>
        </div>

        <div className="exp-rows">
          {experiences.map((exp, i) => (
            <ExperienceRow key={exp.id} exp={exp} index={i} />
          ))}
        </div>
      </section>

      {/* ══ JOIN THE ORIANAA CLUB ══════════════════════════════ */}
      <section className="exp-join">
        <div className="exp-join__card">
          <Motion.div
            className="exp-join__image-wrap"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.88, ease: [0.22, 1, 0.36, 1] }}
          >
            <img
              src="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=85"
              alt="Orianaa Club bedroom"
              className="exp-join__image"
            />
          </Motion.div>

          <Motion.div
            className="exp-join__content"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.88, ease: [0.22, 1, 0.36, 1] }}
          >
            <Motion.h2
              className="exp-join__heading"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              Join The<br />Orianaa Club
            </Motion.h2>

            <Motion.p
              className="exp-join__desc"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.34 }}
            >
              Join our circle for private invitations and stories from the
              Orianaa world.
            </Motion.p>

            <Motion.a
              href="/#enquiry"
              className="exp-join__btn"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.5 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
            >
              Contact Us
            </Motion.a>
          </Motion.div>
        </div>
      </section>
    </main>
  );
};

export default Experiences;
