import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, ChevronRight, X, Maximize2, Users, Bed, Eye, Sparkles } from "lucide-react";
import { Button } from "../../components/ui/button";
import LuxuryContactDrawer from "../../components/LuxuryContactDrawer";
import "./RoomCategories.css";

const roomCategories = [
  {
    id: "deluxe-room",
    name: "Deluxe Rooms",
    shortName: "Deluxe",
    eyebrow: "Saptagiri Resorts",
    tagline: "Serene & Sophisticated",
    description:
      "A thoughtfully appointed room for members seeking comfort, calm interiors, and a restful stay close to nature.",
    longDescription:
      "The Deluxe Room pairs contemporary design with a warm, welcoming atmosphere. Thoughtful furnishings and comfortable sleeping space create a restful setting for couples and leisure travellers.",
    size: "420 sq. ft.",
    guests: "Up to 3 Guests",
    bed: "King Bed",
    view: "Garden View",
    featured: false,
    images: [
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=85&w=1800&auto=format&fit=crop",
    ],
    amenities: [
      "King-size bed",
      "High-speed Wi-Fi",
      "Smart TV",
      "Luxury bathroom",
      "Nature-view balcony",
      "24×7 room service",
      "In-room tea & coffee",
    ],
  },
  {
    id: "premium-deluxe",
    name: "Premium Deluxe Rooms",
    shortName: "Premium Deluxe",
    eyebrow: "Saptagiri Resorts",
    tagline: "Bespoke Artistry & Comfort",
    description:
      "A spacious room with elegant interiors, added comforts, and scenic views for a memorable resort stay.",
    longDescription:
      "The Premium Deluxe Room offers generous living space, considered details, and a peaceful atmosphere for a relaxed resort stay.",
    size: "480 sq. ft.",
    guests: "Up to 3 Guests",
    bed: "King Bed",
    view: "Scenic Nature View",
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1591088398332-8a7791972843?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=85&w=1800&auto=format&fit=crop",
    ],
    amenities: [
      "Premium king-size bed",
      "High-speed Wi-Fi",
      "Smart TV",
      
      "Luxury bathroom amenities",
      "Private balcony",
      "24×7 room service",
      "Work desk",
    ],
  },
  {
    id: "executive-room",
    name: "Executive Rooms",
    shortName: "Executive",
    eyebrow: "Saptagiri Resorts",
    tagline: "Refined Functionality & Elegance",
    description:
      "A comfortable room for guests who value space, privacy, and a practical place to work or unwind.",
    longDescription:
      "The Executive Room brings together considered interiors and practical features. It suits business travellers, couples, and guests planning a longer stay.",
    size: "520 sq. ft.",
    guests: "Up to 3 Guests",
    bed: "King Bed",
    view: "Resort View",
    featured: false,
    images: [
      "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?q=85&w=1800&auto=format&fit=crop",
    ],
    amenities: [
      "King-size bed",
      "Dedicated work desk",
      "High-speed Wi-Fi",
      "Smart TV",
      
      "Premium bathroom",
      "Seating area",
      "24×7 room service",
    ],
  },
  {
    id: "luxury-suite",
    name: "Luxury Suites",
    shortName: "Luxury Suite",
    eyebrow: "Saptagiri Resorts",
    tagline: "Expansive Lounge & Sanctuary",
    description:
      "An expansive suite with a separate living area, premium furnishings, and added privacy for a restful resort stay.",
    longDescription:
      "The Luxury Suite offers extra space and privacy. An elegant sleeping area and comfortable lounge create a welcoming setting to relax and spend time together.",
    size: "650 sq. ft.",
    guests: "Up to 4 Guests",
    bed: "King Bed",
    view: "Panoramic Resort View",
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1590490359683-658d3d23f972?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=85&w=1800&auto=format&fit=crop",
    ],
    amenities: [
      "Separate lounge area",
      "Premium king bed",
      "High-speed Wi-Fi",
      "Smart TV",
      
      "Luxury bath amenities",
      "Private balcony",
      "24×7 room service",
    ],
  },
  {
    id: "family-suite",
    name: "Family Suites",
    shortName: "Family Suite",
    eyebrow: "Saptagiri Resorts",
    tagline: "Generous Room for Reconnecting",
    description:
      "A spacious suite with room for families to relax, reconnect, and enjoy time together.",
    longDescription:
      "The Family Suite is designed for families and small groups. Its generous layout balances shared spaces with room for privacy, making it well suited to longer leisure stays.",
    size: "780 sq. ft.",
    guests: "Up to 5 Guests",
    bed: "King + Twin Beds",
    view: "Garden & Resort View",
    featured: false,
    images: [
      "https://images.unsplash.com/photo-1587985064135-0366536eab42?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1560185008-b033106af5c3?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1615874694520-474822394e73?q=85&w=1800&auto=format&fit=crop",
    ],
    amenities: [
      "King bed",
      "Additional twin beds",
      "Family seating area",
      "Smart TV",
      "High-speed Wi-Fi",
      
      "Spacious bathroom",
      "24×7 room service",
    ],
  },
  {
    id: "honeymoon-suite",
    name: "Honeymoon Suites",
    shortName: "Honeymoon Suite",
    eyebrow: "Saptagiri Resorts",
    tagline: "Private Sanctuary for Two",
    description:
      "A private retreat for couples celebrating an anniversary, honeymoon, or time together.",
    longDescription:
      "The Honeymoon Suite offers an intimate atmosphere, elegant interiors, and comfortable living space for couples seeking privacy and a memorable stay.",
    size: "700 sq. ft.",
    guests: "Up to 2 Guests",
    bed: "Luxury King Bed",
    view: "Private Scenic View",
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=85&w=1800&auto=format&fit=crop",
    ],
    amenities: [
      "Luxury king bed",
      "Romantic seating area",
      "Private balcony",
      "Smart TV",
      
      "Luxury bath",
      "Premium toiletries",
      "24×7 room service",
    ],
  },
  {
    id: "pool-villa",
    name: "Pool Villa",
    shortName: "Pool Villa",
    eyebrow: "Saptagiri Resorts",
    tagline: "Secluded Outdoor Oasis",
    description:
      "A private villa designed for space, tranquillity, and time together, with a poolside setting.",
    longDescription:
      "The Pool Villa offers privacy and generous space. Its pool and outdoor setting make it a welcoming choice for couples and families.",
    size: "1,100 sq. ft.",
    guests: "Up to 4 Guests",
    bed: "King Bed",
    view: "Private Pool & Garden",
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=85&w=1800&auto=format&fit=crop",
    ],
    amenities: [
      "Private swimming pool",
      "Private garden",
      "Luxury king bed",
      "Spacious living area",
      "Smart TV",
      
      "Premium bathroom",
      "24×7 room service",
    ],
  },
  {
    id: "presidential-room",
    name: "Presidential Rooms",
    shortName: "Presidential",
    eyebrow: "Saptagiri Resorts",
    tagline: "Pinnacle of Resort Living",
    description:
      "A spacious accommodation with refined interiors and a private setting for family stays and special occasions.",
    longDescription:
      "The Presidential Room offers generous space and privacy for families, special occasions, and longer stays.",
    size: "1,800 sq. ft.",
    guests: "Up to 6 Guests",
    bed: "Multiple Premium Beds",
    view: "Private Garden & Pool",
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?q=85&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?q=85&w=1800&auto=format&fit=crop",
    ],
    amenities: [
      "Private pool",
      "Private garden",
      "Multiple bedrooms",
      "Luxury living room",
      "Dining area",
      "Premium bathroom",
      "Smart TVs",
      "24×7 room service",
    ],
  },
];

