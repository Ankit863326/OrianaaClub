import React, { useEffect, useState } from "react";

const slides = [
  {
    id: 1,
    image:
      "https://www.stayvista.com/blog/wp-content/uploads/2025/07/gardenea-6a80c9-1024x683.webp",
    text: "Spacious, premium stays for families",
  },
  {
    id: 2,
    image:
      "https://ik.imagekit.io/8owvkbfkr/Viceroy-Bali-Main-Pool-.jpg?updatedAt=1761114003538",
    text: "Thoughtfully crafted experiences",
  },
  {
    id: 3,
    image:
      "https://trueheart.com/wp-content/uploads/2024/09/top-10-luxury-destinations-in-the-world.jpg",
    text: "Peaceful escapes with vibrant views",
  },
  {
    id: 4,
    image:
      "https://treasuretripin.com/wp-content/uploads/2024/08/A-female-tourist-walkin-in-the-Hotel-The-Oberoi-Amarvilas-Agra.jpg",
    text: "Curated moments for every traveller",
  },
  {
    id: 5,
    image:
      "https://media-cdn.tripadvisor.com/media/photo-s/1c/aa/fb/a3/premium-lake-view-villas.jpg",
    text: "Luxury escapes surrounded by nature",
  },
  {
    id: 6,
    image:
      "https://www.indianluxurytrains.com/wp-content/uploads/2014/01/Umaid-bhawan-palace-1-1.jpg",
    text: "Colonial elegance meets modern comfort",
  },
  {
    id: 7,
    image:
      "https://plannersy.com/wp-content/uploads/2025/06/Udaipur-1.jpg",
    text: "Timeless heritage with contemporary ease",
  },
];

const tabsList = ["CELEBRATION", "WELLNESS", "EXPERIENCE"];

