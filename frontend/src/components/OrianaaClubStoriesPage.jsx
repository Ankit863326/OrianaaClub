import React, { useState, useRef, useEffect } from "react";
import "./OrianaaClubStoriesPage.css";

const storiesData = [
  {
    id: 1,
    image:
      "https://theacresclub.com/wp-content/smush-webp/2024/06/WhatsApp-Image-2024-06-04-at-6.50.53-PM.jpeg.webp",
    avatar:
      "https://asset.peoplematters.in/images/96d81ae5-01a0-437f-985c-ba684213c65a.png",
    name: "Aman Gupta",
    since: "Member since 2017",
    text: `Our family holidays have become more meaningful with OrianaaClub. Every stay feels warm, welcoming, and thoughtfully planned. The activities keep the kids happy, while the peaceful setting gives us time to unwind. We always return home with beautiful memories and a desire to plan the next trip soon.`,
  },
  {
    id: 2,
    image:
      "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=80",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
    name: "Sakshi Mehta",
    since: "Member since 2016",
    text: `With OrianaaClub, we can holiday at amazing resorts without denting our pocket. There is something fun for everyone. The warm hospitality, well-maintained properties, and curated experiences make every trip memorable. It always feels like we’re stepping into comfort, relaxation, and quality family time together.`,
  },  {
    id: 3,
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRWhmp49vm1O9Y0DTTvRoaAkcxkvAzDOqd9dA&s",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80",
    name: "John Doe",
    since: "Member since 2017",
    text: `Whether it is a quick weekend getaway or a long family vacation, we just pick a destination, pack our bags, and go. The warm hospitality, beautiful properties, and curated experiences make every trip memorable. It's like having a second home wherever we travel, and every holiday becomes truly special.`,
  },
];

export default function OrianaaClubStories() {
  const scrollContainerRef = useRef(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const autoScrollInterval = useRef(null);

  // Auto-scroll carousel for mobile
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isAutoScrolling) return;

    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    const scroll = () => {
      if (!container) return;

      // Check if scrolled to end
      if (
        container.scrollLeft + container.clientWidth >=
        container.scrollWidth - 10
      ) {
        container.scrollLeft = 0; // Reset to beginning
      } else {
        container.scrollLeft += container.clientWidth; // Scroll by one card width
      }
    };

    // Start auto-scroll with 5-second interval
    autoScrollInterval.current = setInterval(scroll, 5000);

    return () => {
      if (autoScrollInterval.current) clearInterval(autoScrollInterval.current);
    };
  }, [isAutoScrolling]);

  const handleCardClick = () => {
    setIsAutoScrolling(false);
  };

  const handleOutsideClick = (e) => {
    if (
      scrollContainerRef.current &&
      !scrollContainerRef.current.contains(e.target)
    ) {
      setIsAutoScrolling(true);
    }
  };

  return (
    <section className="stories-section" onBlur={handleOutsideClick}>
      <div className="stories-container">
        <h2 className="stories-heading">
          Stories from the <span>OrianaaClub</span> Community
        </h2>

        <div
          className="stories-grid"
          ref={scrollContainerRef}
          onClick={handleCardClick}
        >
          {storiesData.map((story) => (
            <div className="story-card" key={story.id}>
              <div className="story-image-wrap">
                <img src={story.image} alt={story.name} className="story-image" />
              </div>

              <div className="story-content-wrap">
                <div className="story-scroll-indicator">
                  <span className="scroll-arrow">⌄</span>
                </div>

                <div className="story-text-scroll">
                  <p className="story-text">{story.text}</p>
                </div>
              </div>

              <div className="story-user">
                <img src={story.avatar} alt={story.name} className="story-avatar" />
                <div className="story-user-info">
                  <h4>{story.name}</h4>
                  <p>{story.since}</p>
                </div>
              </div>

              <div className="story-pattern">
                <svg viewBox="0 0 600 160" preserveAspectRatio="none">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <path
                      key={i}
                      d={`M${-30 + i * 18},160 C120,60 240,220 380,120 S540,40 650,110`}
                    />
                  ))}
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}