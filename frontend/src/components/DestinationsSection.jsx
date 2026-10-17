import React, { useState, useRef, useEffect } from "react";
import { MapPinCheckIcon } from "./MapPinCheckIcon";

export default function App() {
  const categories = [
    "Wellness",
    "Heritage",
    "Temple Towns",
    "Jungles",
    "Quick Getaways",
    "Waterfront",
    "Hills & Mountains",
    "International",
  ];

  const resortData = {
       Wellness: [
      {
        title: "Saptagiri Retreat",
        subtitle: "Pune, Maharashtra",
        image:
          "https://magazine.compareretreats.com/wp-content/uploads/2018/08/Screen-Shot-2018-09-03-at-10.34.00-AM-1.png",
      },
      {
        title: "Veda Hills Retreat",
        subtitle: "Karnataka, India",
        image:
          "https://static.wixstatic.com/media/9b64ce_14215d88e3b44b60966057470dbbc7e3~mv2.jpg/v1/fill/w_1000,h_563,al_c,q_85,usm_0.66_1.00_0.01/9b64ce_14215d88e3b44b60966057470dbbc7e3~mv2.jpg",
      },
      {
        title: "Prakriti Hills Escape",
        subtitle: "Himachal Pradesh, India",
        image:
          "https://r-xx.bstatic.com/xdata/images/hotel/608x352/540260856.webp?k=4a6dc26337abb546a39294e126ff0e3739b3f55a30a5b3dd42e1882708312eaa&o=",
      },
    ],
    Heritage: [
      {
        title: "Jaisalmer",
        subtitle: "Rajasthan's royalty, redefined",
        image:
          "https://images.unsplash.com/photo-1593693411515-c20261bcad6e?q=80&w=1200&auto=format&fit=crop",
      },
      {
        title: "Derby Green",
        subtitle: "A colonial retreat in Tamil Nadu",
        image:
          "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop",
      },
      {
        title: "Udaipur",
        subtitle: "Lakes and legends in Rajasthan",
        image:
          "https://images.unsplash.com/photo-1599661046289-e31897846e41?q=80&w=1200&auto=format&fit=crop",
      },
    ],

    "Temple Towns": [
      {
        title: "Varanasi",
        subtitle: "Sacred moments by the ghats",
        image:
          "https://img.staticmb.com/mbcontent/images/crop/uploads/2024/4/places-to-visit-in-varanasi_0_1200.jpg.webp",
      },
      {
        title: "Madurai",
        subtitle: "A divine South Indian retreat",
        image:
          "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?q=80&w=1200&auto=format&fit=crop",
      },
      {
        title: "Tirupati",
        subtitle: "Spiritual comfort in every stay",
        image:
          "https://images.unsplash.com/photo-1605649487212-47bdab064df7?q=80&w=1200&auto=format&fit=crop",
      },
    ],

    Jungles: [
      {
        title: "Ranthambore",
        subtitle: "Luxury in the lap of the wild",
        image:
          "https://images.unsplash.com/photo-1549366021-9f761d450615?q=80&w=1200&auto=format&fit=crop",
      },
      {
        title: "Jim Corbett",
        subtitle: "Where the forest whispers",
        image:
          "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=1200&auto=format&fit=crop",
      },
      {
        title: "Kaziranga",
        subtitle: "Untamed beauty, elevated stay",
        image:
          "https://images.unsplash.com/photo-1516426122078-c23e76319801?q=80&w=1200&auto=format&fit=crop",
      },
    ],

    "Quick Getaways": [
      {
        title: "Lonavala",
        subtitle: "A short break, beautifully done",
        image:
          "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop",
      },
      {
        title: "Mussoorie",
        subtitle: "Weekend calm in the hills",
        image:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop",
      },
      {
        title: "Goa",
        subtitle: "Relaxed luxury by the coast",
        image:
          "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=1200&auto=format&fit=crop",
      },
    ],

    Waterfront: [
      {
        title: "Kerala",
        subtitle: "Floating into serene luxury",
        image:
          "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=1200&auto=format&fit=crop",
      },
      {
        title: "Andaman",
        subtitle: "Oceanfront calm and charm",
        image:
          "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop",
      },
      {
        title: "Maldives",
        subtitle: "Blue waters, white sands, elegance",
        image:
          "https://images.unsplash.com/photo-1573843981267-be1999ff37cd?q=80&w=1200&auto=format&fit=crop",
      },
    ],

    "Hills & Mountains": [
      {
        title: "Shimla",
        subtitle: "Colonial charm above the clouds",
        image:
          "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=1200&auto=format&fit=crop",
      },
      {
        title: "Manali",
        subtitle: "Snowy escapes with soul",
        image:
          "https://images.unsplash.com/photo-1626621331169-5f34c5f9e4e3?q=80&w=1200&auto=format&fit=crop",
      },
      {
        title: "Darjeeling",
        subtitle: "Tea, mist, and mountain luxury",
        image:
          "https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=1200&auto=format&fit=crop",
      },
    ],

    International: [
      {
        title: "Dubai",
        subtitle: "Arabian dreams, come alive",
        image:
          "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1200&auto=format&fit=crop",
      },
      {
        title: "Finland",
        subtitle: "Where the northern lights waltz",
        image:
          "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=1200&auto=format&fit=crop",
      },
      {
        title: "Cambodia",
        subtitle: "Echoes of an ancient world",
        image:
          "https://images.unsplash.com/photo-1580136579312-94651dfd596d?q=80&w=1200&auto=format&fit=crop",
      },
    ],
  };

  const [activeTab, setActiveTab] = useState("Wellness");
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
  }, [isAutoScrolling, activeTab]);

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

  const handleContainerClickOutside = () => {
    setIsAutoScrolling(true);
  };

  return (
    <>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap");

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: "Manrope", sans-serif;
        }

        body {
          background: #f5f5f3;
          color: #111111;
        }

        .ERresorts-page {
          width: 100%;
          min-height: auto;
          padding: clamp(14px, 3vw, 20px);
          display: flex;
          justify-content: center;
          background: #f5f5f3;
        }

        .ERcontainer {
          width: 100%;
          max-width: 1680px;
        }

        .ERheading {
          text-align: center;
          margin-bottom: clamp(12px, 2.5vw, 25px);
        }

        .ERheading h1 {
          font-size: clamp(24px, 2.5vw, 36px);
          font-weight: 600;
          color: #1b1b1b;
          line-height: 1.2;
          margin-bottom: 6px;
        }

        .ERheading p {
          font-size: clamp(12px, 1.2vw, 14px);
          color: #6f6f6f;
          font-weight: 400;
        }

        .ERtabs {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: clamp(8px, 1.5vw, 12px);
          margin-bottom: clamp(18px, 3vw, 30px);
        }

        .ERtabs.mobile-scroll {
          overflow-x: auto;
          overflow-y: hidden;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          flex-wrap: nowrap;
          padding: 0 clamp(10px, 2vw, 16px) clamp(8px, 1.5vw, 12px) 0;
          margin-bottom: clamp(16px, 2.5vw, 22px);
          gap: clamp(8px, 1.5vw, 12px);
        }

        .ERtabs.mobile-scroll::-webkit-scrollbar {
          height: 4px;
        }

        .ERtabs.mobile-scroll::-webkit-scrollbar-track {
          background: #e5e5e5;
          border-radius: 10px;
        }

        .ERtabs.mobile-scroll::-webkit-scrollbar-thumb {
          background: #b7b7b7;
          border-radius: 10px;
        }

        .ERtab-btn {
          border: 1.4px solid #b7b7b7;
          background: transparent;
          color: #6b6b6b;
          padding: 8px 18px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .ERtab-btn:hover {
          transform: translateY(-2px);
        }

        .ERtab-btn.active {
          background: #111111;
          color: #ffffff;
          border-color: #111111;
        }

        .ERcards-wrapper {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .ERcards-scroll-container {
          display: none;
          overflow-x: auto;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          gap: 12px;
          scroll-snap-type: x mandatory;
          padding: 0 0 8px 0;
          width: 100%;
        }

        .ERcards-scroll-container::-webkit-scrollbar {
          height: 6px;
        }

        .ERcards-scroll-container::-webkit-scrollbar-track {
          background: #e5e5e5;
          border-radius: 10px;
        }

        .ERcards-scroll-container::-webkit-scrollbar-thumb {
          background: #b7b7b7;
          border-radius: 10px;
        }

        .ERresort-card {
          position: relative;
          height: clamp(200px, 30vh, 320px);
          border-radius: clamp(12px, 2.5vw, 18px);
          overflow: hidden;
          cursor: pointer;
          background: #ddd;
        }

        .ERresort-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.6s ease;
        }

        .ERresort-card:hover img {
          transform: scale(1.05);
        }

        .ERoverlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.88) 0%,
            rgba(0, 0, 0, 0.4) 45%,
            rgba(0, 0, 0, 0.12) 100%
          );
        }

        .ERcard-content {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 16px;
          color: white;
          z-index: 2;
        }

        .ERcard-content h2 {
          font-size: clamp(16px, 1.5vw, 24px);
          font-weight: 500;
          margin-bottom: 6px;
          line-height: 1.1;
        }

        .ERcard-line {
          width: 100%;
          height: 1px;
          background: rgba(255, 255, 255, 0.35);
          margin-bottom: 8px;
        }

        .ERcard-content p {
          font-size: 12px;
          font-weight: 600;
          color: #f2f2f2;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ERlocation-icon {
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }

        .ERexplore-wrap {
          display: flex;
          justify-content: center;
          margin-top: clamp(18px, 3vw, 32px);
        }

        .ERexplore-btn {
          padding: 12px 36px;
          border: 1.5px solid #8d8d8d;
          border-radius: 999px;
          background: transparent;
          font-size: 14px;
          font-weight: 600;
          color: #111111;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .ERexplore-btn:hover {
          background: #111111;
          color: #ffffff;
          border-color: #111111;
        }

        @media (max-width: 1200px) {
          .ERcards-wrapper {
            grid-template-columns: repeat(2, 1fr);
            gap: clamp(14px, 2vw, 18px);
          }

          .ERresort-card {
            height: clamp(200px, 35vh, 280px);
          }
        }

        @media (max-width: 1023px) and (min-width: 900px) {
          .ERcards-wrapper {
            grid-template-columns: repeat(2, 1fr);
            gap: clamp(12px, 2vw, 16px);
          }

          .ERresort-card {
            height: clamp(200px, 30vh, 260px);
          }
        }

        @media (max-width: 899px) and (min-width: 768px) {
          .ERresorts-page {
            min-height: auto;
            padding: clamp(12px, 2.5vw, 18px);
          }

          .ERheading {
            margin-bottom: clamp(12px, 2.5vw, 18px);
          }

          .ERcards-wrapper {
            grid-template-columns: repeat(2, 1fr);
            gap: clamp(12px, 2vw, 16px);
          }

          .ERresort-card {
            height: clamp(200px, 32vh, 280px);
          }
        }

        @media (max-width: 767px) and (min-width: 600px) {
          .ERresorts-page {
            min-height: auto;
            padding: clamp(12px, 2.5vw, 16px);
          }

          .ERheading {
            margin-bottom: clamp(12px, 2.5vw, 16px);
          }

          .ERtabs {
            overflow-x: auto;
            overflow-y: hidden;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            flex-wrap: nowrap;
            padding: clamp(6px, 1.2vw, 8px) 0 clamp(8px, 1.5vw, 12px) 0;
            margin-bottom: clamp(16px, 2.5vw, 22px);
            gap: clamp(8px, 1.5vw, 12px);
            justify-content: flex-start;
          }

          .ERtabs::-webkit-scrollbar {
            height: 4px;
          }

          .ERtabs::-webkit-scrollbar-track {
            background: #e5e5e5;
            border-radius: 10px;
          }

          .ERtabs::-webkit-scrollbar-thumb {
            background: #b7b7b7;
            border-radius: 10px;
          }

          .ERtab-btn {
            padding: clamp(7px, 1.3vw, 10px) clamp(12px, 2.2vw, 16px);
            font-size: clamp(12px, 1.6vw, 14px);
            flex-shrink: 0;
          }

          .ERcards-wrapper {
            display: none;
          }

          .ERcards-scroll-container {
            display: flex;
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            gap: 12px;
            scroll-snap-type: x mandatory;
            padding: 0 0 8px 0;
          }

          .ERcards-scroll-container::-webkit-scrollbar {
            height: 6px;
          }

          .ERcards-scroll-container::-webkit-scrollbar-track {
            background: #e5e5e5;
            border-radius: 10px;
          }

          .ERcards-scroll-container::-webkit-scrollbar-thumb {
            background: #b7b7b7;
            border-radius: 10px;
          }

          .ERresort-card {
            height: clamp(220px, 35vh, 300px);
            border-radius: clamp(12px, 2.5vw, 14px);
            min-width: 100%;
            max-width: 100%;
            flex-shrink: 0;
          }

          .ERcard-content h2 {
            font-size: clamp(14px, 1.8vw, 20px);
          }

          .ERcard-content p {
            font-size: clamp(10px, 1.2vw, 12px);
          }

          .ERexplore-btn {
            width: clamp(85%, 90%, 95%);
            font-size: clamp(12px, 1.4vw, 14px);
            padding: clamp(8px, 1.5vw, 12px) clamp(18px, 3vw, 24px);
          }
        }

        @media (max-width: 599px) and (min-width: 480px) {
          .ERresorts-page {
            min-height: auto;
            padding: clamp(10px, 2vw, 14px);
          }

          .ERheading h1 {
            font-size: clamp(18px, 4vw, 26px);
            margin-bottom: clamp(6px, 1.5vw, 10px);
          }

          .ERheading p {
            font-size: clamp(10px, 1.2vw, 12px);
          }

          .ERheading {
            margin-bottom: clamp(10px, 2vw, 14px);
          }

          .ERtabs {
            overflow-x: auto;
            overflow-y: hidden;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            flex-wrap: nowrap;
            padding: clamp(6px, 1vw, 8px) 0 clamp(6px, 1vw, 10px) 0;
            margin-bottom: clamp(14px, 2.5vw, 18px);
            gap: clamp(6px, 1.5vw, 10px);
            justify-content: flex-start;
          }

          .ERtabs::-webkit-scrollbar {
            height: 3px;
          }

          .ERtabs::-webkit-scrollbar-track {
            background: #e5e5e5;
            border-radius: 8px;
          }

          .ERtabs::-webkit-scrollbar-thumb {
            background: #b7b7b7;
            border-radius: 8px;
          }

          .ERtab-btn {
            padding: clamp(6px, 1.2vw, 9px) clamp(11px, 2.1vw, 15px);
            font-size: clamp(11px, 1.4vw, 13px);
            flex-shrink: 0;
          }

          .ERcards-wrapper {
            display: none;
          }

          .ERcards-scroll-container {
            display: flex;
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            gap: 12px;
            scroll-snap-type: x mandatory;
            padding: 0 0 6px 0;
          }

          .ERcards-scroll-container::-webkit-scrollbar {
            height: 4px;
          }

          .ERcards-scroll-container::-webkit-scrollbar-track {
            background: #e5e5e5;
            border-radius: 8px;
          }

          .ERcards-scroll-container::-webkit-scrollbar-thumb {
            background: #b7b7b7;
            border-radius: 8px;
          }

          .ERresort-card {
            height: clamp(200px, 32vh, 260px);
            border-radius: clamp(10px, 2vw, 12px);
            min-width: 100%;
            max-width: 100%;
            flex-shrink: 0;
          }

          .ERcard-content {
            padding: clamp(10px, 1.5vw, 12px);
          }

          .ERcard-content h2 {
            font-size: clamp(12px, 1.6vw, 16px);
            margin-bottom: clamp(4px, 0.8vw, 6px);
          }

          .ERcard-content p {
            font-size: clamp(8px, 1vw, 10px);
          }

          .ERexplore-btn {
            width: 90%;
            font-size: clamp(11px, 1.3vw, 12px);
            padding: clamp(8px, 1.2vw, 10px) clamp(16px, 2.5vw, 20px);
          }
        }

        @media (max-width: 479px) and (min-width: 420px) {
          .ERresorts-page {
            min-height: auto;
            padding: clamp(10px, 1.8vw, 12px);
          }

          .ERheading h1 {
            font-size: clamp(16px, 3.5vw, 22px);
            margin-bottom: clamp(6px, 1.5vw, 8px);
          }

          .ERheading p {
            font-size: clamp(9px, 1.1vw, 10px);
          }

          .ERtabs {
            overflow-x: auto;
            overflow-y: hidden;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            flex-wrap: nowrap;
            padding: clamp(5px, 0.9vw, 7px) 0 clamp(4px, 0.8vw, 6px) 0;
            margin-bottom: clamp(10px, 2vw, 14px);
            gap: clamp(6px, 1.3vw, 8px);
            justify-content: flex-start;
          }

          .ERtabs::-webkit-scrollbar {
            height: 3px;
          }

          .ERtabs::-webkit-scrollbar-track {
            background: #e5e5e5;
            border-radius: 6px;
          }

          .ERtabs::-webkit-scrollbar-thumb {
            background: #b7b7b7;
            border-radius: 6px;
          }

          .ERtab-btn {
            padding: clamp(6px, 1.1vw, 8px) clamp(10px, 1.9vw, 13px);
            font-size: clamp(10px, 1.3vw, 12px);
            flex-shrink: 0;
          }

          .ERcards-wrapper {
            display: none;
          }

          .ERcards-scroll-container {
            display: flex;
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            gap: 10px;
            scroll-snap-type: x mandatory;
            padding: 0 0 4px 0;
          }

          .ERcards-scroll-container::-webkit-scrollbar {
            height: 3px;
          }

          .ERcards-scroll-container::-webkit-scrollbar-track {
            background: #e5e5e5;
            border-radius: 6px;
          }

          .ERcards-scroll-container::-webkit-scrollbar-thumb {
            background: #b7b7b7;
            border-radius: 6px;
          }

          .ERresort-card {
            height: clamp(180px, 30vh, 240px);
            border-radius: clamp(10px, 1.8vw, 12px);
            min-width: 100%;
            max-width: 100%;
            flex-shrink: 0;
          }

          .ERcard-content h2 {
            font-size: clamp(11px, 1.4vw, 14px);
            margin-bottom: clamp(3px, 0.6vw, 5px);
          }

          .ERcard-content p {
            font-size: clamp(7px, 0.9vw, 9px);
          }

          .ERexplore-btn {
            width: 88%;
            font-size: clamp(10px, 1.2vw, 11px);
            padding: clamp(7px, 1vw, 8px) clamp(14px, 2vw, 18px);
          }
        }

        @media (max-width: 419px) {
          .ERresorts-page {
            min-height: auto;
            padding: clamp(8px, 1.5vw, 10px);
          }

          .ERheading h1 {
            font-size: clamp(14px, 3vw, 18px);
            margin-bottom: clamp(4px, 1vw, 6px);
          }

          .ERheading p {
            font-size: clamp(8px, 0.9vw, 9px);
          }

          .ERheading {
            margin-bottom: clamp(8px, 1.5vw, 10px);
          }

          .ERtabs {
            overflow-x: auto;
            overflow-y: hidden;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            flex-wrap: nowrap;
            padding: clamp(4px, 0.7vw, 6px) 0 clamp(4px, 0.6vw, 5px) 0;
            margin-bottom: clamp(10px, 2vw, 12px);
            gap: clamp(4px, 1vw, 6px);
            justify-content: flex-start;
          }

          .ERtabs::-webkit-scrollbar {
            height: 2px;
          }

          .ERtabs::-webkit-scrollbar-track {
            background: #e5e5e5;
            border-radius: 4px;
          }

          .ERtabs::-webkit-scrollbar-thumb {
            background: #999;
            border-radius: 4px;
          }

          .ERtab-btn {
            padding: clamp(5px, 1vw, 7px) clamp(8px, 1.6vw, 11px);
            font-size: clamp(9px, 1.1vw, 11px);
            flex-shrink: 0;
          }

          .ERcards-wrapper {
            display: none;
          }

          .ERcards-scroll-container {
            display: flex;
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            gap: 8px;
            scroll-snap-type: x mandatory;
            padding: 0 0 3px 0;
          }

          .ERcards-scroll-container::-webkit-scrollbar {
            height: 2px;
          }

          .ERcards-scroll-container::-webkit-scrollbar-track {
            background: #e5e5e5;
            border-radius: 4px;
          }

          .ERcards-scroll-container::-webkit-scrollbar-thumb {
            background: #999;
            border-radius: 4px;
          }

          .ERresort-card {
            height: clamp(160px, 28vh, 220px);
            border-radius: clamp(8px, 1.5vw, 10px);
            min-width: 100%;
            max-width: 100%;
            flex-shrink: 0;
          }

          .ERcard-content {
            left: clamp(8px, 1.2vw, 10px);
            right: clamp(8px, 1.2vw, 10px);
            bottom: clamp(8px, 1.2vw, 10px);
          }

          .ERcard-content h2 {
            font-size: clamp(10px, 1.2vw, 12px);
            margin-bottom: clamp(2px, 0.5vw, 4px);
          }

          .ERcard-line {
            margin-bottom: clamp(4px, 0.8vw, 5px);
          }

          .ERcard-content p {
            font-size: clamp(6px, 0.8vw, 8px);
            gap: clamp(4px, 0.8vw, 6px);
          }

          .ERlocation-icon {
            font-size: clamp(10px, 1.5vw, 12px);
          }

          .ERexplore-btn {
            width: 85%;
            font-size: clamp(9px, 1vw, 10px);
            padding: clamp(6px, 0.8vw, 7px) clamp(12px, 1.8vw, 14px);
          }
        }
      `}</style>

      <div className="ERresorts-page" onClick={handleOutsideClick}>
        <div className="ERcontainer">
          <div className="ERheading">
            <h1>Exclusive Stays, Curated by OrianaaClub</h1>
            <p>
              Where iconic places become the backdrop for treasured moments
              together
            </p>
          </div>

          <div className="ERtabs">
            {categories.map((item) => (
              <button
                key={item}
                className={`ERtab-btn ${activeTab === item ? "active" : ""}`}
                onClick={() => setActiveTab(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="ERcards-wrapper">
            {resortData[activeTab].map((item, index) => (
              <div className="ERresort-card" key={index}>
                <img src={item.image} alt={item.title} />
                <div className="ERoverlay"></div>

                  <div className="ERcard-content">
                  <h2>{item.title}</h2>
                  <div className="ERcard-line"></div>
                  <p>
                    <MapPinCheckIcon size={16} isAnimated={true} />
                    {item.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div
            className="ERcards-scroll-container"
            ref={scrollContainerRef}
            onClick={handleCardClick}
            onBlur={handleContainerClickOutside}
          >
            {resortData[activeTab].map((item, index) => (
              <div className="ERresort-card" key={index}>
                <img src={item.image} alt={item.title} />
                <div className="ERoverlay"></div>

                  <div className="ERcard-content">
                  <h2>{item.title}</h2>
                  <div className="ERcard-line"></div>
                  <p>
                    <MapPinCheckIcon size={16} isAnimated={true} />
                    {item.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="ERexplore-wrap">
            <button className="ERexplore-btn">Explore all destinations</button>
          </div>
        </div>
      </div>
    </>
  );
}