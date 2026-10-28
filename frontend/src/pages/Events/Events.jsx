import React, { useEffect, useRef, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import "./Events.css";
import { contentApi } from "../../lib/contentApi.js";
import { apiFileUrl } from "../../config/api.js";
import imagePlaceholder from "../../assets/image-placeholder.svg";

function handleImageError(event) {
  if (event.currentTarget.dataset.fallback) return;
  event.currentTarget.dataset.fallback = "true";
  event.currentTarget.src = imagePlaceholder;
}

/* ─── Full event catalogue (Wine & Cheese removed, renumbered 01 to 11) ─── */
const EVENTS = [
  {
    id: "weekend-festivals",
    no: "01",
    category: "Seasonal",
    title: "Weekend Festivals",
    subtitle: "A weekend worth remembering.",
    description: "Unwind into the weekend with thoughtfully curated celebrations, entertainment, dining and leisure moments designed for a memorable resort escape.",
    image: "https://images.unsplash.com/photo-1472653816316-3ad6f10a6592?q=85&w=1800&auto=format&fit=crop",
  },
  {
    id: "food-festivals",
    no: "02",
    category: "Culinary",
    title: "Food Festivals",
    subtitle: "Flavours. Stories. Gatherings.",
    description: "Celebrate the joy of food through specially curated culinary occasions, seasonal flavours and relaxed gatherings in beautiful resort settings.",
    image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?q=85&w=1800&auto=format&fit=crop",
  },
  {
    id: "live-concerts",
    no: "03",
    category: "Entertainment",
    title: "Live Concerts",
    subtitle: "Evenings that come alive.",
    description: "Settle into an atmosphere of music and celebration with live performances created to turn an evening at the resort into an occasion.",
    image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?q=85&w=1800&auto=format&fit=crop",
  },
  {
    id: "celebrity-nights",
    no: "04",
    category: "Exclusive",
    title: "Celebrity Nights",
    subtitle: "Exceptional evenings, elevated.",
    description: "Experience select evenings created around special appearances, entertainment and a distinctly celebratory resort atmosphere.",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=85&w=1800&auto=format&fit=crop",
  },
  {
    id: "kids-carnival",
    no: "05",
    category: "Family",
    title: "Kids Carnival",
    subtitle: "Little moments. Big memories.",
    description: "A lively family celebration filled with playful activities and entertainment designed to make resort time special for younger guests.",
    image: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=85&w=1800&auto=format&fit=crop",
  },
  {
    id: "christmas",
    no: "06",
    category: "Festive",
    title: "Christmas Celebration",
    subtitle: "A season of warmth and wonder.",
    description: "Celebrate the festive season with beautifully considered gatherings, family moments, entertainment and the spirit of Christmas.",
    image: "https://images.unsplash.com/photo-1545459720-aac8509eb7a4?q=85&w=1800&auto=format&fit=crop",
  },
  {
    id: "new-year",
    no: "07",
    category: "Festive",
    title: "New Year Gala",
    subtitle: "Welcome the year in style.",
    description: "Step into a celebratory New Year experience with an elegant atmosphere, entertainment and memorable moments shared together.",
    image: "https://images.unsplash.com/photo-1485872299829-c673f5194813?q=85&w=1800&auto=format&fit=crop",
  },
  {
    id: "holi",
    no: "08",
    category: "Festive",
    title: "Holi Festival",
    subtitle: "Colour, celebration and togetherness.",
    description: "Embrace the spirit of Holi with a vibrant resort celebration designed around colour, music, food and shared memories.",
    image: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?q=85&w=1800&auto=format&fit=crop",
  },
  {
    id: "diwali",
    no: "09",
    category: "Festive",
    title: "Diwali Celebration",
    subtitle: "A luminous celebration of togetherness.",
    description: "Celebrate Diwali with a festive resort atmosphere, beautiful moments, family gatherings and the warmth of the season.",
    image: "https://images.unsplash.com/photo-1605013726898-02f2d1b1a4b4?q=85&w=1800&auto=format&fit=crop",
  },
  {
    id: "monsoon",
    no: "10",
    category: "Seasonal",
    title: "Monsoon Festival",
    subtitle: "The season, beautifully experienced.",
    description: "Embrace the romance of the monsoon with seasonal experiences, relaxed gatherings and the pleasure of a refreshing resort escape.",
    image: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?q=85&w=1800&auto=format&fit=crop",
  },
  {
    id: "summer-camp",
    no: "11",
    category: "Family",
    title: "Summer Camp",
    subtitle: "A season of discovery.",
    description: "Make summer memorable with engaging family experiences, activities and moments designed to keep the season full of discovery.",
    image: "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?q=85&w=1800&auto=format&fit=crop",
  },
];

/* ─── EVENT CARD in catalogue ─── */
function EventCatalogueCard({ event, index, isActive, onClick }) {
  return (
    <Motion.article
      className={`ev2-event-card${isActive ? " ev2-event-card--active" : ""}`}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ delay: index * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      onClick={onClick}
    >
      <div className="ev2-event-card__media">
        <img src={event.image} alt={event.title} loading="lazy" onError={handleImageError} />
        <div className="ev2-event-card__media-overlay" />
        <span className="ev2-event-card__no">{event.no}</span>
        <span className="ev2-event-card__cat">{event.category}</span>
      </div>
      <div className="ev2-event-card__body">
        <h3 className="ev2-event-card__title">{event.title}</h3>
        <p className="ev2-event-card__sub">{event.subtitle}</p>
        <button type="button" className="ev2-event-card__btn" onClick={onClick}>
          Discover <ArrowRight size={13} />
        </button>
      </div>
    </Motion.article>
  );
}

export default function Events() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [activeEventId, setActiveEventId] = useState(null);
  const heroRef = useRef(null);
  const catalogueRef = useRef(null);
  const featuredRef = useRef(null);

  const activeEvent = events.find((event) => event.id === activeEventId) || events[0];

  useEffect(() => {
    let cancelled = false;
    contentApi.events({ limit: 100 })
      .then((response) => {
        if (cancelled) return;
        const records = (response.data?.items || []).map((event, index) => {
          const date = new Date(event.date);
          return {
            ...event,
            id: event._id,
            no: String(index + 1).padStart(2, "0"),
            category: event.location,
            subtitle: [event.time, date.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })].filter(Boolean).join(" · "),
            image: apiFileUrl(event.image) || EVENTS[index % EVENTS.length]?.image || "",
          };
        });
        setEvents(records);
        setActiveEventId(records[0]?.id || null);
      })
      .catch((error) => {
        if (!cancelled) setEventsError(error.message || "Events could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  /* GSAP date animation on mount */
  useEffect(() => {
    let ctx;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapMod, stMod]) => {
        const gsap = gsapMod.default;
        gsap.registerPlugin(stMod.ScrollTrigger);
        ctx = gsap.context(() => {
          gsap.from(".ev2-hero__date", { opacity: 0, y: -20, duration: 0.7, delay: 0.3, ease: "power3.out" });
        }, heroRef);
      }
    );
    return () => ctx?.revert();
  }, []);



  // const scrollToCatalogue = () => {
  //   catalogueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  // };

  /* When clicking an event card in the down grid section, update active event and redirect/scroll to the Events & Celebrations featured spotlight */
  const handleEventSelect = (eventId) => {
    setActiveEventId(eventId);
    featuredRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <main className="ev2-page">

      {/* ========================================================
          HERO SECTION — Weddings & Milestones Full Background Image & Clean Text
      ======================================================== */}
      <section className="ev2-hero" ref={heroRef} aria-labelledby="ev2-hero-title">
        {/* Weddings & Milestones full-area background image */}
        <div
          className="ev2-hero__bg"
          style={{
            backgroundImage: `url("https://images.unsplash.com/photo-1617184003170-4c9fc60cdb75?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D")`,
          }}
          aria-hidden="true"
        />

        <div className="ev2-hero__overlay" aria-hidden="true" />

        <div className="ev2-hero__inner">
          {/* TOP / OVERLAY CONTENT */}
          <div className="ev2-hero__copy">
            <Motion.p
              className="ev2-hero__date"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <Sparkles size={12} className="ev2-sparkle" />
              {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </Motion.p>

            <Motion.div
              className="ev2-hero__text-group"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="ev2-hero__tag">A world of privileges awaits.</span>
              <h1 className="ev2-hero__heading" id="ev2-hero-title">
                Events & Celebrations
              </h1>
              <p className="ev2-hero__sub">A 25-year lifestyle membership</p>
              <p className="ev2-hero__desc">
                Grand celebrations tailored to perfection amidst serene resort landscapes and unforgettable luxury ambiance.
              </p>
            </Motion.div>

            <div className="ev2-hero__actions">
              <Motion.button
                type="button"
                className="ev2-hero__membership-btn"
                onClick={() => navigate("/luxury-membership")}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                Buy Membership
              </Motion.button>
            </div>
          </div>
        </div>
      </section>


      {/* ========================================================
          EVENTS CATALOGUE — Full Grid
      ======================================================== */}
      <section className="ev2-catalogue" ref={catalogueRef} id="events-catalogue">
        <div className="ev2-catalogue__inner">

          {/* Header */}
          <Motion.div
            className="ev2-catalogue__header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="ev2-eyebrow">
              <Sparkles size={12} className="ev2-sparkle-dark" /> The Orianaa Calendar
            </p>
            <h2 className="ev2-catalogue__title">Events & Celebrations</h2>
            <p className="ev2-catalogue__sub">
              A curated calendar of celebrations, culinary occasions, cultural moments
              and memorable experiences — exclusively for members.
            </p>
          </Motion.div>

          {/* Featured active card Spotlight (Events & Celebrations Detail) */}
          <div ref={featuredRef} id="events-featured">
            <AnimatePresence mode="wait">
              {activeEvent ? <Motion.article
                key={activeEventId}
                className="ev2-featured"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="ev2-featured__media">
                  <Motion.img
                    key={activeEvent.image}
                    src={activeEvent.image}
                    onError={handleImageError}
                    alt={activeEvent.title}
                    initial={{ scale: 1.1, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <div className="ev2-featured__media-shade" />
                  <span className="ev2-featured__no">{activeEvent.no}</span>
                  <span className="ev2-featured__cat-badge">{activeEvent.category}</span>
                </div>
                <div className="ev2-featured__copy">
                  <Motion.p
                    className="ev2-eyebrow"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15, duration: 0.5 }}
                  >
                    Featured Occasion
                  </Motion.p>
                  <Motion.h2
                    initial={{ opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {activeEvent.title}
                  </Motion.h2>
                  <Motion.p
                    className="ev2-featured__subtitle"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                  >
                    {activeEvent.subtitle}
                  </Motion.p>
                  <Motion.p
                    className="ev2-featured__desc"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.38, duration: 0.5 }}
                  >
                    {activeEvent.description}
                  </Motion.p>
                  <Motion.div
                    className="ev2-featured__divider"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.45, duration: 0.55 }}
                  />
                  <Motion.button
                    type="button"
                    className="ev2-featured__btn"
                    onClick={() => navigate("/luxury-membership")}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.52, duration: 0.5 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Book This Experience <ArrowRight size={15} />
                  </Motion.button>
                </div>
              </Motion.article> : (
                <div className="ev2-content-state" role={eventsError ? "alert" : "status"}>
                  {eventsLoading ? "Loading events…" : eventsError || "No upcoming events have been announced yet."}
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Grid of Events */}
          <div className="ev2-events-grid">
            {events.map((event, i) => (
              <EventCatalogueCard
                key={event.id}
                event={event}
                index={i}
                isActive={activeEventId === event.id}
                onClick={() => handleEventSelect(event.id)}
              />
            ))}
          </div>
          {!eventsLoading && !eventsError && events.length === 0 && <p className="ev2-content-state">No upcoming events have been announced yet.</p>}
        </div>
      </section>

      {/* ========================================================
          MANIFESTO / CINEMATIC BANNER
      ======================================================== */}
      <section className="ev2-manifesto" aria-label="Our philosophy">
        <div className="ev2-manifesto__bg" aria-hidden="true" />
        <div className="ev2-manifesto__overlay" aria-hidden="true" />
        <div className="ev2-manifesto__inner">
          <Motion.p
            className="ev2-manifesto__eyebrow"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Sparkles size={12} /> The Orianaa Way
          </Motion.p>
          <Motion.h2
            className="ev2-manifesto__heading"
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            Come for the occasion.<br />
            <em>Leave with a memory.</em>
          </Motion.h2>
          <Motion.p
            className="ev2-manifesto__sub"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            Beautiful settings, thoughtful details and experiences designed around the people who matter.
          </Motion.p>
        </div>
      </section>

      
    </main>
  );
}
