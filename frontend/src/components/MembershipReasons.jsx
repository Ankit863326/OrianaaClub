import React, { useState } from "react";
import "./MembershipReasons.css";

const reasons = [
  {
    title: "The Saptagiri Way of Living",
    leftTitle: "Other Resorts",
    rightTitle: "OrianaaClub",
    leftText:
      "Standard stays, limited experiences, and conventional hospitality approaches.",
    rightText:
      "Wellness-driven living, nature-inspired experiences, and a lifestyle rooted in balance and harmony.",
  },
  {
    title: "Conscious & Pure Dining",
    leftTitle: "Other Resorts",
    rightTitle: "OrianaaClub",
    leftText:
      "Generic menus with routine dishes and limited focus on health or quality ingredients.",
    rightText:
      "Pure vegetarian cuisine crafted with fresh ingredients, offering sattvic, wholesome, and mindful dining experiences.",
  },
  {
    title: "Holistic Wellness Experiences",
    leftTitle: "Other Resorts",
    rightTitle: "OrianaaClub",
    leftText:
      "Basic leisure activities with little emphasis on wellness or rejuvenation.",
    rightText:
      "Naturopathy, yoga, meditation, and rejuvenation therapies designed to restore balance and vitality.",
  },
  {
    title: "Nature-Connected Destinations",
    leftTitle: "Other Resorts",
    rightTitle: "OrianaaClub",
    leftText:
      "Crowded locations with limited connection to nature and peaceful surroundings.",
    rightText:
      "Serene landscapes, fresh air, and scenic environments that offer true relaxation and escape.",
  },
  {
    title: "Meaningful Celebrations & Experiences",
    leftTitle: "Other Resorts",
    rightTitle: "OrianaaClub",
    leftText:
      "Standard event spaces with minimal personalization and conventional setups.",
    rightText:
      "Elegant celebrations, curated events, and memorable gatherings designed with care and exclusivity.",
  },
];

export default function MembershipReasons() {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [stackAnimate, setStackAnimate] = useState(false);
  const [direction, setDirection] = useState("next");
  const [isAnimating, setIsAnimating] = useState(false);

  const handleChange = (dir) => {
    if (isAnimating) return;

    setIsAnimating(true);
    setDirection(dir);
    setAnimate(false);
    setStackAnimate(true);

    setTimeout(() => {
      if (dir === "next") {
        setIndex((prev) => (prev + 1) % reasons.length);
      } else {
        setIndex((prev) => (prev - 1 + reasons.length) % reasons.length);
      }
      setAnimate(true);
    }, 150);

    setTimeout(() => {
      setStackAnimate(false);
      setIsAnimating(false);
    }, 600);
  };

  const current = reasons[index];

  return (
    <section className="membership-section">
      <div className="membership-container">
        <h2 className="membership-heading">A World of Refined Experiences</h2>

        <div className="card-stack-wrapper">
          {/* Animated Back Cards */}
          <div
            className={`stack-card left-stack ${
              stackAnimate ? `animate-left-${direction}` : ""
            }`}
          ></div>

          <div
            className={`stack-card right-stack ${
              stackAnimate ? `animate-right-${direction}` : ""
            }`}
          ></div>

          {/* Main Card */}
          <div className={`membership-card ${animate ? "show" : "hide"}`}>
            <div className="card-top">
              <h3>{current.title}</h3>
              <div className="top-line"></div>
            </div>

           <div className="comparison-header">
  <span className="comparison-title comparison-title-left">
    {current.leftTitle}
  </span>

  <div className="vs-wrapper">
    <div className="line"></div>
    <div className="vs-circle">VS</div>
    <div className="line"></div>
  </div>

  <span className="comparison-title comparison-title-right">
    {current.rightTitle}
  </span>
</div>

            <div className="comparison-body">
              <div className="comparison-col">
                <p>{current.leftText}</p>
              </div>

              <div className="divider"></div>

              <div className="comparison-col">
                <p>{current.rightText}</p>
              </div>
            </div>

            <div className="luxury-watermark">✦</div>
          </div>
        </div>

        {/* Navigation */}
        <div className="membership-nav">
          <button
            onClick={() => handleChange("prev")}
            className="nav-btn"
            disabled={isAnimating}
            aria-label="Previous reason"
          >
            &#8592;
          </button>

          <button
            onClick={() => handleChange("next")}
            className="nav-btn"
            disabled={isAnimating}
            aria-label="Next reason"
          >
            &#8594;
          </button>
        </div>
      </div>
    </section>
  );
}