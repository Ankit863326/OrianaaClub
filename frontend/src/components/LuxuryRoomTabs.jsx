import React, { useEffect, useRef, useState } from "react";
import "./LuxuryRoomTabs.css";

const roomData = {
  deluxe: {
    title: "Deluxe Room",
    description:
      "A beautifully appointed room offering contemporary comfort, elegant interiors, and a peaceful retreat surrounded by serene natural surroundings.",
    size: "350 sq. ft.",
    guests: "Up to 3",
    view: "Nature View",
    badge: "Essential Stay",
    images: [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=1600&auto=format&fit=crop",
    ],
  },

  premiumDeluxe: {
    title: "Premium Deluxe Room",
    description:
      "An elevated stay experience combining spacious interiors, premium amenities, and refined details designed for a relaxing resort getaway.",
    size: "450 sq. ft.",
    guests: "Up to 3",
    view: "Scenic Balcony",
    badge: "Premium Stay",
    images: [
      "https://images.unsplash.com/photo-1591088398332-8a7791972843?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1564078516393-cf04bd966897?q=80&w=1600&auto=format&fit=crop",
    ],
  },

  executive: {
    title: "Executive Room",
    description:
      "A sophisticated room designed for guests seeking additional space, privacy, and a premium level of comfort during their stay.",
    size: "550 sq. ft.",
    guests: "Up to 4",
    view: "Garden View",
    badge: "Executive Stay",
    images: [
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?q=80&w=1600&auto=format&fit=crop",
    ],
  },

  luxurySuite: {
    title: "Luxury Suite",
    description:
      "A generously proportioned suite featuring elegant living spaces, premium furnishings, and thoughtful details for an indulgent resort experience.",
    size: "700 sq. ft.",
    guests: "Up to 4",
    view: "Panoramic View",
    badge: "Luxury Collection",
    images: [
      "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=1600&auto=format&fit=crop",
    ],
  },

  familySuite: {
    title: "Family Suite",
    description:
      "A spacious family-friendly suite thoughtfully designed with comfortable sleeping and living areas for memorable stays with loved ones.",
    size: "800 sq. ft.",
    guests: "Up to 5",
    view: "Garden & Resort View",
    badge: "Family Retreat",
    images: [
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1590490359854-dfba19688d70?q=80&w=1600&auto=format&fit=crop",
    ],
  },

  honeymoonSuite: {
    title: "Honeymoon Suite",
    description:
      "An intimate and romantic suite created for couples, featuring elegant interiors, enhanced privacy, and a serene atmosphere.",
    size: "750 sq. ft.",
    guests: "Up to 2",
    view: "Private Scenic View",
    badge: "Romantic Escape",
    images: [
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1564501049412-61c2a3083791?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1600&auto=format&fit=crop",
    ],
  },

  poolVilla: {
    title: "Pool Villa",
    description:
      "A private villa experience combining generous living spaces, premium comforts, and a private pool for an exclusive resort escape.",
    size: "1,200 sq. ft.",
    guests: "Up to 4",
    view: "Private Pool View",
    badge: "Private Villa",
    images: [
      "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=1600&auto=format&fit=crop",
    ],
  },

  presidentialVilla: {
    title: "Presidential Villa",
    description:
      "Our most exclusive accommodation, offering expansive private spaces, exceptional comfort, and a refined villa experience for distinguished stays.",
    size: "1,800 sq. ft.",
    guests: "Up to 6",
    view: "Private Luxury Retreat",
    badge: "Signature Collection",
    images: [
      "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1600&auto=format&fit=crop",
    ],
  },
};

const tabs = Object.keys(roomData);