export default function ExperienceSection() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    // Smooth auto-scroll from right to left - infinite carousel
    // 4.5 seconds for continuous elegant motion
    const autoScrollInterval = setInterval(() => {
      setCurrent((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 4500);

    return () => clearInterval(autoScrollInterval);
  }, []);

  const prevSlide = () => {
    setCurrent((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrent((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  const getVisibleSlides = () => {
    // Show 5 cards: 2 left, 1 center, 2 right for smooth scrolling
    const slides2Left = (current - 2 + slides.length) % slides.length;
    const slide1Left = (current - 1 + slides.length) % slides.length;
    const center = current % slides.length;
    const slide1Right = (current + 1) % slides.length;
    const slide2Right = (current + 2) % slides.length;

    return [
      slides[slides2Left],
      slides[slide1Left],
      slides[center],
      slides[slide1Right],
      slides[slide2Right],
    ];
  };

  const getVisibleTabs = () => {
    const prevTab = (current - 1 + tabsList.length) % tabsList.length;
    const currentTab = current % tabsList.length;
    const nextTab = (current + 1) % tabsList.length;

    return [tabsList[prevTab], tabsList[currentTab], tabsList[nextTab]];
  };

  const visibleSlides = getVisibleSlides();
  const visibleTabs = getVisibleTabs();

  return (
    <section className="experience-section">
      <div className="bg-pattern left"></div>
      <div className="bg-pattern right"></div>

      <div className="container">
        <h1>Rooted in the Philosophy of Saptagiri</h1>

        <p className="subtitle">
          Inspired by Saptagiri, a vision by <b>Saptagiri Hospitality and Lifestyle Private Limited</b>, OrianaaClub brings together nature, wellness, and celebration into a seamless luxury experience.
        </p>

        <div className="tabs-wrap">
          <div className="line"></div>
          <div className="tabs">
            <span className="tab-item">{visibleTabs[0]}</span>
            <span className="tab-item active">{visibleTabs[1]}</span>
            <span className="tab-item">{visibleTabs[2]}</span>
          </div>
          <div className="line"></div>
        </div>

        <div className="slider">
          {visibleSlides.map((slide, index) => {
            let cardClass = "side";
            // Center card is the 3rd one (index 2)
            if (index === 2) cardClass = "center";
            return (
              <div key={slide.id} className={`card ${cardClass}`}>
                <img src={slide.image} alt={slide.text} />
                <div className="overlay">{slide.text}</div>
              </div>
            );
          })}
        </div>

        <div className="controls">
          <button onClick={prevSlide}>←</button>
          <button onClick={nextSlide}>→</button>
        </div>
      </div>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .experience-section {
          position: relative;
          width: 100%;
          min-height: 100vh;
          background: #f8f8f8;
          padding: clamp(24px, 4vw, 40px) clamp(16px, 2.5vw, 24px);
          overflow: hidden;
          font-family: "Poppins", sans-serif;
          contain: layout style;
        }

        .container {
          max-width: 1680px;
          margin: 0 auto;
          text-align: center;
          position: relative;
          z-index: 2;
          contain: layout;
        }

        h1 {
          font-size: clamp(14px, 3.5vw, 28px);
          font-weight: 600;
          color: #111;
          margin-bottom: clamp(12px, 2vw, 18px);
          line-height: 1.4;
          word-break: break-word;
          overflow-wrap: break-word;
          position: relative;
          z-index: 3;
          padding: 0 clamp(12px, 2vw, 24px);
        }

        .subtitle {
          max-width: 850px;
          margin: 0 auto clamp(24px, 4vw, 36px);
          color: #666;
          font-size: clamp(13px, 1.5vw, 16px);
          line-height: 1.6;
        }

        .tabs-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(12px, 2vw, 20px);
          margin-bottom: clamp(20px, 3.5vw, 36px);
          flex-wrap: wrap;
        }

        .line {
          width: 140px;
          height: 1px;
          background: #cfcfcf;
          position: relative;
        }

        .line::before,
        .line::after {
          content: "";
          position: absolute;
          top: 50%;
          width: 6px;
          height: 6px;
          background: #a8a8a8;
          border-radius: 50%;
          transform: translateY(-50%);
        }

        .line::before {
          left: -3px;
        }

        .line::after {
          right: -3px;
        }

        .tabs {
          display: flex;
          gap: 24px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: center;
        }

        .tabs .tab-item {
          font-size: 1rem;
          letter-spacing: 2px;
          color: #a3a3a3;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.75s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          animation: tabSlideIn 0.75s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }

        @keyframes tabSlideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .tabs .tab-item.active {
          color: #111;
          font-weight: 600;
          transform: scale(1.1);
        }

        .tabs span.active {
          color: #111;
          font-weight: 600;
        }

        .slider {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: clamp(16px, 3vw, 28px);
          flex-wrap: nowrap;
          min-height: clamp(280px, 50vh, 400px);
          contain: layout style paint;
          padding: 0 clamp(20px, 8vw, 120px);
        }

        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(200px) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes slideOutToRight {
          from {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
          to {
            opacity: 0.85;
            transform: translateX(180px) scale(0.95);
          }
        }

        @keyframes smoothSlideLeft {
          0% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateX(-100px) scale(0.95);
          }
        }

        @keyframes smoothSlideRight {
          0% {
            opacity: 0;
            transform: translateX(100px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        .card {
          position: relative;
          border-radius: 24px;
          overflow: hidden;
          flex-shrink: 0;
          transition: transform 0.75s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.75s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          background: #ddd;
          aspect-ratio: auto;
          will-change: transform, opacity;
        }

        /* Left outer card (barely visible) */
        .card:nth-child(1) {
          width: clamp(80px, 10vw, 140px);
          height: clamp(100px, 15vw, 160px);
          opacity: 0.4;
          transform: scale(0.85);
        }

        /* Left inner card (small) */
        .card:nth-child(2) {
          width: clamp(140px, 16vw, 220px);
          height: clamp(140px, 20vw, 260px);
          opacity: 0.7;
          transform: scale(0.92);
        }

        /* Center card (prominent) */
        .card:nth-child(3) {
          width: clamp(200px, 28vw, 380px);
          height: clamp(200px, 35vw, 380px);
          opacity: 1;
          transform: scale(1);
          z-index: 10;
        }

        /* Right inner card (small) */
        .card:nth-child(4) {
          width: clamp(140px, 16vw, 220px);
          height: clamp(140px, 20vw, 260px);
          opacity: 0.7;
          transform: scale(0.92);
        }

        /* Right outer card (barely visible) */
        .card:nth-child(5) {
          width: clamp(80px, 10vw, 140px);
          height: clamp(100px, 15vw, 160px);
          opacity: 0.4;
          transform: scale(0.85);
        }

        .card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          animation: fadeInImage 0.6s ease-in-out;
        }

        @keyframes fadeInImage {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .overlay {
          position: absolute;
          left: clamp(12px, 2vw, 24px);
          right: clamp(12px, 2vw, 24px);
          bottom: clamp(14px, 2.5vw, 28px);
          background: rgba(255, 255, 255, 0.92);
          padding: clamp(14px, 2vw, 22px);
          border-radius: clamp(12px, 2.5vw, 18px);
          font-size: clamp(0.95rem, 1.8vw, 1.2rem);
          color: #222;
          font-weight: 500;
          backdrop-filter: blur(8px);
          box-shadow: 0 8px 18px rgba(0,0,0,0.08);
          transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeInOverlay 0.6s ease-in-out;
        }

        @keyframes fadeInOverlay {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .controls {
          display: flex;
          justify-content: center;
          gap: clamp(10px, 2vw, 16px);
          margin-top: clamp(20px, 3.5vw, 36px);
        }

        .controls button {
          width: clamp(36px, 6vw, 50px);
          height: clamp(36px, 6vw, 50px);
          border-radius: 50%;
          border: 2px solid #111;
          background: transparent;
          color: #111;
          font-size: clamp(1.2rem, 2.5vw, 1.6rem);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .controls button:hover {
          background: #111;
          color: #fff;
        }

        .bg-pattern {
          position: absolute;
          width: 340px;
          height: 340px;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,0.05);
          z-index: 1;
        }

        .bg-pattern.left {
          top: -120px;
          left: -120px;
          box-shadow:
            0 0 0 20px rgba(0,0,0,0.02),
            0 0 0 40px rgba(0,0,0,0.02),
            0 0 0 60px rgba(0,0,0,0.02),
            0 0 0 80px rgba(0,0,0,0.02),
            0 0 0 100px rgba(0,0,0,0.02);
        }

        .bg-pattern.right {
          top: -120px;
          right: -120px;
          box-shadow:
            0 0 0 20px rgba(0,0,0,0.02),
            0 0 0 40px rgba(0,0,0,0.02),
            0 0 0 60px rgba(0,0,0,0.02),
            0 0 0 80px rgba(0,0,0,0.02),
            0 0 0 100px rgba(0,0,0,0.02);
        }

        /* Desktop XL */
        @media (min-width: 1440px) {
          .experience-section {
            padding: 50px 40px 60px;
          }

          .slider {
            min-height: 360px;
          }

          h1 {
            font-size: clamp(20px, 3.5vw, 32px);
          }

          .subtitle {
            font-size: 1rem;
            max-width: 900px;
          }

          .slider {
            gap: 32px;
          }
        }

        /* Desktop Large */
        @media (max-width: 1279px) {
          .slider {
            min-height: 310px;
          }

          h1 {
            font-size: clamp(18px, 3vw, 26px);
          }

          .subtitle {
            font-size: 0.9rem;
            margin-bottom: 28px;
          }

          .tabs span {
            font-size: 0.95rem;
            letter-spacing: 2px;
          }

          .slider {
            gap: 22px;
          }

          .card.side {
            width: 220px;
            height: 240px;
          }

          .card.center {
            width: 310px;
            height: 280px;
          }

          .overlay {
            font-size: 0.9rem;
          }
        }

        /* Tablet */
        @media (max-width: 1024px) {
          .experience-section {
            padding: 28px 16px 35px;
            min-height: auto;
          }

          .slider {
            min-height: 270px;
          }

          h1 {
            font-size: clamp(14px, 2.2vw, 20px);
            margin-bottom: 10px;
          }

          .subtitle {
            font-size: 0.85rem;
            margin-bottom: 25px;
            max-width: 750px;
          }

          .tabs-wrap {
            gap: 14px;
            margin-bottom: 22px;
          }

          .tabs {
            gap: 16px;
          }

          .tabs span {
            font-size: 0.8rem;
            letter-spacing: 1.5px;
          }

          .line {
            width: 90px;
          }

          .slider {
            gap: 12px;
            flex-wrap: nowrap;
          }

          .card.side {
            width: 160px;
            height: 200px;
          }

          .card.center {
            width: 240px;
            height: 240px;
          }

          .overlay {
            font-size: 0.75rem;
            padding: 10px 10px;
            left: 12px;
            right: 12px;
            bottom: 12px;
          }

          .controls {
            gap: 10px;
            margin-top: 24px;
          }

          .controls button {
            width: 40px;
            height: 40px;
            font-size: 1.2rem;
          }

          .bg-pattern {
            width: 180px;
            height: 180px;
          }
        }

        /* Desktop Extra-Large (1400px+) */
        @media (min-width: 1400px) {
          .experience-section {
            padding: 40px 60px;
          }

          .container {
            max-width: 1600px;
          }

          h1 {
            font-size: clamp(24px, 4vw, 36px);
            margin-bottom: clamp(16px, 2vw, 20px);
          }

          .slider {
            min-height: clamp(320px, 55vh, 480px);
            gap: clamp(28px, 3.5vw, 36px);
          }

          .card.center {
            width: clamp(240px, 30vw, 420px);
            height: clamp(240px, 38vw, 420px);
          }

          .card.side {
            width: clamp(180px, 22vw, 320px);
            height: clamp(200px, 30vw, 350px);
          }
        }

        /* Desktop Large (1200px - 1399px) */
        @media (max-width: 1399px) and (min-width: 1200px) {
          .experience-section {
            padding: 36px 50px;
          }

          h1 {
            font-size: clamp(20px, 3.2vw, 28px);
            margin-bottom: clamp(14px, 2vw, 18px);
          }

          .slider {
            min-height: clamp(300px, 50vh, 450px);
            gap: clamp(24px, 3vw, 32px);
          }

          .card.center {
            width: clamp(200px, 28vw, 380px);
            height: clamp(220px, 35vw, 380px);
          }

          .card.side {
            width: clamp(160px, 20vw, 280px);
            height: clamp(180px, 27vw, 320px);
          }
        }

        /* Desktop Standard (1024px - 1199px) */
        @media (max-width: 1199px) and (min-width: 1024px) {
          .experience-section {
            padding: 32px 40px;
            min-height: 100vh;
          }

          h1 {
            font-size: clamp(18px, 3vw, 26px);
            margin-bottom: clamp(12px, 1.8vw, 16px);
          }

          .subtitle {
            font-size: clamp(14px, 1.6vw, 18px);
            max-width: 800px;
            margin: 0 auto clamp(24px, 3.5vw, 32px);
          }

          .slider {
            min-height: clamp(280px, 48vh, 420px);
            gap: clamp(20px, 2.8vw, 28px);
          }

          .card.center {
            width: clamp(180px, 25vw, 340px);
            height: clamp(200px, 32vw, 340px);
          }

          .card.side {
            width: clamp(140px, 18vw, 240px);
            height: clamp(160px, 24vw, 280px);
          }

          .controls button {
            width: clamp(40px, 5vw, 48px);
            height: clamp(40px, 5vw, 48px);
            font-size: clamp(1.1rem, 1.8vw, 1.5rem);
          }
        }

        /* Tablet Landscape (900px - 1023px) */
        @media (max-width: 1023px) and (min-width: 900px) {
          .experience-section {
            padding: 28px 32px;
            min-height: 100vh;
          }

          h1 {
            font-size: clamp(16px, 2.8vw, 22px);
            margin-bottom: clamp(10px, 1.5vw, 14px);
          }

          .subtitle {
            font-size: clamp(12px, 1.4vw, 16px);
            margin: 0 auto clamp(18px, 3vw, 26px);
          }

          .slider {
            min-height: clamp(240px, 45vh, 380px);
            gap: clamp(16px, 2.5vw, 22px);
          }

          .card.center {
            width: clamp(160px, 23vw, 300px);
            height: clamp(180px, 30vw, 300px);
          }

          .card.side {
            width: clamp(120px, 16vw, 200px);
            height: clamp(140px, 22vw, 240px);
          }

          .controls {
            gap: clamp(12px, 2vw, 18px);
            margin-top: clamp(20px, 3vw, 28px);
          }

          .controls button {
            width: clamp(38px, 5vw, 44px);
            height: clamp(38px, 5vw, 44px);
            font-size: clamp(1rem, 1.6vw, 1.3rem);
          }
        }

        /* Tablet (834px - 899px) */
        @media (max-width: 899px) and (min-width: 834px) {
          .experience-section {
            padding: 24px 20px;
            min-height: auto;
          }

          h1 {
            font-size: clamp(14px, 2.4vw, 20px);
            margin-bottom: clamp(10px, 1.5vw, 12px);
          }

          .slider {
            min-height: clamp(200px, 40vh, 340px);
            gap: clamp(10px, 1.8vw, 14px);
          }

          .card:nth-child(1) { width: clamp(60px, 8vw, 100px); height: clamp(80px, 12vw, 130px); }
          .card:nth-child(2) { width: clamp(100px, 13vw, 160px); height: clamp(120px, 18vw, 200px); }
          .card:nth-child(3) { width: clamp(140px, 19vw, 240px); height: clamp(160px, 24vw, 260px); }
          .card:nth-child(4) { width: clamp(100px, 13vw, 160px); height: clamp(120px, 18vw, 200px); }
          .card:nth-child(5) { width: clamp(60px, 8vw, 100px); height: clamp(80px, 12vw, 130px); }
        }

        /* Tablet Portrait (768px - 833px) */
        @media (max-width: 833px) and (min-width: 768px) {
          .experience-section {
            padding: 20px 18px 28px;
            min-height: auto;
          }

          h1 {
            font-size: clamp(12px, 2vw, 16px);
            margin-bottom: clamp(8px, 1.2vw, 10px);
          }

          .slider {
            min-height: clamp(180px, 35vh, 300px);
            gap: clamp(8px, 1.6vw, 12px);
          }

          .card:nth-child(1) { width: clamp(50px, 7vw, 90px); height: clamp(70px, 10vw, 110px); opacity: 0.3; }
          .card:nth-child(2) { width: clamp(85px, 11vw, 140px); height: clamp(100px, 15vw, 170px); opacity: 0.6; }
          .card:nth-child(3) { width: clamp(120px, 16vw, 200px); height: clamp(140px, 21vw, 230px); opacity: 1; }
          .card:nth-child(4) { width: clamp(85px, 11vw, 140px); height: clamp(100px, 15vw, 170px); opacity: 0.6; }
          .card:nth-child(5) { width: clamp(50px, 7vw, 90px); height: clamp(70px, 10vw, 110px); opacity: 0.3; }
        }

        /* Mobile Landscape Large (600px - 767px) */
        @media (max-width: 767px) and (min-width: 600px) {
          .experience-section {
            padding: 18px 14px 24px;
            min-height: auto;
          }

          h1 {
            font-size: clamp(14px, 3vw, 18px);
            margin-bottom: clamp(8px, 1.5vw, 12px);
          }

          .line {
            flex: 1;
          }

          .tabs {
            gap: 0;
          }

          .tab-item:nth-child(1),
          .tab-item:nth-child(3) {
            display: none;
          }

          .tab-item {
            font-size: clamp(9px, 2.5vw, 12px);
            letter-spacing: clamp(1px, 0.5vw, 1.5px);
            font-weight: 600;
            color: #111;
          }

          .slider {
            min-height: clamp(140px, 28vh, 240px);
            gap: clamp(6px, 1.2vw, 10px);
          }

          .card:nth-child(1) { display: none; }
          .card:nth-child(2) { display: none; }
          .card:nth-child(3) { width: clamp(200px, 95vw, 360px); height: clamp(200px, 65vh, 380px); opacity: 1; }
          .card:nth-child(4) { display: none; }
          .card:nth-child(5) { display: none; }
        }

        /* Mobile Medium (480px - 599px) */
        @media (max-width: 599px) and (min-width: 480px) {
          .experience-section {
            padding: 16px 12px 20px;
            min-height: auto;
          }

          h1 {
            font-size: clamp(13px, 2.8vw, 17px);
            margin-bottom: clamp(8px, 1.5vw, 12px);
          }

          .line {
            flex: 1;
          }

          .tabs {
            gap: 0;
          }

          .tab-item:nth-child(1),
          .tab-item:nth-child(3) {
            display: none;
          }

          .tab-item {
            font-size: clamp(8px, 2vw, 11px);
            letter-spacing: clamp(1px, 0.3vw, 1.2px);
            font-weight: 600;
            color: #111;
          }

          .slider {
            min-height: clamp(110px, 22vh, 180px);
            gap: clamp(4px, 1vw, 8px);
          }

          .card:nth-child(1) { display: none; }
          .card:nth-child(2) { display: none; }
          .card:nth-child(3) { width: clamp(180px, 90vw, 320px); height: clamp(180px, 60vh, 340px); opacity: 1; }
          .card:nth-child(4) { display: none; }
          .card:nth-child(5) { display: none; }

          .overlay { font-size: clamp(0.5rem, 0.75vw, 0.65rem); padding: clamp(2px, 0.4vw, 4px); }
          .controls button { width: clamp(26px, 3vw, 30px); height: clamp(26px, 3vw, 30px); font-size: clamp(0.75rem, 0.85vw, 0.9rem); }
        }

        /* Mobile Small (420px - 479px) */
        @media (max-width: 479px) and (min-width: 420px) {
          .experience-section {
            padding: 16px 12px 22px;
            min-height: auto;
          }

          h1 {
            font-size: clamp(12px, 2.6vw, 16px);
            margin-bottom: clamp(6px, 1.2vw, 10px);
          }

          .line {
            flex: 1;
          }

          .tabs {
            gap: 0;
          }

          .tab-item:nth-child(1),
          .tab-item:nth-child(3) {
            display: none;
          }

          .tab-item {
            font-size: clamp(7px, 1.8vw, 10px);
            letter-spacing: clamp(0.8px, 0.2vw, 1px);
            font-weight: 600;
            color: #111;
          }

          .slider {
            min-height: clamp(100px, 20vh, 160px);
            gap: clamp(3px, 0.8vw, 6px);
          }

          .card:nth-child(1) { display: none; }
          .card:nth-child(2) { display: none; }
          .card:nth-child(3) { width: clamp(160px, 90vw, 300px); height: clamp(160px, 55vh, 300px); opacity: 1; }
          .card:nth-child(4) { display: none; }
          .card:nth-child(5) { display: none; }

          .overlay { font-size: clamp(0.5rem, 0.75vw, 0.65rem); padding: clamp(2px, 0.4vw, 4px); }
          .controls button { width: clamp(26px, 3vw, 30px); height: clamp(26px, 3vw, 30px); font-size: clamp(0.75rem, 0.85vw, 0.9rem); }
        }

        /* Extra Small Mobile (360px - 419px) */
        @media (max-width: 419px) {
          .experience-section {
            padding: 12px 8px 16px;
            min-height: auto;
          }

          h1 {
            font-size: clamp(11px, 2.5vw, 15px);
            margin-bottom: clamp(5px, 1vw, 8px);
          }

          .line {
            flex: 1;
          }

          .tabs {
            gap: 0;
          }

          .tab-item:nth-child(1),
          .tab-item:nth-child(3) {
            display: none;
          }

          .tab-item {
            font-size: clamp(6px, 1.5vw, 9px);
            letter-spacing: clamp(0.5px, 0.1vw, 0.8px);
            font-weight: 600;
            color: #111;
          }

          .slider {
            min-height: clamp(90px, 18vh, 140px);
            gap: clamp(2px, 0.6vw, 4px);
          }

          .card:nth-child(1) { display: none; }
          .card:nth-child(2) { display: none; }
          .card:nth-child(3) { width: clamp(140px, 90vw, 280px); height: clamp(140px, 50vh, 280px); opacity: 1; }
          .card:nth-child(4) { display: none; }
          .card:nth-child(5) { display: none; }
        }
      `}</style>
    </section>
  );
}