// Motion Variants
const heroVariants = {
  hidden: { opacity: 0, y: 40, filter: "blur(10px)" },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      delay: 0.2 + i * 0.15,
      duration: 0.85,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const cardMotion = {
  hidden: { opacity: 0, y: 45, scale: 0.95 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: 0.1 + i * 0.12,
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

export default function RoomCategories() {
  const navigate = useNavigate();
  const [activeThumbnails, setActiveThumbnails] = useState({});
  const [focusedRoomId, setFocusedRoomId] = useState(null);
  const [showPreferredSection, setShowPreferredSection] = useState(false);
  const heroRef = useRef(null);
  const preferredSectionRef = useRef(null);

  // Main 4 grid showcase items
  const deluxeRoom = roomCategories.find((r) => r.id === "deluxe-room");
  const premiumDeluxe = roomCategories.find((r) => r.id === "premium-deluxe");
  const luxurySuite = roomCategories.find((r) => r.id === "luxury-suite");
  const honeymoonSuite = roomCategories.find((r) => r.id === "honeymoon-suite");

  // Parallax Hero Effect
  useEffect(() => {
    let ctx;
    let isActive = true;

    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapModule, scrollTriggerModule]) => {
        if (!isActive || !heroRef.current) return;
        const gsap = gsapModule.default;
        gsap.registerPlugin(scrollTriggerModule.ScrollTrigger);

        ctx = gsap.context(() => {
          gsap.to(".destinations-hero__bg", {
            yPercent: 20,
            ease: "none",
            scrollTrigger: {
              trigger: heroRef.current,
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          });
        }, heroRef);
      }
    );

    return () => {
      isActive = false;
      ctx?.revert();
    };
  }, []);

  // Automatic image slide animation every 4 seconds
  useEffect(() => {
    if (!showPreferredSection) return undefined;
    const interval = setInterval(() => {
      setActiveThumbnails((prev) => {
        const next = { ...prev };
        roomCategories.forEach((room) => {
          const currentIdx = prev[room.id] || 0;
          next[room.id] = (currentIdx + 1) % room.images.length;
        });
        return next;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [showPreferredSection]);

  const handleBookNow = () => {
    navigate("/luxury-membership");
  };

  const handleExploreRoom = (roomId) => {
    setShowPreferredSection(true);
    setFocusedRoomId(roomId);
    setTimeout(() => {
      const targetElement = document.getElementById(`room-card-${roomId}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (preferredSectionRef.current) {
        preferredSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  };

  const handleSeeMoreProperties = () => {
    setShowPreferredSection(true);
    setTimeout(() => {
      if (preferredSectionRef.current) {
        preferredSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  };

  const setCardActiveImage = (roomId, index) => {
    setActiveThumbnails((prev) => ({ ...prev, [roomId]: index }));
  };

  const getActiveImage = (room) => {
    const idx = activeThumbnails[room.id] || 0;
    return room.images[idx] || room.images[0];
  };

  const scrollToGrid = () => {
    document.getElementById("stays-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="destinations-page">
      {/* =========================================================
          HERO SECTION
      ========================================================== */}
      <section className="destinations-hero" ref={heroRef} aria-labelledby="destinations-hero-title">
        <div
          className="destinations-hero__bg"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=85&w=2200&auto=format&fit=crop)`,
          }}
          aria-hidden="true"
        >
          <div className="destinations-hero__overlay" />
        </div>

        <div className="destinations-hero__content">
          <Motion.p
            className="home-eyebrow"
            custom={0}
            initial="hidden"
            animate="visible"
            variants={heroVariants}
          >
            <Sparkles size={13} className="destinations-sparkle" /> The Saptagiri Resorts vision
          </Motion.p>
          <Motion.h1
            id="destinations-hero-title"
            custom={1}
            initial="hidden"
            animate="visible"
            variants={heroVariants}
          >
            A World Of Refined Stays
          </Motion.h1>
          <Motion.div
            custom={2}
            initial="hidden"
            animate="visible"
            variants={heroVariants}
          >
            <Button
              type="button"
              className="home-button home-button--green destinations-hero__cta"
              onClick={scrollToGrid}
            >
              Explore Accommodations <ArrowRight size={17} />
            </Button>
          </Motion.div>
        </div>
      </section>

      {/* =========================================================
          MAIN STAYS SECTION (Asymmetric 3-Column Masonry Grid)
      ========================================================== */}
      <section className="destinations-stays" id="stays-grid">
        <Motion.div
          className="destinations-stays__header"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="home-eyebrow home-eyebrow--dark">Saptagiri Resorts</p>
          <h2 className="destinations-stays__title">Find a stay that feels like yours</h2>
        </Motion.div>

        {/* 3-Column Grid Container */}
        <div className="destinations-grid">
          {/* COLUMN 1 (LEFT) */}
          <div className="destinations-grid__col destinations-grid__col--1">
            <Motion.div
              className="destinations-intro-card"
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="destinations-intro-text">
                Explore rooms and suites designed for comfort, privacy, and time together. Each Saptagiri resort is envisioned around its landscape and the people who gather there.
              </p>
            </Motion.div>

            {/* Deluxe Rooms Card */}
            {deluxeRoom && (
              <Motion.article
                className="destinations-card destinations-card--portrait"
                custom={0}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={cardMotion}
                whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
              >
                <div className="destinations-card__media">
                  <img src={deluxeRoom.images[0]} alt={deluxeRoom.name} loading="lazy" />
                  <span className="destinations-card__badge">{deluxeRoom.eyebrow}</span>
                  <div className="destinations-card__shine" />
                </div>
                <div className="destinations-card__base">
                  <div className="destinations-card__info">
                    <h3>{deluxeRoom.name}</h3>
                  </div>
                  <button
                    type="button"
                    className="destinations-card__explore-btn"
                    onClick={() => handleExploreRoom(deluxeRoom.id)}
                  >
                    <span>Explore</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </Motion.article>
            )}
          </div>

          {/* COLUMN 2 (MIDDLE) */}
          <div className="destinations-grid__col destinations-grid__col--2">
            {/* Premium Deluxe Rooms Card */}
            {premiumDeluxe && (
              <Motion.article
                className="destinations-card destinations-card--landscape"
                custom={1}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={cardMotion}
                whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
              >
                <div className="destinations-card__media">
                  <img src={premiumDeluxe.images[0]} alt={premiumDeluxe.name} loading="lazy" />
                  <span className="destinations-card__badge">{premiumDeluxe.eyebrow}</span>
                  <div className="destinations-card__shine" />
                </div>
                <div className="destinations-card__base">
                  <div className="destinations-card__info">
                    <h3>{premiumDeluxe.name}</h3>
                  </div>
                  <button
                    type="button"
                    className="destinations-card__explore-btn"
                    onClick={() => handleExploreRoom(premiumDeluxe.id)}
                  >
                    <span>Explore</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </Motion.article>
            )}

            {/* Luxury Suites Card */}
            {luxurySuite && (
              <Motion.article
                className="destinations-card destinations-card--landscape"
                custom={2}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={cardMotion}
                whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
              >
                <div className="destinations-card__media">
                  <img src={luxurySuite.images[0]} alt={luxurySuite.name} loading="lazy" />
                  <span className="destinations-card__badge">{luxurySuite.eyebrow}</span>
                  <div className="destinations-card__shine" />
                </div>
                <div className="destinations-card__base">
                  <div className="destinations-card__info">
                    <h3>{luxurySuite.name}</h3>
                  </div>
                  <button
                    type="button"
                    className="destinations-card__explore-btn"
                    onClick={() => handleExploreRoom(luxurySuite.id)}
                  >
                    <span>Explore</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </Motion.article>
            )}
          </div>

          {/* COLUMN 3 (RIGHT) */}
          <div className="destinations-grid__col destinations-grid__col--3">
            {/* Honeymoon Suites Card */}
            {honeymoonSuite && (
              <Motion.article
                className="destinations-card destinations-card--portrait-tall"
                custom={3}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={cardMotion}
                whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
              >
                <div className="destinations-card__media">
                  <img src={honeymoonSuite.images[0]} alt={honeymoonSuite.name} loading="lazy" />
                  <span className="destinations-card__badge">{honeymoonSuite.eyebrow}</span>
                  <div className="destinations-card__shine" />
                </div>
                <div className="destinations-card__base">
                  <div className="destinations-card__info">
                    <h3>{honeymoonSuite.name}</h3>
                  </div>
                  <button
                    type="button"
                    className="destinations-card__explore-btn"
                    onClick={() => handleExploreRoom(honeymoonSuite.id)}
                  >
                    <span>Explore</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </Motion.article>
            )}

            {/* See More Properties Button */}
            <Motion.div
              className="destinations-more-wrap"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <button
                type="button"
                className="destinations-more-btn"
                onClick={handleSeeMoreProperties}
              >
                <span>See More Properties</span>
                <ArrowRight size={16} />
              </button>
            </Motion.div>
          </div>
        </div>
      </section>

      {/* =========================================================
          ATTACHED LAYOUT PAGE: "SELECT YOUR PREFERRED STAY"
          (Displayed when clicking Explore or See More Properties)
      ========================================================== */}
      <AnimatePresence>
        {showPreferredSection && (
          <Motion.section
            className="preferred-stays-section"
            ref={preferredSectionRef}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Preferred Banner Top */}
            <div className="preferred-banner">
              <div
                className="preferred-banner__bg"
                style={{
                  backgroundImage: `url(https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=85&w=2000&auto=format&fit=crop)`,
                }}
              />
              <div className="preferred-banner__overlay" />
              <div className="preferred-banner__content">
                <Motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                >
                  Luxury Awaits
                </Motion.h2>
              </div>
            </div>

            {/* Preferred Section Title */}
            <div className="preferred-heading">
              <h2>Select Your Preferred Stay</h2>
              <span className="preferred-heading__rule" />
            </div>

            {/* Stacked Luxury Room Cards List (Matching Screenshot) */}
            <div className="preferred-cards-list">
              {roomCategories.map((room, idx) => {
                const activeImg = getActiveImage(room);
                const isFocused = focusedRoomId === room.id;

                return (
                  <Motion.article
                    key={room.id}
                    id={`room-card-${room.id}`}
                    className={`preferred-card${isFocused ? " is-focused" : ""}`}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.15 }}
                    transition={{ delay: idx * 0.08, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {/* Left Column: Image Preview + 3 Interactive Thumbnails */}
                    <div className="preferred-card__gallery">
                      <div className="preferred-card__main-img">
                        <Motion.img
                          key={activeImg}
                          src={activeImg}
                          alt={room.name}
                          initial={{ opacity: 0.6, scale: 1.02 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                      <div className="preferred-card__thumbs-row">
                        {room.images.map((thumbSrc, thumbIdx) => {
                          const isThumbActive = (activeThumbnails[room.id] || 0) === thumbIdx;
                          return (
                            <button
                              key={thumbSrc}
                              type="button"
                              className={`preferred-card__thumb${isThumbActive ? " is-active" : ""}`}
                              onClick={() => setCardActiveImage(room.id, thumbIdx)}
                            >
                              <img src={thumbSrc} alt={`${room.name} view ${thumbIdx + 1}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Column: Dark Emerald Green Box with Specifications */}
                    <Motion.div
                      className="preferred-card__box"
                      whileHover={{ scale: 1.015, y: -4 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <div className="preferred-card__shine" />
                      <div>
                        <span className="preferred-card__eyebrow">{room.eyebrow}</span>
                        <h3 className="preferred-card__title">{room.name}</h3>
                        <p className="preferred-card__desc">{room.description}</p>
                      </div>

                      <div className="preferred-card__specs-grid">
                        <div className="preferred-card__spec-col">
                          <div className="preferred-card__spec-item">
                            <span className="preferred-card__spec-label">ROOM SIZE</span>
                            <strong className="preferred-card__spec-val">{room.size}</strong>
                          </div>
                          <div className="preferred-card__spec-item">
                            <span className="preferred-card__spec-label">OCCUPANCY</span>
                            <strong className="preferred-card__spec-val">{room.guests}</strong>
                          </div>
                        </div>

                        <div className="preferred-card__spec-divider" />

                        <div className="preferred-card__spec-col">
                          <div className="preferred-card__spec-item">
                            <span className="preferred-card__spec-label">BED TYPE</span>
                            <strong className="preferred-card__spec-val">{room.bed}</strong>
                          </div>
                          <div className="preferred-card__spec-item">
                            <span className="preferred-card__spec-label">VIEW</span>
                            <strong className="preferred-card__spec-val">{room.view}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Animated Gold Separator */}
                      <Motion.div
                        className="preferred-card__divider-wrap"
                        initial={{ opacity: 0, scaleX: 0 }}
                        whileInView={{ opacity: 1, scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + idx * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <span className="preferred-card__divider-line" />
                        <Sparkles size={11} className="preferred-card__divider-icon" />
                        <span className="preferred-card__divider-line" />
                      </Motion.div>

                      {/* Amenities Grid */}
                      <Motion.div
                        className="preferred-card__amenities"
                        initial={{ opacity: 0, y: 14 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4 + idx * 0.06, duration: 0.6 }}
                      >
                        <p className="preferred-card__amenities-label">Included Amenities</p>
                        <ul className="preferred-card__amenities-grid">
                          {room.amenities.map((amenity, ai) => (
                            <Motion.li
                              key={amenity}
                              className="preferred-card__amenity-item"
                              initial={{ opacity: 0, x: -8 }}
                              whileInView={{ opacity: 1, x: 0 }}
                              viewport={{ once: true }}
                              transition={{ delay: 0.45 + idx * 0.04 + ai * 0.04, duration: 0.45 }}
                            >
                              <Check size={10} className="preferred-card__amenity-check" />
                              <span>{amenity}</span>
                            </Motion.li>
                          ))}
                        </ul>
                      </Motion.div>

                      {/* Luxury Trust Badges */}
                      <Motion.div
                        className="preferred-card__footer-perks"
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.55 + idx * 0.06, duration: 0.5 }}
                      >
                        <div className="preferred-card__perk">
                          <Sparkles size={11} className="preferred-card__perk-icon" />
                          <span>Member booking support</span>
                        </div>
                        <span className="preferred-card__perk-dot" />
                        <div className="preferred-card__perk">
                          <Check size={11} className="preferred-card__perk-icon" />
                          <span>Clear booking terms</span>
                        </div>
                        <span className="preferred-card__perk-dot" />
                        <div className="preferred-card__perk">
                          <Sparkles size={11} className="preferred-card__perk-icon" />
                          <span>Caring service</span>
                        </div>
                      </Motion.div>

                      {/* Check Availability Button — at the very end */}
                      <Motion.div
                        className="preferred-card__action"
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.65 + idx * 0.06, duration: 0.5 }}
                      >
                        <Motion.button
                          type="button"
                          className="preferred-card__btn"
                          onClick={handleBookNow}
                          whileHover={{ scale: 1.05, y: -3 }}
                          whileTap={{ scale: 0.96 }}
                        >
                          Check Availability
                        </Motion.button>
                      </Motion.div>
                    </Motion.div>
                  </Motion.article>
                );
              })}
            </div>
          </Motion.section>
        )}
      </AnimatePresence>

      {/* =========================================================
          THE ORINAA EXPERIENCE STRIP
      ========================================================== */}
      <section className="destinations-experience">
        <div className="destinations-experience__inner">
          <Motion.div
            className="destinations-experience__header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="home-eyebrow">The Saptagiri approach</p>
            <h2>Comfort, care, and connection</h2>
          </Motion.div>

          <div className="destinations-experience__features">
            {[
              { num: "01", title: "Member-first care", desc: "Thoughtful service and a warm welcome for every member of the family." },
              { num: "02", title: "Nature-led settings", desc: "Resorts envisioned to reflect the character of their hills, beaches, and forests." },
              { num: "03", title: "Vegetarian hospitality", desc: "Fresh, wholesome, and regional vegetarian food, with organic produce where available." },
              { num: "04", title: "Wellbeing and leisure", desc: "A vision for restorative wellness and activities shaped by each location." },
            ].map((item, idx) => (
              <Motion.div
                key={item.num}
                className="destinations-feature-item"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.12, duration: 0.6 }}
                whileHover={{ y: -5, borderColor: "rgba(226, 173, 50, 0.45)" }}
              >
                <span className="destinations-feature-item__num">{item.num}</span>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          FINAL ENQUIRY CTA SECTION
      ========================================================== */}
      <section className="destinations-cta">
        <Motion.div
          className="destinations-cta__inner"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <p className="home-eyebrow">Your Sanctuary Awaits</p>
          <h2>Discover Saptagiri Resorts</h2>
          <p>
            Learn about OrianaaClub membership and the nature-led experiences envisioned across the Saptagiri Resorts family.
          </p>
          <Button
            type="button"
            className="home-button home-button--green destinations-cta__button"
            onClick={handleBookNow}
          >
            Enquire Now <ArrowRight size={17} aria-hidden="true" />
          </Button>
        </Motion.div>
      </section>
    </main>
  );
}