export default function LuxuryRoomTabs() {
  const [activeTab, setActiveTab] = useState("deluxe");
  const [currentImage, setCurrentImage] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  const tabsRef = useRef(null);
  const tabRefs = useRef({});

  const activeRoom = roomData[activeTab];
  const totalImages = activeRoom.images.length;

  /*
   * Keeps the selected category in the center.
   * Example:
   * Deluxe | Premium | Executive
   *
   * Click Executive =>
   * Premium | Executive | Luxury
   */
  const centerActiveTab = (tabKey) => {
    const container = tabsRef.current;
    const selectedTab = tabRefs.current[tabKey];

    if (!container || !selectedTab) return;

    const containerCenter = container.clientWidth / 2;
    const tabCenter =
      selectedTab.offsetLeft + selectedTab.offsetWidth / 2;

    const targetScroll = tabCenter - containerCenter;

    container.scrollTo({
      left: Math.max(0, targetScroll),
      behavior: "smooth",
    });
  };

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setCurrentImage(0);
    setFadeIn(true);

    requestAnimationFrame(() => {
      centerActiveTab(tabKey);
    });
  };

  useEffect(() => {
    centerActiveTab(activeTab);
  }, [activeTab]);

  /*
   * Automatic image slider
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setFadeIn(false);

      setTimeout(() => {
        setCurrentImage((prev) => (prev + 1) % totalImages);
        setFadeIn(true);
      }, 250);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTab, totalImages]);

  const nextSlide = () => {
    setFadeIn(false);

    setTimeout(() => {
      setCurrentImage((prev) => (prev + 1) % totalImages);
      setFadeIn(true);
    }, 250);
  };

  const prevSlide = () => {
    setFadeIn(false);

    setTimeout(() => {
      setCurrentImage(
        (prev) => (prev - 1 + totalImages) % totalImages
      );
      setFadeIn(true);
    }, 250);
  };

  /*
   * Scroll room categories left/right
   */
  const scrollTabs = (direction) => {
    const container = tabsRef.current;

    if (!container) return;

    const amount = container.clientWidth * 0.7;

    container.scrollBy({
      left: direction === "next" ? amount : -amount,
      behavior: "smooth",
    });
  };

  return (
    <section className="luxury-room-section">
      <div className="luxury-room-container">

        {/* Header */}
        <div className="luxury-room-header">
          <span className="luxury-subtitle">
            Curated Stay Collection
          </span>

          <h2>A World of Refined Stays</h2>

          <p>
            Thoughtfully designed spaces that blend comfort,
            simplicity, and serene natural surroundings.
          </p>
        </div>

        {/* Main Card */}
        <div className="luxury-room-card">

          {/* Left Content */}
          <div className="luxury-room-left">

            {/* Room Categories Navigation */}
            <div className="luxury-category-navigation">

              <button
                type="button"
                className="luxury-category-arrow"
                onClick={() => scrollTabs("prev")}
                aria-label="Previous room categories"
              >
                &#8592;
              </button>

              <div
                className="luxury-room-tabs"
                ref={tabsRef}
              >
                {tabs.map((tab) => (
                  <button
                    type="button"
                    key={tab}
                    ref={(element) => {
                      tabRefs.current[tab] = element;
                    }}
                    className={`luxury-tab-btn ${
                      activeTab === tab ? "active" : ""
                    }`}
                    onClick={() => handleTabChange(tab)}
                  >
                    {roomData[tab].title}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="luxury-category-arrow"
                onClick={() => scrollTabs("next")}
                aria-label="Next room categories"
              >
                &#8594;
              </button>

            </div>

            {/* Room Content */}
            <div className="luxury-room-content">

              <div className="luxury-room-badge">
                {activeRoom.badge}
              </div>

              <h3>{activeRoom.title}</h3>

              <p>{activeRoom.description}</p>

              {/* Room Information */}
              <div className="luxury-room-meta">

                <div className="meta-box">
                  <span>Size</span>
                  <strong>{activeRoom.size}</strong>
                </div>

                <div className="meta-box">
                  <span>Guests</span>
                  <strong>{activeRoom.guests}</strong>
                </div>

                <div className="meta-box">
                  <span>View</span>
                  <strong>{activeRoom.view}</strong>
                </div>

              </div>

              <button
                type="button"
                className="luxury-cta-btn"
              >
                Explore Stay
                <span>&#8594;</span>
              </button>

            </div>
          </div>

          {/* Right Image Slider */}
          <div className="luxury-room-right">
            <div className="luxury-slider-wrapper">

              <img
                src={activeRoom.images[currentImage]}
                alt={activeRoom.title}
                className={`luxury-room-image ${
                  fadeIn ? "fade-in" : "fade-out"
                }`}
              />

              <div className="luxury-image-overlay"></div>

              {/* Previous */}
              <button
                type="button"
                className="luxury-arrow luxury-left-arrow"
                onClick={prevSlide}
                aria-label="Previous image"
              >
                &#8592;
              </button>

              {/* Next */}
              <button
                type="button"
                className="luxury-arrow luxury-right-arrow"
                onClick={nextSlide}
                aria-label="Next image"
              >
                &#8594;
              </button>

              {/* Image Dots */}
              <div className="luxury-slider-dots">
                {activeRoom.images.map((_, index) => (
                  <button
                    type="button"
                    key={index}
                    aria-label={`View image ${index + 1}`}
                    className={`luxury-dot ${
                      currentImage === index
                        ? "active-dot"
                        : ""
                    }`}
                    onClick={() => {
                      setCurrentImage(index);
                      setFadeIn(true);
                    }}
                  />
                ))}
              </div>

              {/* Image Label */}
              <div className="luxury-image-label">
                <span>Signature Interiors</span>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}